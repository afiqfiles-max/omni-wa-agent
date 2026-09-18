import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import pino from 'pino';
import QRCode from 'qrcode';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';

import config from '../config/index.js';
import { normalizeQuery } from './normalizer.js';
import { sessionManager } from './session.js';
import { isChitchatOrGreeting, isBotMetadataProbe, condenseQuery } from './smart-router.js';
import { searchDocs, ingestDocs, getCollection } from './rag.js';
import { generateAnswer, callInternalLLM } from './ai.js';
import {
  isCriticalCrisis,
  isExplicitStaffRequest,
  logUnansweredQuery,
  dispatchTier4Emergency
} from './query-logger.js';
import { startTunnel } from './tunnel-manager.js';

const app = express();
app.use(express.json());
app.use(express.static(path.resolve(process.cwd(), 'public')));

let waSocket = null;
let latestQrDataUrl = null;
let isConnected = false;
const messageQueues = new Map(); // Map<jid, Promise<void>>

// ==============================================================================
// Express HTTP & Admin API Endpoints
// ==============================================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    connected: isConnected,
    memory: process.memoryUsage(),
    activeSessions: sessionManager.getActiveSessionsCount()
  });
});

app.get('/admin', (req, res) => {
  res.sendFile(path.resolve(process.cwd(), 'public/dashboard.html'));
});

app.get('/api/status', async (req, res) => {
  let kbCount = 0;
  try {
    const col = await getCollection();
    kbCount = await col.count();
  } catch (e) {}

  let unansweredCount = 0;
  const logFile = path.resolve(process.cwd(), 'unanswered_queries.json');
  if (fs.existsSync(logFile) && fs.statSync(logFile).isFile()) {
    try {
      const logs = JSON.parse(fs.readFileSync(logFile, 'utf-8'));
      unansweredCount = Array.isArray(logs) ? logs.filter(l => l.status === 'PENDING').length : 0;
    } catch (e) {}
  }

  res.json({
    connected: isConnected,
    botName: config.bot.name,
    organization: config.bot.organization,
    domain: config.bot.domain,
    qrCode: latestQrDataUrl,
    activeSessions: sessionManager.getActiveSessionsCount(),
    kbChunks: kbCount,
    unansweredCount
  });
});

app.post('/api/sandbox', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query required' });

  try {
    const normalized = normalizeQuery(query);
    const chunks = await searchDocs(normalized, 3);
    const answer = await generateAnswer(query, chunks, []);
    res.json({
      original: query,
      normalized,
      context: chunks,
      answer
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ingest', async (req, res) => {
  try {
    const count = await ingestDocs();
    res.json({ success: true, chunksIndexed: count });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/unanswered', (req, res) => {
  const logFile = path.resolve(process.cwd(), 'unanswered_queries.json');
  if (fs.existsSync(logFile) && fs.statSync(logFile).isFile()) {
    try {
      const logs = JSON.parse(fs.readFileSync(logFile, 'utf-8'));
      return res.json(Array.isArray(logs) ? logs : []);
    } catch (e) {}
  }
  res.json([]);
});

// Outbound REST API Webhook to send message via WhatsApp
app.post('/api/message/send', async (req, res) => {
  const { to, text } = req.body;
  if (!to || !text) return res.status(400).json({ error: 'Parameters "to" and "text" are required.' });
  if (!waSocket || !isConnected) return res.status(503).json({ error: 'WhatsApp socket is not connected.' });

  const jid = to.includes('@') ? to : `${to.replace(/\D/g, '')}@s.whatsapp.net`;
  try {
    await waSocket.sendMessage(jid, { text });
    res.json({ success: true, jid });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================================================================
// FIFO Message Queue & Typing Jitter Engine
// ==============================================================================

function queueMessageProcessing(jid, taskFn) {
  const currentQueue = messageQueues.get(jid) || Promise.resolve();
  const nextQueue = currentQueue.then(taskFn).catch(err => {
    console.error(`[QUEUE ERROR] Failed task for ${jid}:`, err.message);
  });
  messageQueues.set(jid, nextQueue);

  // Garbage collect queue once resolved
  nextQueue.finally(() => {
    if (messageQueues.get(jid) === nextQueue) {
      messageQueues.delete(jid);
    }
  });
}

async function simulateHumanTyping(sock, jid, textLength) {
  try {
    await sock.sendPresenceUpdate('composing', jid);
    // Gaussian typing jitter: 15-25ms per character (capped between 1.2s and 4.0s)
    const delayMs = Math.min(Math.max(textLength * 18, 1200), 4000);
    await new Promise(resolve => setTimeout(resolve, delayMs));
    await sock.sendPresenceUpdate('paused', jid);
  } catch (e) {}
}

// ==============================================================================
// Core Inbound Message Pipeline
// ==============================================================================

async function handleInboundMessage(sock, msg) {
  if (!msg.message || msg.key.fromMe) return;

  const remoteJid = msg.key.remoteJid;
  // Ignore broadcasts & status stories
  if (remoteJid.includes('@broadcast') || remoteJid.includes('status@broadcast')) return;

  // Extract text content
  const messageContent = msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    '';

  if (!messageContent || messageContent.trim().length === 0) return;

  const rawQuery = messageContent.trim();
  console.log(`[INBOUND] From: ${remoteJid} | Message: "${rawQuery}"`);

  // Process inside sequential FIFO queue per sender
  queueMessageProcessing(remoteJid, async () => {
    // 1. Mark as read
    try {
      await sock.readMessages([msg.key]);
    } catch (e) {}

    const history = sessionManager.getHistory(remoteJid);

    // 2. Check for Critical Crisis / Emergency (Tier 4 Escalation)
    if (isCriticalCrisis(rawQuery)) {
      console.warn(`[EMERGENCY DETECTED] Customer ${remoteJid} triggered crisis indicators.`);
      await dispatchTier4Emergency(sock, remoteJid, rawQuery, history);
      
      const crisisReply = `⚠️ *[Emergency Support Alert]*\n\nWe have immediately escalated your situation with highest priority to our emergency response and human specialist team.\n\nAn on-call specialist has been notified directly and will reach out to you as quickly as possible.`;
      await simulateHumanTyping(sock, remoteJid, crisisReply.length);
      await sock.sendMessage(remoteJid, { text: crisisReply }, { quoted: msg });
      sessionManager.addInteraction(remoteJid, 'user', rawQuery);
      sessionManager.addInteraction(remoteJid, 'assistant', crisisReply);
      return;
    }

    // 3. Check for Explicit Request to Talk to Human Agent
    if (isExplicitStaffRequest(rawQuery)) {
      logUnansweredQuery(rawQuery, 'HUMAN_HANDOFF_REQUESTED', remoteJid, history);
      const hotlineInfo = config.bot.hotlineJid ? `at *${config.bot.hotlineJid.replace('@s.whatsapp.net', '')}*` : 'via our official help desk';
      const staffReply = `I understand you would like to speak directly with a human team member. I have logged your request.\n\nYou can reach our live support specialist ${hotlineInfo} during business hours (Monday–Friday, 08:00–18:00). A representative will assist you shortly.`;
      
      await simulateHumanTyping(sock, remoteJid, staffReply.length);
      await sock.sendMessage(remoteJid, { text: staffReply }, { quoted: msg });
      sessionManager.addInteraction(remoteJid, 'user', rawQuery);
      sessionManager.addInteraction(remoteJid, 'assistant', staffReply);
      return;
    }

    // 4. Check for Technical Probes & Bot Building Tutorials (Zero-Latency Security Guard)
    if (isBotMetadataProbe(rawQuery)) {
      const isId = /(?:bikin|buat|gimana|bagaimana|kamu|anda|apa|koding|codingan|kayak|seperti|bisa|tolong|ajarin|sistem|aplikasi)/i.test(rawQuery);
      const probeReply = isId
        ? `Halo! Saya *${config.bot.name}*, asisten virtual resmi dari *${config.bot.organization}*.\n\nMohon maaf, saya didedikasikan khusus untuk membantu pertanyaan dan layanan seputar produk/layanan kami, sehingga tidak dapat membagikan informasi teknis sistem, arsitektur internal, maupun panduan/tutorial pembuatan bot.\n\nApakah ada hal seputar layanan *${config.bot.organization}* yang bisa saya bantu?`
        : `Hello! I am *${config.bot.name}*, the official virtual assistant for *${config.bot.organization}*.\n\nPlease note that my role is strictly dedicated to assisting customers with our services and support. I cannot provide internal system architecture details, technical tutorials, or bot development guides.\n\nIs there anything regarding *${config.bot.organization}*'s services I can help you with?`;

      await simulateHumanTyping(sock, remoteJid, probeReply.length);
      await sock.sendMessage(remoteJid, { text: probeReply }, { quoted: msg });
      sessionManager.addInteraction(remoteJid, 'user', rawQuery);
      sessionManager.addInteraction(remoteJid, 'assistant', probeReply);
      return;
    }

    // 5. Check for pure Chitchat / Greeting (Bypass heavy vector search)
    if (isChitchatOrGreeting(rawQuery) && history.length === 0) {
      const greetingReply = `Hello! I am *${config.bot.name}*, the automated assistant for *${config.bot.organization}*.\n\nHow may I help you today? You can ask me about our services, pricing, technical documentation, or support policies.`;
      await simulateHumanTyping(sock, remoteJid, greetingReply.length);
      await sock.sendMessage(remoteJid, { text: greetingReply }, { quoted: msg });
      sessionManager.addInteraction(remoteJid, 'user', rawQuery);
      sessionManager.addInteraction(remoteJid, 'assistant', greetingReply);
      return;
    }

    // 5. Query Rewriting & Slang Normalization
    const condensed = await condenseQuery(history, rawQuery, callInternalLLM);
    const normalized = normalizeQuery(condensed);

    // 6. Vector Document Retrieval (RAG)
    const contextDocs = await searchDocs(normalized, 3);

    // 7. Epistemic Calibration & Answer Generation
    try {
      const answer = await generateAnswer(rawQuery, contextDocs, history);
      await simulateHumanTyping(sock, remoteJid, answer.length);
      await sock.sendMessage(remoteJid, { text: answer }, { quoted: msg });

      sessionManager.addInteraction(remoteJid, 'user', rawQuery);
      sessionManager.addInteraction(remoteJid, 'assistant', answer);
    } catch (err) {
      console.error('[AI ERROR]', err.message);
      logUnansweredQuery(rawQuery, 'LLM_EXCEPTION', remoteJid, history);
      const fallbackMsg = `Thank you for your inquiry. Our automated assistant is currently experiencing a temporary processing delay. Please try again in a few moments or contact our support desk directly.`;
      await sock.sendMessage(remoteJid, { text: fallbackMsg }, { quoted: msg });
    }
  });
}

// ==============================================================================
// WhatsApp Baileys Socket Initialization & Lifecycle
// ==============================================================================

async function startWhatsAppBot() {
  const authDir = path.resolve(process.cwd(), config.bot.authFolder);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`[BAILEYS] Using WhatsApp Web version ${version.join('.')} (Latest: ${isLatest})`);

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    generateHighQualityLinkPreview: true,
    browser: ['OmniWA', 'Chrome', '122.0.0.0']
  });

  waSocket = sock;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('[BAILEYS] New QR Code generated. Scan via dashboard at /admin');
      latestQrDataUrl = await QRCode.toDataURL(qr);
    }

    if (connection === 'close') {
      isConnected = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`[BAILEYS] Connection closed (code: ${statusCode}). Reconnecting: ${shouldReconnect}`);

      // Clean up event listeners to prevent memory leak
      sock.ev.removeAllListeners();

      if (shouldReconnect) {
        setTimeout(startWhatsAppBot, 5000);
      } else {
        console.warn('[BAILEYS] Session logged out. Please delete auth folder and scan QR again.');
      }
    } else if (connection === 'open') {
      isConnected = true;
      latestQrDataUrl = null;
      console.log(`\n✅ [BAILEYS CONNECTED] Logged in as: ${sock.user?.id || 'Bot'}\n`);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type === 'notify') {
      for (const msg of messages) {
        await handleInboundMessage(sock, msg);
      }
    }
  });
}

// ==============================================================================
// Bootstrapper
// ==============================================================================

const PORT = config.server.port;
app.listen(PORT, async () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(` 🚀 OmniWA-Agent API Server listening on port ${PORT}`);
  console.log(` 📊 Web Admin Dashboard: http://localhost:${PORT}/admin`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Launch Cloudflare Tunnel if enabled
  startTunnel(PORT);

  // Start WhatsApp Socket
  try {
    await startWhatsAppBot();
  } catch (err) {
    console.error('[BAILEYS START ERROR]', err.message);
  }
});

// Process signal handlers
process.on('SIGINT', () => {
  console.log('\nGracefully shutting down OmniWA-Agent...');
  process.exit(0);
});
