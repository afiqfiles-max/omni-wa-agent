import assert from 'node:assert';
import { isChitchatOrGreeting, condenseQuery } from '../src/smart-router.js';

console.log('🧪 Running Smart Router Test Suite...');

// 1. Greetings (EN, ID)
assert.ok(isChitchatOrGreeting('Halo'), 'Failed on "Halo"');
assert.ok(isChitchatOrGreeting('Hai kak!'), 'Failed on "Hai kak!"');
assert.ok(isChitchatOrGreeting('Good morning'), 'Failed on "Good morning"');
assert.ok(isChitchatOrGreeting('Assalamualaikum'), 'Failed on "Assalamualaikum"');
assert.ok(isChitchatOrGreeting('P'), 'Failed on "P"');

// 2. Gratitude
assert.ok(isChitchatOrGreeting('Terima kasih banyak'), 'Failed on gratitude');
assert.ok(isChitchatOrGreeting('Thanks admin'), 'Failed on EN gratitude');

// 3. Substantive inquiries (MUST NOT be treated as chitchat)
assert.ok(!isChitchatOrGreeting('Berapa biaya pendaftaran untuk mahasiswa baru tahun 2026?'));
assert.ok(!isChitchatOrGreeting('How do I configure WhatsApp multi-device webhook?'));
assert.ok(!isChitchatOrGreeting('I want to cancel my pro plan subscription'));

// 4. Query Condensing fallback when LLM not provided
async function testCondense() {
  const history = [{ role: 'user', content: 'What is the Starter Tier?' }];
  const followUp = 'How much is it?';
  const res = await condenseQuery(history, followUp, null);
  // Without LLM caller, must cleanly fallback to original query
  assert.strictEqual(res, followUp);
}

testCondense().then(() => {
  console.log('✅ [PASS] All smart router tests passed.');
});
