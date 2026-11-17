// Tiny dependency-free test harness shared by the browser runner (tests/index.html)
// and the optional Node runner (tests/run-node.mjs).

const registry = [];

export function test(id, fn) {
  registry.push({ id, fn });
}

export function assert(condition, message) {
  if (!condition) throw new Error(message || 'assertion failed');
}

export function eq(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message || 'not equal'}: expected ${e}, got ${a}`);
}

export async function runAll() {
  const results = [];
  for (const t of registry) {
    try {
      await t.fn();
      results.push({ id: t.id, ok: true });
    } catch (err) {
      results.push({ id: t.id, ok: false, error: err && err.message ? err.message : String(err) });
    }
  }
  const failed = results.filter((r) => !r.ok);
  return { total: results.length, passed: results.length - failed.length, failed, results };
}

/** Loads the shipped content file in both the browser and Node. */
export async function loadShippedLevels() {
  const url = new URL('../data/levels.json', import.meta.url);
  if (typeof window !== 'undefined') {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load ${url}: ${response.status}`);
    return response.json();
  }
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  return JSON.parse(await readFile(fileURLToPath(url), 'utf8'));
}
