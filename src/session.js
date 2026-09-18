export class SessionManager {
  constructor(maxHistory = 6, ttlMs = 30 * 60 * 1000) {
    this.sessions = new Map();
    this.maxHistory = maxHistory;
    this.ttlMs = ttlMs;
  }

  getSession(jid) {
    if (!this.sessions.has(jid)) {
      this.sessions.set(jid, {
        history: [],
        lastActivity: Date.now(),
        timer: null
      });
    }

    const session = this.sessions.get(jid);
    session.lastActivity = Date.now();

    // Reset expiry timer
    if (session.timer) clearTimeout(session.timer);
    session.timer = setTimeout(() => {
      this.clearSession(jid);
    }, this.ttlMs);

    return session;
  }

  addInteraction(jid, role, content) {
    if (!jid || !content) return;
    const session = this.getSession(jid);
    session.history.push({ role, content: content.trim() });

    // Keep history strictly within maxHistory sliding window
    if (session.history.length > this.maxHistory) {
      session.history = session.history.slice(-this.maxHistory);
    }
  }

  // Alias for compatibility
  addMessage(jid, role, content) {
    this.addInteraction(jid, role, content);
  }

  getHistory(jid) {
    const session = this.getSession(jid);
    return [...session.history];
  }

  clearSession(jid) {
    if (this.sessions.has(jid)) {
      const session = this.sessions.get(jid);
      if (session.timer) clearTimeout(session.timer);
      this.sessions.delete(jid);
    }
  }

  clearAll() {
    for (const [jid, session] of this.sessions.entries()) {
      if (session.timer) clearTimeout(session.timer);
    }
    this.sessions.clear();
  }

  getActiveSessionsCount() {
    return this.sessions.size;
  }
}

export const sessionManager = new SessionManager();
export default sessionManager;
