// Turns structured evaluator results into text. Numbers and names come from the evaluator's
// evidence; per-gate wording for plausible mistakes comes from the authored data.
// Wrong-answer feedback names the correct gate only after the round's 2nd wrong attempt (FR-022).

function portLabel(level, id) {
  const t = level.table || {};
  const found = (t.ports || t.interfaces || []).find((p) => p.id === id);
  return found ? found.label : id;
}

function gateLabel(round, id) {
  const gate = (round.gates || []).find((g) => g.id === id);
  return gate ? gate.label : id;
}

function ruleText(rule, index) {
  return `Rule ${index + 1} (${rule.action} ${rule.protocol} ${rule.dstPort === 'any' ? 'any port' : `port ${rule.dstPort}`})`;
}

/** The explanation of why the correct gate is correct. It names the gate. */
function correctParagraphs(level, round, result) {
  const e = result.evidence;
  const p = round.packet;
  if (e.device === 'switch') {
    if (e.matchedEntry) {
      const port = portLabel(level, e.matchedEntry.portId);
      return [
        `The frame's destination MAC is ${e.dstMac}. The MAC table lists it on ${port}, so the switch forwards the frame out ${port} only.`,
        `It is not sent back out the ingress port (${portLabel(level, round.ingress)}).`,
      ];
    }
    const ports = e.floodedPorts.map((id) => portLabel(level, id)).join(', ');
    return [
      `The frame's destination MAC is ${e.dstMac}, which is not in the MAC table.`,
      `With no entry, the switch floods the frame out every port except the ingress port (${portLabel(level, round.ingress)}): ${ports}.`,
    ];
  }
  if (e.device === 'router') {
    const route = e.matchedRoute;
    const iface = portLabel(level, route.interfaceId);
    const lead = e.usedDefaultRoute
      ? `The destination IP ${e.dstIp} is not inside any specific route, so the router uses the default route 0.0.0.0/0${route.nextHop ? ` via ${route.nextHop}` : ''} and forwards out ${iface}.`
      : `The destination IP ${e.dstIp} falls inside ${route.prefix}/${route.prefixLength}, a specific route, so the router forwards out ${iface}.`;
    return [
      lead,
      `TTL goes from ${e.ttlBefore} to ${e.ttlAfter}.`,
      `The router builds a new Ethernet frame: source MAC ${p.srcMac} → ${e.rewrittenSrcMac}, destination MAC ${p.dstMac} → ${e.rewrittenDstMac}. The IP addresses do not change (${p.srcIp} → ${p.dstIp}).`,
    ];
  }
  if (e.device === 'firewall') {
    if (e.implicitDeny) {
      return [
        `No rule matches ${e.protocol} port ${e.dstPort}, because a rule needs both its protocol and its port to match.`,
        'The implicit deny at the end of the list applies, so the packet is denied.',
      ];
    }
    const verdict = e.matchedRule.action === 'PERMIT' ? 'permitted' : 'denied';
    return [
      `${ruleText(e.matchedRule, e.matchedIndex)} is the first rule that matches ${e.protocol} port ${e.dstPort}, so the packet is ${verdict}.`,
      'The firewall stops at the first match, so rules below it are not checked for this packet.',
    ];
  }
  return [];
}

function methodNudge(level, round) {
  const p = round.packet;
  if (level.device === 'switch') return `Next step: find the destination MAC (${p.dstMac}) in the MAC table. Is it there?`;
  if (level.device === 'router') return `Next step: compare the destination IP (${p.dstIp}) with each route's prefix, and check the specific routes before the default route.`;
  return `Next step: go down the rules from the top and compare ${p.protocol} port ${p.dstPort} with each one.`;
}

function genericWrong(level, round, result) {
  const e = result.evidence;
  const chosen = e.chosenLabel || e.chosen;
  const p = round.packet;
  switch (result.reasonCode) {
    case 'ingress-port-chosen':
      return `${chosen} is where the packet arrived. A device does not send a packet straight back where it came from.`;
    case 'drop-chosen-unknown-mac':
      return 'A switch does not drop a frame because its destination is unknown. It floods the frame instead.';
    case 'flood-expected':
      return `The destination MAC (${p.dstMac}) is not in the MAC table, so the switch has no single port to send the frame to.`;
    case 'default-route-misused':
      return 'The default route is only used when no more specific route contains the destination IP.';
    case 'outside-prefix': {
      const route = (level.table.routes || []).find((r) => r.interfaceId === e.chosen);
      return route
        ? `The destination IP ${p.dstIp} is not inside ${route.prefix}/${route.prefixLength}, which is the route for ${chosen}.`
        : `The destination IP ${p.dstIp} is not inside the route for ${chosen}.`;
    }
    case 'rule-order-ignored':
      return `Rules are checked from the top and the first match wins. A rule above ${chosen} already matches this packet.`;
    case 'protocol-mismatch': {
      const rule = (level.table.rules || []).find((r) => r.id === e.chosen);
      return rule
        ? `${chosen} is a ${rule.protocol} rule, but this packet is ${p.protocol}. TCP and UDP are different protocols, so it does not match.`
        : `${chosen} is for a different protocol from this packet (${p.protocol}).`;
    }
    case 'port-mismatch': {
      const rule = (level.table.rules || []).find((r) => r.id === e.chosen);
      return rule
        ? `${chosen} matches ${rule.protocol} only on port ${rule.dstPort}, but this packet is going to port ${p.dstPort}. Both the protocol and the port have to match.`
        : `${chosen} does not match this packet's destination port (${p.dstPort}).`;
    }
    default:
      return level.device === 'switch'
        ? `${chosen} is not the port the MAC table gives for this frame.`
        : level.device === 'router'
          ? `${chosen} is not the result of comparing the destination IP with the routing table.`
          : `${chosen} is not the rule, or the implicit deny, that decides this packet.`;
  }
}

/**
 * explain(result, level, round, context) → {
 *   tone: "good" | "bad" | "info",
 *   headline, paragraphs: [string], revealsGate: boolean, gateLabel: string | null
 * }
 * context.wrongAttempts is the number of valid wrong attempts on this round, including this one.
 */
export function explain(result, level, round, context = {}) {
  const wrongAttempts = context.wrongAttempts || 0;

  if (result.status === 'invalid-input') {
    return {
      tone: 'info',
      headline: 'Choose a gate first',
      paragraphs: [
        result.reasonCode === 'unknown-gate'
          ? "That choice isn't one of this round's gates. Pick one of the listed gates, then press Submit."
          : 'Select one gate, then press Submit. Nothing was counted.',
      ],
      revealsGate: false,
      gateLabel: null,
    };
  }

  if (result.status === 'content-error') {
    return {
      tone: 'bad',
      headline: 'This challenge is unavailable',
      paragraphs: [
        `The challenge data has a problem (${result.evidence.message}), so it cannot be graded. This does not count against you.`,
      ],
      revealsGate: false,
      gateLabel: null,
    };
  }

  const expectedLabel = result.expected ? gateLabel(round, result.expected.gateId) : null;

  if (result.status === 'correct') {
    return {
      tone: 'good',
      headline: level.device === 'firewall' ? `Correct — ${expectedLabel}` : `Correct — through ${expectedLabel}`,
      paragraphs: correctParagraphs(level, round, result),
      revealsGate: false,
      gateLabel: expectedLabel,
    };
  }

  // incorrect
  const specific = round.misconceptions && round.misconceptions[result.evidence.chosen];
  const paragraphs = [specific && specific.text ? specific.text : genericWrong(level, round, result)];
  const reveals = wrongAttempts >= 2;
  if (reveals) {
    paragraphs.push(`The correct gate is ${expectedLabel}. Select it and submit to finish this round.`);
    paragraphs.push(...correctParagraphs(level, round, result));
  } else {
    paragraphs.push(methodNudge(level, round));
  }
  return {
    tone: 'bad',
    headline: 'Not quite — that packet was dropped',
    paragraphs,
    revealsGate: reveals,
    gateLabel: reveals ? expectedLabel : null,
  };
}
