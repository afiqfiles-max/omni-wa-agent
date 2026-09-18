/**
 * Pre-Key Cache Maintenance Script
 * Cleans up expired pre-keys from the Baileys session folder while preserving creds.json.
 * Prevents Linux inode exhaustion and filesystem slow-down.
 */
import fs from 'node:fs';
import path from 'node:path';
import config from '../config/index.js';

const authDir = path.resolve(process.cwd(), config.bot.authFolder);

if (!fs.existsSync(authDir)) {
  console.log('[CACHE CLEANER] Auth directory does not exist. Nothing to clean.');
  process.exit(0);
}

const files = fs.readdirSync(authDir);
let deletedCount = 0;
const now = Date.now();
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

console.log(`[CACHE CLEANER] Scanning ${files.length} session files in ${authDir}...`);

for (const file of files) {
  // NEVER delete critical session credentials or app keys
  if (file === 'creds.json' || file.startsWith('app-state-sync-key')) {
    continue;
  }

  // Pre-keys, session keys, and sender keys can be safely pruned if older than threshold
  if (file.startsWith('pre-key-') || file.startsWith('session-')) {
    const filePath = path.join(authDir, file);
    const stat = fs.statSync(filePath);
    if ((now - stat.mtimeMs) > MAX_AGE_MS) {
      try {
        fs.unlinkSync(filePath);
        deletedCount++;
      } catch (e) {}
    }
  }
}

console.log(`[CACHE CLEANER] Successfully cleaned ${deletedCount} stale pre-key files.`);
