import fs from 'node:fs';
import path from 'node:path';
import config from '../config/index.js';

const LOG_FILE = path.resolve(process.cwd(), 'unanswered_queries.json');
const escalationCooldowns = new Map(); // Map<phone, timestamp>
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

export function isCriticalCrisis(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.toLowerCase();

  // Mental health & severe crisis (EN, ID, ES)
  const suicidePattern = /\b(?:suicide|kill myself|want to die|end my life|bunuh diri|mau mati|ingin mati|tidak mau hidup|putus asa|dak tahan lagi|no quiero vivir|suicidio)\b/i;
  if (suicidePattern.test(t)) return true;

  // Physical disasters & severe safety incidents
  const disasterPattern = /\b(?:natural disaster|earthquake|flood|explosion|fire broke out|severe accident|bencana|gempa|banjir bandang|kebakaran|terbakar|kecelakaan parah|sakit parah|meninggal|duka cita|desastre|terremoto|incendio)\b/i;
  if (disasterPattern.test(t)) return true;

  // Active cybercrime & financial fraud
  const cyberfraudPattern = /\b(?:data breach|ransomware|hacked|account compromised|credit card fraud|unauthorized transaction|pembobolan|di-hack|kena tipu|ditipu|penipuan|transaksi mencurigakan)\b/i;
  if (cyberfraudPattern.test(t)) return true;

  // Production system downtime during critical window
  const outagePattern = /(?:down|error total|rusak|gangguan server|server down|outage).*(?:production|live|server|exam|ujian|payment)/i;
  if (outagePattern.test(t)) return true;

  return false;
}

export function isExplicitStaffRequest(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.toLowerCase();

  const pattern = /(?:talk|speak|connect|transfer|chat).*(?:human|agent|person|representative|staff|operator|support team)/i;
  const idPattern = /(?:mau|ingin|bisa|minta|tolong|hubungkan|bicara|ngomong|kontak).*(?:staf|admin|manusia|orang asli|operator|cs|customer service)/i;
  const rejectBotPattern = /(?:not a bot|talk to real person|mana manusia|mana admin|mana staf|bukan bot|jangan bot)/i;

  return pattern.test(t) || idPattern.test(t) || rejectBotPattern.test(t);
}

export function canDispatchEscalation(phone) {
  if (!phone) return false;
  const clean = String(phone).replace(/\D/g, '');
  const lastTime = escalationCooldowns.get(clean);
  if (!lastTime) return true;
  return (Date.now() - lastTime) > COOLDOWN_MS;
}

export function recordEscalationDispatch(phone) {
  if (!phone) return;
  const clean = String(phone).replace(/\D/g, '');
  escalationCooldowns.set(clean, Date.now());
}

export function extractOriginalIssue(history, currentQuery) {
  if (!history || history.length === 0) return currentQuery;

  // Find the first substantive user message that isn't a greeting
  const problemIndicators = /(?:error|problem|issue|failed|cannot|broken|kendala|masalah|gagal|rusak|salah|terkunci|payment|bayar|refund|bencana|darurat)/i;

  for (const item of history) {
    if (item.role === 'user' && item.content) {
      if (problemIndicators.test(item.content)) {
        return item.content.trim();
      }
    }
  }

  // Fallback: first user message longer than 25 chars
  for (const item of history) {
    if (item.role === 'user' && item.content && item.content.trim().length > 25) {
      return item.content.trim();
    }
  }

  return currentQuery;
}

export function logUnansweredQuery(query, reason = 'LOW_CONFIDENCE', phone = 'UNKNOWN', history = []) {
  try {
    let logs = [];
    if (fs.existsSync(LOG_FILE)) {
      try {
        logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
        if (!Array.isArray(logs)) logs = [];
      } catch (e) {
        logs = [];
      }
    }

    const newEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      phone: String(phone),
      query: String(query).trim(),
      reason,
      status: 'PENDING',
      historyCount: history.length,
      historySummary: history.slice(-4).map(h => `${h.role}: ${h.content.substring(0, 80)}`)
    };

    logs.unshift(newEntry);
    // Keep max 500 logs
    if (logs.length > 500) logs = logs.slice(0, 500);

    fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), 'utf-8');
    return newEntry;
  } catch (err) {
    console.error('Failed to log unanswered query:', err.message);
    return null;
  }
}

export async function dispatchTier4Emergency(sock, userJid, originalQuery, history = []) {
  if (!sock || !config.bot.hotlineJid) {
    console.warn('[ESCALATION] WhatsApp socket or HOTLINE_JID not configured.');
    return false;
  }

  const cleanPhone = (userJid || '').replace('@s.whatsapp.net', '').replace('@lid', '');
  if (!canDispatchEscalation(cleanPhone)) {
    console.log(`[ESCALATION] Suppressed duplicate Tier 4 dispatch for ${cleanPhone} (Cooldown active)`);
    return false;
  }

  const substantiveIssue = extractOriginalIssue(history, originalQuery);

  const ticketPayload = `🚨 *[TIER 4 EMERGENCY CRISIS DISPATCH]*
━━━━━━━━━━━━━━━━━━━━━━━━━━
*Status:* CRITICAL INCIDENT / HIGH PRIORITY
*Timestamp:* ${new Date().toLocaleString()}
*Customer Contact:* ${cleanPhone}
*Direct WhatsApp Link:* https://wa.me/${cleanPhone}

*Core Complaint / Crisis:*
"${substantiveIssue}"

*Latest Message:*
"${originalQuery}"

*Action Required:*
On-call human support must review and contact the customer immediately.
━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  try {
    await sock.sendMessage(config.bot.hotlineJid, { text: ticketPayload });
    recordEscalationDispatch(cleanPhone);
    console.log(`[ESCALATION] Tier 4 Emergency Ticket successfully dispatched to ${config.bot.hotlineJid} for customer ${cleanPhone}`);
    return true;
  } catch (err) {
    console.error('[ESCALATION] Failed to dispatch emergency ticket:', err.message);
    return false;
  }
}

export default {
  isCriticalCrisis,
  isExplicitStaffRequest,
  canDispatchEscalation,
  recordEscalationDispatch,
  extractOriginalIssue,
  logUnansweredQuery,
  dispatchTier4Emergency
};
