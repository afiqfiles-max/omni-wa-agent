import { spawnSync } from 'node:child_process';
import path from 'node:path';

const testFiles = [
  'tests/test-normalizer.js',
  'tests/test-session.js',
  'tests/test-router.js',
  'tests/test-escalation.js',
  'tests/test-adversarial-traps.js'
];

console.log('====================================================');
console.log(' 🚀 OMNIWA-AGENT MASTER AUTOMATED TEST RUNNER');
console.log('====================================================\n');

let totalPassed = 0;
let totalFailed = 0;

for (const file of testFiles) {
  console.log(`▶ Running: ${file}`);
  const result = spawnSync('node', [file], { stdio: 'inherit' });
  if (result.status === 0) {
    totalPassed++;
  } else {
    totalFailed++;
    console.error(`❌ ${file} failed with exit code ${result.status}`);
  }
  console.log('----------------------------------------------------');
}

console.log(`\nMASTER TEST RESULT:`);
console.log(`Passed Suites: ${totalPassed}/${testFiles.length}`);
console.log(`Failed Suites: ${totalFailed}/${testFiles.length}`);

if (totalFailed > 0) {
  process.exit(1);
} else {
  console.log('\n🎉 ALL MASTER SUITES PASSED CLEANLY (100%)!\n');
  process.exit(0);
}
