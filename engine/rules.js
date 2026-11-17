// Pure domain evaluation. No DOM, no timers, no network, no randomness, no progress changes.
// See specs/001-packet-run/contracts/evaluator.md.
import { normalizeMac, parseIpv4, prefixContains } from './net.js';

export const SPECIAL_GATES = {
  switch: ['flood', 'drop'],
  router: ['drop'],
  firewall: ['implicit-deny'],
};

function contentError(message) {
  return { error: message };
}

function resolveSwitch(level, round) {
  const table = level.table;
  if (!table || !Array.isArray(table.ports) || !Array.isArray(table.macEntries)) {
    return contentError('switch table is missing ports or MAC entries');
  }
  const dstMac = normalizeMac(round.packet && round.packet.dstMac);
  const entry = table.macEntries.find((e) => normalizeMac(e.mac) === dstMac) || null;
  if (entry) {
    return {
      expected: { gateId: entry.portId, action: 'forward' },
      evidence: { device: 'switch', dstMac, matchedEntry: entry, floodedPorts: [], ingress: round.ingress },
    };
  }
  const floodedPorts = table.ports.map((p) => p.id).filter((id) => id !== round.ingress);
  return {
    expected: { gateId: 'flood', action: 'flood' },
    evidence: { device: 'switch', dstMac, matchedEntry: null, floodedPorts, ingress: round.ingress },
  };
}

function resolveRouter(level, round) {
  const table = level.table;
  if (!table || !Array.isArray(table.routes) || !Array.isArray(table.interfaces)) {
    return contentError('router table is missing interfaces or routes');
  }
  const packet = round.packet || {};
  if (parseIpv4(packet.dstIp) === null) return contentError('destination IP is not valid IPv4');
  const specific = table.routes.filter(
    (r) => r.prefixLength > 0 && prefixContains(r.prefix, r.prefixLength, packet.dstIp),
  );
  if (specific.length > 1) return contentError('more than one specific route matches (overlapping prefixes)');
  const defaultRoute = table.routes.find((r) => r.prefixLength === 0) || null;
  const route = specific[0] || defaultRoute;
  if (!route) return contentError('no route matches and there is no default route');
  const display = round.display || {};
  return {
    expected: { gateId: route.interfaceId, action: 'forward' },
    evidence: {
      device: 'router',
      dstIp: packet.dstIp,
      matchedRoute: route,
      usedDefaultRoute: route === defaultRoute && specific.length === 0,
      ttlBefore: packet.ttl,
      ttlAfter: packet.ttl - 1,
      rewrittenSrcMac: display.rewrittenSrcMac || null,
      rewrittenDstMac: display.rewrittenDstMac || null,
      ingress: round.ingress,
    },
  };
}

function resolveFirewall(level, round) {
  const table = level.table;
  if (!table || !Array.isArray(table.rules)) return contentError('firewall table is missing rules');
  const packet = round.packet || {};
  const index = table.rules.findIndex(
    (rule) => rule.protocol === packet.protocol && (rule.dstPort === 'any' || rule.dstPort === packet.dstPort),
  );
  if (index === -1) {
    return {
      expected: { gateId: 'implicit-deny', action: 'deny', verdict: 'DENY' },
      evidence: { device: 'firewall', protocol: packet.protocol, dstPort: packet.dstPort, matchedRule: null, matchedIndex: -1, implicitDeny: true },
    };
  }
  const rule = table.rules[index];
  return {
    expected: { gateId: rule.id, action: rule.action === 'PERMIT' ? 'permit' : 'deny', verdict: rule.action },
    evidence: { device: 'firewall', protocol: packet.protocol, dstPort: packet.dstPort, matchedRule: rule, matchedIndex: index, implicitDeny: false },
  };
}

/** Computes the single correct gate and the evidence for a round, or { error }. */
export function resolve(level, round) {
  try {
    if (!level || !round || !round.packet) return contentError('round has no packet');
    switch (level.device) {
      case 'switch': return resolveSwitch(level, round);
      case 'router': return resolveRouter(level, round);
      case 'firewall': return resolveFirewall(level, round);
      default: return contentError(`unsupported device "${level.device}"`);
    }
  } catch (err) {
    return contentError(err && err.message ? err.message : 'unexpected content problem');
  }
}

function gateLabel(round, id) {
  const gate = (round.gates || []).find((g) => g.id === id);
  return gate ? gate.label : id;
}

/** Classifies a wrong answer into a stable reason code, using only the rule and the table. */
function classify(level, round, resolved, answer) {
  const { expected } = resolved;
  const table = level.table;

  if (level.device !== 'firewall' && answer === round.ingress) return 'ingress-port-chosen';

  if (level.device === 'switch') {
    if (expected.gateId === 'flood') return answer === 'drop' ? 'drop-chosen-unknown-mac' : 'flood-expected';
    return 'wrong-gate';
  }

  if (level.device === 'router') {
    const chosenRoute = table.routes.find((r) => r.interfaceId === answer) || null;
    if (resolved.evidence.usedDefaultRoute) {
      if (chosenRoute && chosenRoute.prefixLength > 0) return 'outside-prefix';
      return 'wrong-gate';
    }
    if (chosenRoute && chosenRoute.prefixLength === 0) return 'default-route-misused';
    return 'wrong-gate';
  }

  if (level.device === 'firewall') {
    const chosenIndex = table.rules.findIndex((r) => r.id === answer);
    if (chosenIndex === -1) return 'wrong-gate';
    const chosen = table.rules[chosenIndex];
    const packet = round.packet;
    const chosenMatches = chosen.protocol === packet.protocol && (chosen.dstPort === 'any' || chosen.dstPort === packet.dstPort);
    if (chosenMatches && resolved.evidence.matchedIndex !== -1 && chosenIndex > resolved.evidence.matchedIndex) return 'rule-order-ignored';
    if (chosen.protocol !== packet.protocol) return 'protocol-mismatch';
    if (chosen.dstPort !== 'any' && chosen.dstPort !== packet.dstPort) return 'port-mismatch';
    return 'wrong-gate';
  }

  return 'wrong-gate';
}

/**
 * evaluate(level, round, answer) → { status, expected, reasonCode, evidence }
 * status: "correct" | "incorrect" | "invalid-input" | "content-error"
 */
export function evaluate(level, round, answer) {
  const resolved = resolve(level, round);
  if (resolved.error) {
    return { status: 'content-error', expected: null, reasonCode: 'content-error', evidence: { message: resolved.error } };
  }

  if (typeof answer !== 'string' || answer.trim() === '') {
    return { status: 'invalid-input', expected: null, reasonCode: 'no-selection', evidence: {} };
  }
  const gateIds = (round.gates || []).map((g) => g.id);
  if (!gateIds.includes(answer)) {
    return { status: 'invalid-input', expected: null, reasonCode: 'unknown-gate', evidence: { chosen: answer } };
  }

  if (answer === resolved.expected.gateId) {
    return { status: 'correct', expected: resolved.expected, reasonCode: 'correct', evidence: resolved.evidence };
  }

  return {
    status: 'incorrect',
    expected: resolved.expected,
    reasonCode: classify(level, round, resolved, answer),
    evidence: { ...resolved.evidence, chosen: answer, chosenLabel: gateLabel(round, answer) },
  };
}
