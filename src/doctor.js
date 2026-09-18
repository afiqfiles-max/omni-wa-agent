import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import config from '../config/index.js';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(' 🩺 OmniWA-Agent Self-Diagnostic Doctor CLI');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

let issues = 0;

async function checkNodeVersion() {
  const current = process.version;
  const major = parseInt(current.slice(1).split('.')[0], 10);
  if (major >= 20) {
    console.log(`[PASS] Node.js Version: ${current} (>= v20 LTS supported)`);
  } else {
    console.error(`[FAIL] Node.js Version: ${current}. Requires Node.js v20 LTS or newer.`);
    issues++;
  }
}

function checkConfigFiles() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    console.log(`[PASS] Environment File: .env found`);
  } else {
    console.warn(`[WARN] Environment File: .env not found. (Using process defaults or .env.example)`);
  }

  if (config.ai.apiKey && !config.ai.apiKey.includes('your-openai-or-groq')) {
    console.log(`[PASS] AI API Key: Configured (${config.ai.apiKey.substring(0, 7)}...)`);
  } else {
    console.error(`[FAIL] AI API Key: Missing or using placeholder in .env`);
    issues++;
  }
}

async function checkChromaDB() {
  try {
    let res;
    try {
      res = await axios.get(`${config.rag.chromaUrl.replace(/\/+$/, '')}/api/v2/heartbeat`, { timeout: 3000 });
    } catch (e2) {
      res = await axios.get(`${config.rag.chromaUrl.replace(/\/+$/, '')}/api/v1/heartbeat`, { timeout: 3000 });
    }
    if (res.status === 200) {
      console.log(`[PASS] Vector DB (ChromaDB): Online at ${config.rag.chromaUrl}`);
    } else {
      console.warn(`[WARN] Vector DB (ChromaDB): Unexpected status ${res.status}`);
    }
  } catch (err) {
    console.warn(`[WARN] Vector DB (ChromaDB): Unreachable at ${config.rag.chromaUrl} (${err.message}). Make sure ChromaDB is running or start it via docker-compose.`);
  }
}

async function checkLLMEndpoint() {
  if (!config.ai.apiKey || config.ai.apiKey.includes('your-openai')) {
    return;
  }
  const start = Date.now();
  try {
    const client = axios.create({
      baseURL: config.ai.baseUrl.replace(/\/+$/, ''),
      headers: { 'Authorization': `Bearer ${config.ai.apiKey}` },
      timeout: 10000
    });
    await client.get('/models');
    const latency = Date.now() - start;
    console.log(`[PASS] AI Model Endpoint: Reachable (${latency}ms latency)`);
  } catch (err) {
    console.warn(`[WARN] AI Model Endpoint: Ping failed (${err.message})`);
  }
}

function checkKnowledgeBase() {
  const kbDir = path.resolve(process.cwd(), config.rag.kbDirectory);
  if (fs.existsSync(kbDir)) {
    const files = fs.readdirSync(kbDir).filter(f => /\.(md|txt|json)$/i.test(f));
    console.log(`[PASS] Knowledge Base: ${files.length} document(s) detected in ${config.rag.kbDirectory}`);
  } else {
    console.warn(`[WARN] Knowledge Base: Directory ${config.rag.kbDirectory} not found`);
  }
}

function checkWhatsAppSession() {
  const credsPath = path.resolve(process.cwd(), config.bot.authFolder, 'creds.json');
  if (fs.existsSync(credsPath)) {
    console.log(`[PASS] WhatsApp Session: Authenticated session detected in ${config.bot.authFolder}/`);
  } else {
    console.log(`[INFO] WhatsApp Session: No session detected. Ready for initial QR scan or pairing code.`);
  }
}

async function runDoctor() {
  await checkNodeVersion();
  checkConfigFiles();
  await checkChromaDB();
  await checkLLMEndpoint();
  checkKnowledgeBase();
  checkWhatsAppSession();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (issues === 0) {
    console.log(' 🎉 All critical diagnostics passed! Ready for production.');
  } else {
    console.log(` ⚠️ Found ${issues} critical issue(s). Please review the steps above.`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

runDoctor();
