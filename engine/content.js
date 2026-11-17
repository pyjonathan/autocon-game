// Validates the whole authored content document before any challenge is shown.
// A content error names the level and round, is never graded, and never counts as an attempt.
import { isValidMac, isGroupMac, isValidIpv4, prefixesOverlap, normalizeMac } from './net.js';
import { resolve, SPECIAL_GATES } from './rules.js';

export const SUPPORTED_SCHEMA_VERSIONS = [1];
const DEVICES = ['switch', 'router', 'firewall'];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.trim() !== '';
const isInt = (v) => Number.isInteger(v);

export function formatError(e) {
  const where = [];
  if (e.levelId) where.push(`level "${e.levelId}"`);
  if (e.roundId) where.push(`round "${e.roundId}"`);
  return `${where.length ? `${where.join(', ')}: ` : ''}${e.message}`;
}

export function validateDocument(doc) {
  const errors = [];
  const add = (levelId, roundId, message) => errors.push({ levelId: levelId || null, roundId: roundId || null, message });

  if (!isObj(doc)) {
    add(null, null, 'content file is not an object');
    return { valid: false, errors };
  }
  if (!isInt(doc.schemaVersion) || !SUPPORTED_SCHEMA_VERSIONS.includes(doc.schemaVersion)) {
    add(null, null, `schemaVersion must be a supported integer (${SUPPORTED_SCHEMA_VERSIONS.join(', ')})`);
  }

  // ---- sources ----
  const sourceIds = new Set();
  if (!Array.isArray(doc.sources)) {
    add(null, null, 'sources must be a list');
  } else {
    for (const s of doc.sources) {
      if (!isObj(s) || !isStr(s.id) || !isStr(s.title) || !isStr(s.url) || !isStr(s.section) || !isStr(s.claim)) {
        add(null, null, `source ${isObj(s) && s.id ? `"${s.id}" ` : ''}needs id, title, url, section, and claim`);
        continue;
      }
      if (sourceIds.has(s.id)) add(null, null, `duplicate source ID "${s.id}"`);
      sourceIds.add(s.id);
    }
  }

  // ---- levels ----
  if (!Array.isArray(doc.levels) || doc.levels.length < 1) {
    add(null, null, 'levels must be a list with at least 1 level');
    return { valid: errors.length === 0, errors };
  }

  const levelIds = new Set();
  const roundIds = new Set();

  for (const level of doc.levels) {
    const lid = isObj(level) && level.id ? String(level.id) : '(missing id)';
    if (!isObj(level)) { add(null, null, 'a level is not an object'); continue; }
    if (!isStr(level.id)) add(lid, null, 'level needs a non-empty id');
    else if (levelIds.has(level.id)) add(lid, null, `duplicate level ID "${level.id}"`);
    levelIds.add(level.id);

    if (!isStr(level.title)) add(lid, null, 'title is required');
    if (!isStr(level.outcome)) add(lid, null, 'outcome is required');
    if (!DEVICES.includes(level.device)) {
      add(lid, null, `device must be one of ${DEVICES.join(', ')}`);
      continue;
    }

    // briefing
    const b = level.briefing;
    if (!isObj(b) || !isStr(b.intro) || !isStr(b.reads) || !Array.isArray(b.terms) || !isObj(b.example)
      || !isStr(b.example.heading) || !isStr(b.example.text) || !Array.isArray(b.boundaries)) {
      add(lid, null, 'briefing needs intro, reads, terms, example (heading, text), and boundaries');
    }

    // sources
    if (!Array.isArray(level.sourceIds)) add(lid, null, 'sourceIds must be a list');
    else for (const sid of level.sourceIds) if (!sourceIds.has(sid)) add(lid, null, `unknown source ID "${sid}"`);

    // table
    const tableOk = validateTable(level, lid, add);

    // rounds
    if (!Array.isArray(level.rounds) || level.rounds.length < 1) {
      add(lid, null, 'rounds must be a list with at least 1 round');
      continue;
    }
    for (const round of level.rounds) {
      validateRound(level, lid, round, tableOk, roundIds, add);
    }
  }

  return { valid: errors.length === 0, errors };
}

function uniqueIds(items, kind, lid, add) {
  const seen = new Set();
  for (const item of items) {
    if (!isObj(item) || !isStr(item.id)) { add(lid, null, `${kind} needs a non-empty id`); continue; }
    if (seen.has(item.id)) add(lid, null, `duplicate ${kind} ID "${item.id}"`);
    seen.add(item.id);
  }
  return seen;
}

function validateTable(level, lid, add) {
  const t = level.table;
  if (!isObj(t)) { add(lid, null, 'table is required'); return false; }
  let ok = true;
  const fail = (msg) => { add(lid, null, msg); ok = false; };

  if (level.device === 'switch') {
    if (!Array.isArray(t.ports) || !Array.isArray(t.macEntries)) { fail('switch table needs ports and macEntries'); return false; }
    const portIds = uniqueIds(t.ports, 'port', lid, add);
    const macs = new Set();
    for (const e of t.macEntries) {
      if (!isObj(e) || !isValidMac(e.mac)) fail('MAC table entry has an invalid MAC (six two-digit hex groups, colon-separated)');
      else {
        if (macs.has(normalizeMac(e.mac))) fail(`duplicate MAC table entry for ${e.mac}`);
        macs.add(normalizeMac(e.mac));
      }
      if (!isObj(e) || !portIds.has(e.portId)) fail(`MAC table entry refers to unknown port "${isObj(e) ? e.portId : ''}"`);
    }
  } else if (level.device === 'router') {
    if (!Array.isArray(t.interfaces) || !Array.isArray(t.routes)) { fail('router table needs interfaces and routes'); return false; }
    const ifaceIds = uniqueIds(t.interfaces, 'interface', lid, add);
    for (const i of t.interfaces) {
      if (isObj(i) && (!isValidIpv4(i.address) || !isInt(i.prefixLength) || i.prefixLength < 0 || i.prefixLength > 30)) {
        fail(`interface "${i.id}" needs a valid IPv4 address and a prefix length from 0 to 30`);
      }
    }
    let defaults = 0;
    for (const r of t.routes) {
      if (!isObj(r) || !isValidIpv4(r.prefix)) { fail('route has an invalid IPv4 prefix'); continue; }
      if (!isInt(r.prefixLength) || r.prefixLength < 0 || r.prefixLength > 30) {
        fail(`route ${r.prefix}/${r.prefixLength} must have a prefix length from 0 to 30 (31 and 32 are not supported)`);
      }
      if (!ifaceIds.has(r.interfaceId)) fail(`route ${r.prefix}/${r.prefixLength} refers to unknown interface "${r.interfaceId}"`);
      if (r.nextHop !== undefined && !isValidIpv4(r.nextHop)) fail(`route ${r.prefix}/${r.prefixLength} has an invalid next hop`);
      if (r.prefixLength === 0) defaults++;
    }
    if (defaults === 0) fail('router table has no default route (0.0.0.0/0)');
    if (defaults > 1) fail('router table has more than one default route');
    const specific = t.routes.filter((r) => isObj(r) && r.prefixLength > 0 && isValidIpv4(r.prefix));
    for (let i = 0; i < specific.length; i++) {
      for (let j = i + 1; j < specific.length; j++) {
        if (prefixesOverlap(specific[i].prefix, specific[i].prefixLength, specific[j].prefix, specific[j].prefixLength)) {
          fail(`overlapping non-default prefixes ${specific[i].prefix}/${specific[i].prefixLength} and ${specific[j].prefix}/${specific[j].prefixLength} are not supported`);
        }
      }
    }
  } else if (level.device === 'firewall') {
    if (!Array.isArray(t.rules)) { fail('firewall table needs rules'); return false; }
    uniqueIds(t.rules, 'rule', lid, add);
    for (const rule of t.rules) {
      if (!isObj(rule)) continue;
      if (!['PERMIT', 'DENY'].includes(rule.action)) fail(`rule "${rule.id}" action must be PERMIT or DENY`);
      if (!['TCP', 'UDP'].includes(rule.protocol)) fail(`rule "${rule.id}" protocol must be TCP or UDP`);
      const portOk = rule.dstPort === 'any' || (isInt(rule.dstPort) && rule.dstPort >= 1 && rule.dstPort <= 65535);
      if (!portOk) fail(`rule "${rule.id}" destination port must be an integer 1–65535 or "any"`);
    }
  }
  return ok;
}

function validateRound(level, lid, round, tableOk, roundIds, add) {
  const rid = isObj(round) && round.id ? String(round.id) : '(missing id)';
  const err = (msg) => add(lid, rid, msg);
  if (!isObj(round)) { add(lid, null, 'a round is not an object'); return; }
  if (!isStr(round.id)) err('round needs a non-empty id');
  else if (roundIds.has(round.id)) err(`duplicate round ID "${round.id}"`);
  roundIds.add(round.id);

  if (!isStr(round.title) || !isStr(round.prompt)) err('round needs a title and a prompt');

  // packet
  const p = round.packet;
  let packetOk = true;
  if (!isObj(p)) { err('packet is required'); packetOk = false; } else {
    if (!isValidMac(p.srcMac)) { err('srcMac must be six two-digit hex groups, colon-separated'); packetOk = false; }
    if (!isValidMac(p.dstMac)) { err('dstMac must be six two-digit hex groups, colon-separated'); packetOk = false; }
    if (!isValidIpv4(p.srcIp)) { err('srcIp must be dotted-quad IPv4 with each octet 0–255'); packetOk = false; }
    if (!isValidIpv4(p.dstIp)) { err('dstIp must be dotted-quad IPv4 with each octet 0–255'); packetOk = false; }
    if (!['TCP', 'UDP'].includes(p.protocol)) { err('protocol must be TCP or UDP'); packetOk = false; }
    if (!isInt(p.dstPort) || p.dstPort < 1 || p.dstPort > 65535) { err('dstPort must be an integer 1–65535'); packetOk = false; }
    if (!isInt(p.ttl) || p.ttl < 2 || p.ttl > 255) { err('ttl must be an integer 2–255 (TTL below 2 is not supported)'); packetOk = false; }
  }

  // ingress (switch and router)
  const t = level.table || {};
  if (level.device === 'switch' || level.device === 'router') {
    const ids = (level.device === 'switch' ? t.ports : t.interfaces) || [];
    if (!ids.some((x) => isObj(x) && x.id === round.ingress)) err(`ingress "${round.ingress}" is not a known ${level.device === 'switch' ? 'port' : 'interface'}`);
  }

  // switch-specific rules
  if (level.device === 'switch' && packetOk && Array.isArray(t.macEntries)) {
    if (isGroupMac(p.dstMac)) err('destination MAC is a broadcast or multicast address, which is not supported');
    const entry = t.macEntries.find((e) => isObj(e) && normalizeMac(e.mac) === normalizeMac(p.dstMac));
    if (entry && entry.portId === round.ingress) err('the destination MAC is mapped to the ingress port, which is not supported');
  }

  // router display
  if (level.device === 'router') {
    const d = round.display;
    if (!isObj(d) || !isValidMac(d.rewrittenSrcMac) || !isValidMac(d.rewrittenDstMac)) {
      err('router rounds need display.rewrittenSrcMac and display.rewrittenDstMac (valid MACs)');
    }
  }

  // help
  const h = round.help;
  if (!isObj(h) || !isStr(h.method) || !Array.isArray(h.steps) || h.steps.length === 0 || !h.steps.every(isStr)) {
    err('help needs a method and a non-empty list of steps');
  }

  // gates
  if (!Array.isArray(round.gates) || round.gates.length < 2) {
    err('gates must be a list of at least 2 gates');
    return;
  }
  const gateIds = new Set();
  for (const g of round.gates) {
    if (!isObj(g) || !isStr(g.id) || !isStr(g.label)) { err('each gate needs an id and a label'); continue; }
    if (gateIds.has(g.id)) err(`duplicate gate ID "${g.id}"`);
    gateIds.add(g.id);
  }
  const allowed = new Set(SPECIAL_GATES[level.device] || []);
  const tableItems = level.device === 'switch' ? t.ports : level.device === 'router' ? t.interfaces : t.rules;
  if (Array.isArray(tableItems)) for (const item of tableItems) if (isObj(item)) allowed.add(item.id);
  for (const id of gateIds) if (!allowed.has(id)) err(`gate "${id}" is not in the ${level.device}'s table`);

  // misconceptions
  if (round.misconceptions !== undefined) {
    if (!isObj(round.misconceptions)) err('misconceptions must be an object');
    else for (const [gid, m] of Object.entries(round.misconceptions)) {
      if (!gateIds.has(gid)) err(`misconception refers to gate "${gid}", which is not in this round`);
      if (!isObj(m) || !isStr(m.text)) err(`misconception for gate "${gid}" needs text`);
    }
  }

  // The evaluator must be able to resolve the round, and its answer must be offered as a gate.
  if (tableOk && packetOk) {
    const resolved = resolve(level, round);
    if (resolved.error) err(`cannot be graded: ${resolved.error}`);
    else if (!gateIds.has(resolved.expected.gateId)) err(`the correct gate "${resolved.expected.gateId}" is missing from the gate list`);
  }
}
