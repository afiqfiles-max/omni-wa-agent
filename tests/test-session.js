import assert from 'node:assert';
import { SessionManager } from '../src/session.js';

console.log('🧪 Running Session Manager Test Suite...');

const sm = new SessionManager(4, 1000);

const jid1 = '62811111111@s.whatsapp.net';
const jid2 = '62822222222@s.whatsapp.net';

// 1. Initial state
assert.strictEqual(sm.getHistory(jid1).length, 0);

// 2. Add interactions
sm.addInteraction(jid1, 'user', 'Hello there');
sm.addInteraction(jid1, 'assistant', 'Hello! How can I help you?');
sm.addInteraction(jid1, 'user', 'How much is pro plan?');

const hist1 = sm.getHistory(jid1);
assert.strictEqual(hist1.length, 3);
assert.strictEqual(hist1[0].role, 'user');
assert.strictEqual(hist1[0].content, 'Hello there');

// 3. Verify JID Isolation
assert.strictEqual(sm.getHistory(jid2).length, 0, 'JID isolation failed');

// 4. Sliding Window (cap = 4)
sm.addInteraction(jid1, 'assistant', 'Pro plan is $149/mo');
sm.addInteraction(jid1, 'user', 'Does it support WhatsApp?');

const histSliding = sm.getHistory(jid1);
assert.strictEqual(histSliding.length, 4, 'Sliding window failed to enforce max limit');
assert.strictEqual(histSliding[0].content, 'Hello! How can I help you?', 'Oldest message was not pruned properly');

// 5. Clear session
sm.clearSession(jid1);
assert.strictEqual(sm.getHistory(jid1).length, 0, 'Failed to clear session');

console.log('✅ [PASS] All session manager tests passed.');
