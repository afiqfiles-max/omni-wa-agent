import assert from 'node:assert';
import { normalizeQuery, removeElongation } from '../src/normalizer.js';

console.log('🧪 Running Slang Normalizer Test Suite...');

// 1. Test Elongation removal
assert.strictEqual(removeElongation('kapaaannn'), 'kapan');
assert.strictEqual(removeElongation('pleeease'), 'please');
assert.strictEqual(removeElongation('soooo'), 'so');

// 2. Test Indonesian chat shorthand expansion
const idInput1 = 'sy mw nnya gmn cr dftr smstr gnjl?';
const idNorm1 = normalizeQuery(idInput1);
assert.ok(idNorm1.includes('saya'), 'Failed to expand "sy" to "saya"');
assert.ok(idNorm1.includes('bagaimana'), 'Failed to expand "gmn" to "bagaimana"');
assert.ok(idNorm1.includes('cara'), 'Failed to expand "cr" to "cara"');
assert.ok(idNorm1.includes('daftar'), 'Failed to expand "dftr" to "daftar"');
assert.ok(idNorm1.includes('semester'), 'Failed to expand "smstr" to "semester"');

// 3. Test English shorthand expansion (explicit lang & auto)
const enInput1 = 'plz send ur pricing info asap, thx!';
const enNorm1 = normalizeQuery(enInput1, 'en');
assert.ok(enNorm1.toLowerCase().includes('please'), 'Failed to expand "plz" to "please"');
assert.ok(enNorm1.toLowerCase().includes('your'), 'Failed to expand "ur" to "your"');
assert.ok(enNorm1.toLowerCase().includes('information'), 'Failed to expand "info" to "information"');
assert.ok(enNorm1.toLowerCase().includes('thank you'), 'Failed to expand "thx" to "thank you"');

// 4. Test Punctuation & boundary preservation
const punctInput = 'brp? 100rb?? bneran!';
const punctNorm = normalizeQuery(punctInput);
assert.ok(punctNorm.includes('berapa?'), 'Failed to preserve punctuation attached to shorthand');

// 5. Test empty / edge cases
assert.strictEqual(normalizeQuery(''), '');
assert.strictEqual(normalizeQuery(null), '');
assert.strictEqual(normalizeQuery('   '), '');

console.log('✅ [PASS] All normalizer tests completed successfully.');
