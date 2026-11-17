// Content validation tests (T008). Fixtures are inline; the last group checks the shipped file.
import { test, assert, eq, loadShippedLevels } from './harness.js';
import { validateDocument, formatError } from '../engine/content.js';
import { makeFixtureDocument } from './fixtures.js';

const clone = (o) => JSON.parse(JSON.stringify(o));
const level = (doc, device) => doc.levels.find((l) => l.device === device);

function mustReject(name, mutate, expectLevelId, expectRoundId) {
  test(`content error: ${name}`, () => {
    const doc = makeFixtureDocument();
    mutate(doc);
    const result = validateDocument(doc);
    assert(!result.valid, 'document should be rejected');
    assert(result.errors.length > 0, 'at least one error expected');
    const text = result.errors.map(formatError).join(' | ');
    if (expectLevelId) assert(text.includes(expectLevelId), `error should name level ${expectLevelId}: ${text}`);
    if (expectRoundId) assert(text.includes(expectRoundId), `error should name round ${expectRoundId}: ${text}`);
  });
}

test('the fixture document is valid (baseline)', () => {
  const result = validateDocument(makeFixtureDocument());
  eq(result.errors.map(formatError), []);
  assert(result.valid, 'fixture should validate');
});

// ---- The four invalid-content cases named in the spec (SC-004) ----
mustReject('router table with no default route', (d) => {
  const r = level(d, 'router').table;
  r.routes = r.routes.filter((x) => x.prefixLength !== 0);
}, 'fx-router');

mustReject('two overlapping non-default prefixes', (d) => {
  level(d, 'router').table.routes.push({ prefix: '192.168.2.128', prefixLength: 25, interfaceId: 'gi0-1' });
}, 'fx-router');

mustReject('switch destination MAC mapped to the ingress port', (d) => {
  level(d, 'switch').rounds[0].packet.dstMac = '00:aa:00:00:00:01';
}, 'fx-switch', 'l1r1');

mustReject('TTL below 2', (d) => {
  level(d, 'router').rounds[0].packet.ttl = 1;
}, 'fx-router', 'l2r1');

// ---- Other validation rules from the data model ----
mustReject('unsupported schemaVersion', (d) => { d.schemaVersion = 99; });
mustReject('missing schemaVersion', (d) => { delete d.schemaVersion; });
mustReject('no levels', (d) => { d.levels = []; });
mustReject('level with no rounds', (d) => { level(d, 'switch').rounds = []; }, 'fx-switch');
mustReject('duplicate level IDs', (d) => { d.levels[1].id = d.levels[0].id; });
mustReject('duplicate round IDs across the document', (d) => { level(d, 'router').rounds[0].id = 'l1r1'; });
mustReject('duplicate port IDs', (d) => { level(d, 'switch').table.ports[1].id = 'gi0-1'; }, 'fx-switch');
mustReject('duplicate rule IDs', (d) => { level(d, 'firewall').table.rules[1].id = 'rule-1'; }, 'fx-firewall');
mustReject('invalid MAC format', (d) => { level(d, 'switch').rounds[0].packet.srcMac = '00:aa:00:00:00'; }, 'fx-switch', 'l1r1');
mustReject('invalid IPv4 octet', (d) => { level(d, 'router').rounds[0].packet.dstIp = '192.168.2.300'; }, 'fx-router', 'l2r1');
mustReject('invalid protocol', (d) => { level(d, 'firewall').rounds[0].packet.protocol = 'ICMP'; }, 'fx-firewall', 'l3r1');
mustReject('port out of range', (d) => { level(d, 'firewall').rounds[0].packet.dstPort = 70000; }, 'fx-firewall', 'l3r1');
mustReject('TTL above 255', (d) => { level(d, 'router').rounds[0].packet.ttl = 256; }, 'fx-router', 'l2r1');
mustReject('route prefix length 31', (d) => {
  level(d, 'router').table.routes.push({ prefix: '198.51.100.0', prefixLength: 31, interfaceId: 'gi0-2' });
}, 'fx-router');
mustReject('route prefix length 32', (d) => {
  level(d, 'router').table.routes.push({ prefix: '198.51.100.1', prefixLength: 32, interfaceId: 'gi0-2' });
}, 'fx-router');
mustReject('switch destination MAC is broadcast', (d) => { level(d, 'switch').rounds[0].packet.dstMac = 'ff:ff:ff:ff:ff:ff'; }, 'fx-switch', 'l1r1');
mustReject('switch destination MAC is multicast', (d) => { level(d, 'switch').rounds[0].packet.dstMac = '01:00:5e:00:00:01'; }, 'fx-switch', 'l1r1');
mustReject('ingress names an unknown port', (d) => { level(d, 'switch').rounds[0].ingress = 'gi9-9'; }, 'fx-switch', 'l1r1');
mustReject('MAC entry refers to an unknown port', (d) => { level(d, 'switch').table.macEntries[0].portId = 'gi9-9'; }, 'fx-switch');
mustReject('route refers to an unknown interface', (d) => { level(d, 'router').table.routes[0].interfaceId = 'gi9-9'; }, 'fx-router');
mustReject('gate list lacks the evaluator\'s expected gate', (d) => {
  const r = level(d, 'switch').rounds[0];
  r.gates = r.gates.filter((g) => g.id !== 'gi0-3');
}, 'fx-switch', 'l1r1');
mustReject('gate list contains a gate that is not in the table', (d) => {
  level(d, 'switch').rounds[0].gates.push({ id: 'gi7-7', label: 'Gi7/7' });
}, 'fx-switch', 'l1r1');
mustReject('firewall gate list lacks implicit-deny when it is the answer', (d) => {
  const r = level(d, 'firewall').rounds[1];
  r.gates = r.gates.filter((g) => g.id !== 'implicit-deny');
}, 'fx-firewall', 'l3r2');
mustReject('unknown source ID on a level', (d) => { d.levels[0].sourceIds = ['nope']; }, d0());
mustReject('missing help text', (d) => { delete level(d, 'switch').rounds[0].help; }, 'fx-switch', 'l1r1');
mustReject('misconception for a gate that does not exist', (d) => {
  level(d, 'switch').rounds[0].misconceptions = { 'gi8-8': { text: 'x' } };
}, 'fx-switch', 'l1r1');
mustReject('router round missing rewritten MACs', (d) => { delete level(d, 'router').rounds[0].display; }, 'fx-router', 'l2r1');
mustReject('firewall rule with an invalid action', (d) => { level(d, 'firewall').table.rules[0].action = 'ALLOW'; }, 'fx-firewall');
mustReject('firewall rule port out of range', (d) => { level(d, 'firewall').table.rules[0].dstPort = 0; }, 'fx-firewall');

function d0() { return 'fx-switch'; }

// ---- Adding a trial round by editing data only still validates (SC-007) ----
test('a third round in a level still validates (SC-007)', () => {
  const doc = makeFixtureDocument();
  const sw = level(doc, 'switch');
  const extra = clone(sw.rounds[0]);
  extra.id = 'l1r3-trial';
  sw.rounds.push(extra);
  const result = validateDocument(doc);
  eq(result.errors.map(formatError), []);
  assert(result.valid, 'a 3-round level should validate');
});

// ---- Shipped content (FR-020, FR-014) ----
test('shipped data/levels.json validates', async () => {
  const doc = await loadShippedLevels();
  const result = validateDocument(doc);
  eq(result.errors.map(formatError), []);
  assert(result.valid, 'shipped content must validate');
});

test('shipped data/levels.json has exactly 3 levels (switch, router, firewall) of 2 rounds each (FR-020)', async () => {
  const doc = await loadShippedLevels();
  eq(doc.levels.map((l) => l.device), ['switch', 'router', 'firewall']);
  eq(doc.levels.map((l) => l.rounds.length), [2, 2, 2]);
});
