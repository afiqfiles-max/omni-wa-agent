import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import config from '../config/index.js';

let tunnelProcess = null;
const TUNNEL_FILE = path.resolve(process.cwd(), 'TUNNEL_URL.txt');

export function startTunnel(port = 3001) {
  if (!config.tunnel.enabled) {
    console.log('[TUNNEL] Cloudflare Tunnel disabled in configuration.');
    return;
  }

  console.log(`[TUNNEL] Launching Cloudflare Quick Tunnel for port ${port}...`);

  try {
    tunnelProcess = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${port}`]);

    tunnelProcess.stderr.on('data', (data) => {
      const output = data.toString();
      const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match) {
        const publicUrl = match[0];
        console.log(`\n🚀 [TUNNEL ACTIVE] Public Web Admin URL: ${publicUrl}/admin`);
        fs.writeFileSync(TUNNEL_FILE, publicUrl, 'utf-8');
      }
    });

    tunnelProcess.on('error', (err) => {
      console.warn('[TUNNEL] Could not spawn cloudflared CLI. Is cloudflared installed? Falling back to local port only.');
    });

    tunnelProcess.on('close', () => {
      if (fs.existsSync(TUNNEL_FILE)) {
        try { fs.unlinkSync(TUNNEL_FILE); } catch (e) {}
      }
    });
  } catch (err) {
    console.warn('[TUNNEL] Error initiating tunnel:', err.message);
  }
}

export function stopTunnel() {
  if (tunnelProcess) {
    tunnelProcess.kill('SIGTERM');
    tunnelProcess = null;
  }
  if (fs.existsSync(TUNNEL_FILE)) {
    try { fs.unlinkSync(TUNNEL_FILE); } catch (e) {}
  }
}

export default {
  startTunnel,
  stopTunnel
};
