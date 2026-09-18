import assert from 'node:assert';
import {
  isCriticalCrisis,
  isExplicitStaffRequest,
  canDispatchEscalation,
  recordEscalationDispatch,
  extractOriginalIssue,
  dispatchEscalationWebhook
} from '../src/query-logger.js';

console.log('🧪 Running Escalation & Crisis Protocol Tests...');

// 1. Suicide & Self-harm triggers (multilingual)
assert.ok(isCriticalCrisis('aku udah gak tahan lagi mau bunuh diri'), 'Failed on Indonesian suicide trigger');
assert.ok(isCriticalCrisis('I want to kill myself, everything is broken'), 'Failed on English suicide trigger');

// 2. Disasters & Critical incidents
assert.ok(isCriticalCrisis('kantor kami terkena banjir bandang parah'), 'Failed on disaster trigger');
assert.ok(isCriticalCrisis('there is a massive explosion and fire broke out'), 'Failed on fire trigger');

// 3. Cybercrime & Financial fraud
assert.ok(isCriticalCrisis('akun kami kena hack dan ada penipuan transaksi'), 'Failed on fraud trigger');
assert.ok(isCriticalCrisis('our database has a ransomware data breach'), 'Failed on breach trigger');

// 4. Safe queries must NOT trigger crisis
assert.ok(!isCriticalCrisis('bagaimana cara mendaftar akun baru?'));
assert.ok(!isCriticalCrisis('what are the pricing options?'));

// 5. Explicit Human Staff Requests
assert.ok(isExplicitStaffRequest('tolong hubungkan saya ke staf manusia asli'), 'Failed ID staff request');
assert.ok(isExplicitStaffRequest('I want to speak with a human support agent'), 'Failed EN staff request');
assert.ok(isExplicitStaffRequest('bukan bot tolong dong min'), 'Failed rejection of bot');

// 6. Escalation Dispatch Idempotency / Cooldown
const testPhone = '628999999999';
assert.ok(canDispatchEscalation(testPhone), 'First dispatch should be allowed');
recordEscalationDispatch(testPhone);
assert.ok(!canDispatchEscalation(testPhone), 'Second immediate dispatch MUST be blocked by cooldown');

// 7. Extract original substantive issue from history
const historyWithGreeting = [
  { role: 'user', content: 'Halo kak mau tanya' },
  { role: 'assistant', content: 'Halo! Ada yang bisa dibantu?' },
  { role: 'user', content: 'Akun saya terkunci dan pembayaran gagal terus' },
  { role: 'assistant', content: 'Bisa infokan emailnya?' }
];
const extracted = extractOriginalIssue(historyWithGreeting, 'tolong staf manusia');
assert.ok(extracted.includes('Akun saya terkunci'), 'Failed to extract root issue from conversation history');

// 8. Test Webhook dispatch safety (must resolve cleanly without throwing even without network)
const webhookRes = await dispatchEscalationWebhook({
  customer: '628123456789',
  issue: 'Test alert notification',
  reason: 'TEST_ALERT',
  severity: 'HIGH'
});
assert.strictEqual(webhookRes, true, 'Webhook dispatch should gracefully resolve to true');

console.log('✅ [PASS] All crisis and escalation tests passed.');
