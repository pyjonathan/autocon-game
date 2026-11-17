// Expected results below are written by hand from the spec's cases (SPEC SC-002),
// not computed by calling the evaluator under test.
import { test, assert, eq } from './harness.js';
import { evaluate } from '../engine/rules.js';
import { makeSwitchLevel, makeRouterLevel, makeFirewallLevel } from './fixtures.js';

const sw = makeSwitchLevel();
const rt = makeRouterLevel();
const fw = makeFirewallLevel();

// ---- Level 1: switch -------------------------------------------------------
test('L1R1 correct: gi0-3', () => {
  const r = evaluate(sw, sw.rounds[0], 'gi0-3');
  eq(r.status, 'correct');
  eq(r.expected.gateId, 'gi0-3');
  eq(r.reasonCode, 'correct');
});

test('L1R1 incorrect gi0-1 (ingress): ingress-port-chosen', () => {
  const r = evaluate(sw, sw.rounds[0], 'gi0-1');
  eq(r.status, 'incorrect');
  eq(r.reasonCode, 'ingress-port-chosen');
});

test('L1R1 incorrect gi0-4 has no specific wording: wrong-gate', () => {
  const r = evaluate(sw, sw.rounds[0], 'gi0-4');
  eq(r.status, 'incorrect');
  eq(r.reasonCode, 'wrong-gate');
});

test('L1R2 correct: unknown MAC floods to gi0-2, gi0-3, gi0-4 (not ingress gi0-1)', () => {
  const r = evaluate(sw, sw.rounds[1], 'flood');
  eq(r.status, 'correct');
  eq(r.expected.gateId, 'flood');
  eq(r.evidence.floodedPorts, ['gi0-2', 'gi0-3', 'gi0-4']);
});

test('L1R2 incorrect drop: drop-chosen-unknown-mac', () => {
  const r = evaluate(sw, sw.rounds[1], 'drop');
  eq(r.status, 'incorrect');
  eq(r.reasonCode, 'drop-chosen-unknown-mac');
});

test('L1R2 incorrect single port gi0-2: flood-expected', () => {
  const r = evaluate(sw, sw.rounds[1], 'gi0-2');
  eq(r.status, 'incorrect');
  eq(r.reasonCode, 'flood-expected');
});

test('Switch MAC comparison is case-insensitive', () => {
  const round = { ...sw.rounds[0], packet: { ...sw.rounds[0].packet, dstMac: '00:AA:00:00:00:03' } };
  const r = evaluate(sw, round, 'gi0-3');
  eq(r.status, 'correct');
});

// ---- Level 2: router -------------------------------------------------------
test('L2R1 correct: 192.168.2.77 -> gi0-1, TTL 64 -> 63, MACs rewritten', () => {
  const r = evaluate(rt, rt.rounds[0], 'gi0-1');
  eq(r.status, 'correct');
  eq(r.expected.gateId, 'gi0-1');
  eq(r.evidence.usedDefaultRoute, false);
  eq(r.evidence.ttlBefore, 64);
  eq(r.evidence.ttlAfter, 63);
  eq(r.evidence.rewrittenSrcMac, '00:bb:00:00:00:02');
  eq(r.evidence.rewrittenDstMac, '00:cc:00:00:02:4d');
});

test('L2R1 incorrect gi0-2: default-route-misused', () => {
  const r = evaluate(rt, rt.rounds[0], 'gi0-2');
  eq(r.status, 'incorrect');
  eq(r.reasonCode, 'default-route-misused');
});

test('L2R1 incorrect gi0-0 (ingress): ingress-port-chosen', () => {
  const r = evaluate(rt, rt.rounds[0], 'gi0-0');
  eq(r.reasonCode, 'ingress-port-chosen');
});

test('L2R2 correct (boundary): 192.168.3.10 uses default route out gi0-2', () => {
  const r = evaluate(rt, rt.rounds[1], 'gi0-2');
  eq(r.status, 'correct');
  eq(r.expected.gateId, 'gi0-2');
  eq(r.evidence.usedDefaultRoute, true);
  eq(r.evidence.ttlAfter, 63);
  eq(r.evidence.rewrittenDstMac, '00:dd:00:00:00:01');
});

test('L2R2 incorrect gi0-1: outside-prefix', () => {
  const r = evaluate(rt, rt.rounds[1], 'gi0-1');
  eq(r.status, 'incorrect');
  eq(r.reasonCode, 'outside-prefix');
});

test('L2R2 incorrect drop: wrong-gate', () => {
  const r = evaluate(rt, rt.rounds[1], 'drop');
  eq(r.status, 'incorrect');
  eq(r.reasonCode, 'wrong-gate');
});

// ---- Level 3: firewall -----------------------------------------------------
test('L3R1 correct: TCP 23 is decided by rule-1 (DENY) even though rule-2 also matches', () => {
  const r = evaluate(fw, fw.rounds[0], 'rule-1');
  eq(r.status, 'correct');
  eq(r.expected.gateId, 'rule-1');
  eq(r.expected.verdict, 'DENY');
});

test('L3R1 incorrect rule-2: rule-order-ignored', () => {
  const r = evaluate(fw, fw.rounds[0], 'rule-2');
  eq(r.status, 'incorrect');
  eq(r.reasonCode, 'rule-order-ignored');
});

test('L3R2 correct (boundary): UDP 443 matches no rule -> implicit-deny', () => {
  const r = evaluate(fw, fw.rounds[1], 'implicit-deny');
  eq(r.status, 'correct');
  eq(r.expected.gateId, 'implicit-deny');
  eq(r.expected.verdict, 'DENY');
  eq(r.evidence.implicitDeny, true);
});

test('L3R2 incorrect rule-3: UDP matches but port 53 != 443 -> port-mismatch', () => {
  const r = evaluate(fw, fw.rounds[1], 'rule-3');
  eq(r.status, 'incorrect');
  eq(r.reasonCode, 'port-mismatch');
});

test('L3R2 incorrect rule-2: TCP rule vs UDP packet -> protocol-mismatch', () => {
  const r = evaluate(fw, fw.rounds[1], 'rule-2');
  eq(r.status, 'incorrect');
  eq(r.reasonCode, 'protocol-mismatch');
});

test('Extra boundary: UDP 53 is decided by rule-3 (PERMIT)', () => {
  const round = { ...fw.rounds[1], packet: { ...fw.rounds[1].packet, dstPort: 53 } };
  const r = evaluate(fw, round, 'rule-3');
  eq(r.status, 'correct');
  eq(r.expected.verdict, 'PERMIT');
});

// ---- Input and content failures -------------------------------------------
test('Empty selection is invalid-input and reveals no expected gate', () => {
  for (const a of ['', '   ', null, undefined]) {
    const r = evaluate(sw, sw.rounds[0], a);
    eq(r.status, 'invalid-input');
    eq(r.reasonCode, 'no-selection');
    eq(r.expected, null);
  }
});

test('A gate that is not in the round is invalid-input (unknown-gate)', () => {
  const r = evaluate(sw, sw.rounds[0], 'gi0-9');
  eq(r.status, 'invalid-input');
  eq(r.reasonCode, 'unknown-gate');
});

test('Broken content is reported as content-error, never graded', () => {
  const broken = { ...rt, table: { ...rt.table, routes: [] } };
  const r = evaluate(broken, broken.rounds[0], 'gi0-1');
  eq(r.status, 'content-error');
  eq(r.reasonCode, 'content-error');
});

test('evaluate is pure: same inputs, same result, inputs untouched', () => {
  const before = JSON.stringify(rt);
  const a = evaluate(rt, rt.rounds[0], 'gi0-1');
  const b = evaluate(rt, rt.rounds[0], 'gi0-1');
  eq(a, b);
  assert(JSON.stringify(rt) === before, 'evaluate must not mutate its inputs');
});

test('Expected gate does not depend on gate order', () => {
  const reversed = { ...sw.rounds[0], gates: [...sw.rounds[0].gates].reverse() };
  const r = evaluate(sw, reversed, 'gi0-3');
  eq(r.status, 'correct');
});
