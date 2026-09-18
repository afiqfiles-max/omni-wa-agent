import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

dotenv.config();

function parseNumber(val, fallback) {
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? fallback : n;
}

const domainPreset = process.env.DOMAIN_PRESET || 'saas';

// Load preset metadata if available
let presetConfig = {};
try {
  const presetPath = path.resolve(process.cwd(), `config/presets/${domainPreset}.json`);
  if (fs.existsSync(presetPath)) {
    presetConfig = JSON.parse(fs.readFileSync(presetPath, 'utf-8'));
  }
} catch (e) {
  // Graceful fallback to empty preset
}

export const config = {
  bot: {
    name: process.env.BOT_NAME || presetConfig.defaultBotName || 'Aura',
    organization: process.env.ORGANIZATION_NAME || presetConfig.defaultOrgName || 'OmniTech Solutions',
    domainPreset,
    primaryLanguage: process.env.PRIMARY_LANGUAGE || 'auto',
    hotlinePhone: process.env.HOTLINE_PHONE || '+1-555-0199',
    hotlineJid: process.env.HOTLINE_JID || '15550199@s.whatsapp.net',
    websiteUrl: process.env.WEBSITE_URL || 'https://example.com',
    authFolder: process.env.AUTH_FOLDER || 'auth_info',
    preset: presetConfig
  },
  ai: {
    baseUrl: process.env.OPENAI_BASE_URL || process.env.AI_ENDPOINT || 'https://api.openai.com/v1',
    endpoint: process.env.OPENAI_BASE_URL || process.env.AI_ENDPOINT || 'https://api.openai.com/v1',
    model: process.env.OPENAI_MODEL || process.env.AI_MODEL || 'gpt-4o-mini',
    visionModel: process.env.AI_VISION_MODEL || 'gpt-4o-mini',
    apiKey: process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '',
    timeoutMs: parseNumber(process.env.AI_TIMEOUT_MS, 30000)
  },
  rag: {
    chromaUrl: process.env.CHROMA_URL || 'http://127.0.0.1:8000',
    collectionName: process.env.CHROMA_COLLECTION || 'omni_knowledge_base',
    kbDirectory: process.env.KB_DIRECTORY || './knowledge_base'
  },
  server: {
    port: parseNumber(process.env.PORT, 3001),
    adminUser: process.env.ADMIN_USER || 'admin',
    adminPass: process.env.ADMIN_PASS || 'admin123',
    enableTunnel: process.env.ENABLE_TUNNEL === 'true'
  },
  tunnel: {
    enabled: process.env.ENABLE_TUNNEL === 'true'
  },
  pacing: {
    minTypingDelayMs: parseNumber(process.env.MIN_TYPING_DELAY_MS, 1200),
    maxTypingDelayMs: parseNumber(process.env.MAX_TYPING_DELAY_MS, 4500),
    typingMsPerChar: parseNumber(process.env.TYPING_MS_PER_CHAR, 20),
    readReceiptDelayMs: parseNumber(process.env.READ_RECEIPT_DELAY_MS, 800),
    rateLimitPerMinute: parseNumber(process.env.RATE_LIMIT_PER_MINUTE, 12)
  }
};

export default config;
