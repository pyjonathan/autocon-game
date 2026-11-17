// Optional convenience: run the same tests from a terminal with Node (no packages needed).
//   node tests/run-node.mjs
// The browser runner at tests/index.html is the supported runner; this script exists so the
// same assertions can be checked without opening a browser.
import { runAll } from './harness.js';

await import('./rules.test.js');
await import('./content.test.js');
await import('./state.test.js');

const { total, passed, failed, results } = await runAll();
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id}${r.ok ? '' : `  -> ${r.error}`}`);
console.log(`\n${total === 0 ? 'FAIL: no tests discovered' : `${passed} of ${total} passed, ${failed.length} failed`}`);
process.exit(total > 0 && failed.length === 0 ? 0 : 1);
