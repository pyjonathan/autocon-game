// Rendering: turns session state into HTML strings. No state changes happen here.
import { currentLevel, currentRound, currentProgress, roundNumber, totalRounds, summary } from '../engine/state.js';
import { resolve } from '../engine/rules.js';

export function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const HEADER_FIELDS = [
  ['Source MAC', 'srcMac'],
  ['Destination MAC', 'dstMac'],
  ['Source IP', 'srcIp'],
  ['Destination IP', 'dstIp'],
  ['Protocol', 'protocol'],
  ['Destination port', 'dstPort'],
  ['TTL', 'ttl'],
];

// ---- Loading and error ----------------------------------------------------
export function loadingHtml() {
  return '<p role="status">Loading the game…</p>';
}

export function errorHtml(messages, kind) {
  const intro = kind === 'content'
    ? 'The game content has a problem, so nothing can be played or graded. This is an authoring error and does not count against you.'
    : 'The game could not load its content. Check that you opened it through a web server (not file://), then try again.';
  return `
    <section aria-labelledby="error-heading">
      <h2 id="error-heading" tabindex="-1">Challenge unavailable</h2>
      <p>${esc(intro)}</p>
      <ul>${messages.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
      <div class="actions"><button type="button" data-action="reload">Try loading again</button></div>
    </section>`;
}

// ---- Briefing -------------------------------------------------------------
function sourcesHtml(session, level) {
  const items = (level.sourceIds || [])
    .map((id) => session.doc.sources.find((s) => s.id === id))
    .filter(Boolean)
    .map((s) => {
      const section = s.unconfirmed ? '' : ` — ${esc(s.section)}`;
      return `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>${section}. ${esc(s.claim)}</li>`;
    })
    .join('');
  return items ? `<h3>Sources</h3><ul class="sources">${items}</ul>` : '';
}

export function briefingHtml(session) {
  const level = currentLevel(session);
  const b = level.briefing;
  return `
    <section class="briefing" aria-labelledby="screen-heading">
      <p class="crumb">Level ${session.levelIndex + 1} of ${session.doc.levels.length}</p>
      <h2 id="screen-heading" tabindex="-1">${esc(level.title)}</h2>
      <p>${esc(b.intro)}</p>
      <div class="callout"><strong>What this device reads:</strong> ${esc(b.reads)}</div>
      <h3>Terms</h3>
      <dl>${b.terms.map((t) => `<dt>${esc(t.term)}</dt><dd>${esc(t.definition)}</dd>`).join('')}</dl>
      <div class="callout"><strong>${esc(b.example.heading)}.</strong> ${esc(b.example.text)}</div>
      <h3>What this game simplifies</h3>
      <ul>${b.boundaries.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      ${sourcesHtml(session, level)}
      <div class="actions">
        <button type="button" data-action="continue">Start ${esc(level.title.split('·')[0].trim())}</button>
        <button type="button" class="secondary" data-action="restart">Restart</button>
      </div>
    </section>`;
}

// ---- Challenge ------------------------------------------------------------
function portLabel(level, id) {
  const t = level.table;
  const found = (t.ports || t.interfaces || []).find((p) => p.id === id);
  return found ? found.label : id;
}

function headerChips(packet, previous) {
  return HEADER_FIELDS.map(([label, key]) => {
    const value = packet[key];
    const was = previous && previous[key] !== value ? previous[key] : null;
    return `<div class="chip${was !== null ? ' changed' : ''}"><dt>${label}</dt><dd>${esc(value)}</dd>${
      was !== null ? `<span class="was">was ${esc(was)}</span>` : ''}</div>`;
  }).join('');
}

function tableHtml(level, round) {
  const t = level.table;
  if (level.device === 'switch') {
    return `
      <div class="table-scroll" role="region" aria-label="${esc(t.name)} MAC table" tabindex="0">
        <table>
          <caption>${esc(t.name)} · MAC table (already learned). The frame arrives on ${esc(portLabel(level, round.ingress))}.</caption>
          <thead><tr><th scope="col">MAC address</th><th scope="col">Port</th></tr></thead>
          <tbody>${t.macEntries.map((e) => `<tr><td>${esc(e.mac)}</td><td>${esc(portLabel(level, e.portId))}</td></tr>`).join('')}</tbody>
        </table>
      </div>
      <p class="crumb">Ports on ${esc(t.name)}: ${t.ports.map((p) => esc(p.label)).join(', ')}.</p>`;
  }
  if (level.device === 'router') {
    const routes = t.routes.map((r) => {
      const type = r.prefixLength === 0 ? 'Default route' : 'Connected';
      return `<tr><td>${esc(r.prefix)}/${r.prefixLength}</td><td>${esc(portLabel(level, r.interfaceId))}</td><td>${esc(r.nextHop || '—')}</td><td>${type}</td></tr>`;
    }).join('');
    return `
      <div class="table-scroll" role="region" aria-label="${esc(t.name)} routing table" tabindex="0">
        <table>
          <caption>${esc(t.name)} · Routing table. The packet arrives on ${esc(portLabel(level, round.ingress))}.</caption>
          <thead><tr><th scope="col">Prefix</th><th scope="col">Exit interface</th><th scope="col">Next hop</th><th scope="col">Type</th></tr></thead>
          <tbody>${routes}</tbody>
        </table>
      </div>
      <div class="table-scroll" role="region" aria-label="${esc(t.name)} interfaces" tabindex="0" style="margin-top:.6rem">
        <table>
          <caption>${esc(t.name)} · Interfaces</caption>
          <thead><tr><th scope="col">Interface</th><th scope="col">Address</th></tr></thead>
          <tbody>${t.interfaces.map((i) => `<tr><td>${esc(i.label)}</td><td>${esc(i.address)}/${i.prefixLength}</td></tr>`).join('')}</tbody>
        </table>
      </div>`;
  }
  const rules = t.rules.map((r, i) =>
    `<tr><td>${i + 1}</td><td>${esc(r.action)}</td><td>${esc(r.protocol)}</td><td>${r.dstPort === 'any' ? 'any' : esc(r.dstPort)}</td></tr>`).join('');
  return `
    <div class="table-scroll" role="region" aria-label="${esc(t.name)} rules" tabindex="0">
      <table>
        <caption>${esc(t.name)} · Rules, checked from top to bottom. The first match decides.</caption>
        <thead><tr><th scope="col">Rule</th><th scope="col">Action</th><th scope="col">Protocol</th><th scope="col">Destination port</th></tr></thead>
        <tbody>${rules}<tr><td>end</td><td>DENY</td><td colspan="2">Implicit deny: used only if no rule above matches</td></tr></tbody>
      </table>
    </div>`;
}

function diagramHtml(level, round, ui) {
  const gates = round.gates.length;
  const label = `Diagram: your packet travels along a wire toward ${level.table.name}, which has ${gates} gates to choose from. The same information is listed in the tables below.`;
  return `
    <div class="wire">
      <svg viewBox="0 0 600 90" role="img" aria-label="${esc(label)}">
        <line x1="90" y1="45" x2="440" y2="45" stroke="#5cc8ff" stroke-width="4" stroke-dasharray="10 6"/>
        <g class="packet-shape${ui.animate === 'fragment' ? ' fragment' : ''}">
          <rect x="10" y="22" width="80" height="46" rx="8" fill="#5cc8ff"/>
          <text x="50" y="50" text-anchor="middle" font-size="14" font-weight="700" fill="#06121f">PACKET</text>
        </g>
        <rect x="440" y="10" width="150" height="70" rx="10" fill="#1c2d49" stroke="#5cc8ff" stroke-width="2"/>
        <text x="515" y="40" text-anchor="middle" font-size="16" font-weight="700" fill="#f2f6fc">${esc(level.table.name)}</text>
        <text x="515" y="62" text-anchor="middle" font-size="12" fill="#b4c2d8">${gates} gates</text>
      </svg>
    </div>`;
}

export function challengeHtml(session, ui) {
  const level = currentLevel(session);
  const round = currentRound(session);
  const progress = currentProgress(session);
  const sum = summary(session);
  const solved = progress.solved;
  const fb = session.feedback;
  const revealed = fb && fb.revealsGate ? fb.gateLabel : null;

  const gates = round.gates.map((g) => `
    <label class="gate${revealed === g.label ? ' revealed' : ''}">
      <input type="radio" name="gate" value="${esc(g.id)}"${ui.selected === g.id ? ' checked' : ''}${solved ? ' disabled' : ''}>
      <span>${esc(g.label)}</span>
    </label>`).join('');

  const solvedRouter = solved && level.device === 'router' && round.display;
  const after = solvedRouter
    ? `<h3>Your packet after the hop</h3>
       <dl class="header-grid" aria-label="Packet header after the hop">${headerChips(
    { ...round.packet, srcMac: round.display.rewrittenSrcMac, dstMac: round.display.rewrittenDstMac, ttl: round.packet.ttl - 1 },
    round.packet)}</dl>
       <p class="crumb">Changed fields are marked. The IP addresses stay the same.</p>`
    : '';

  return `
    <section aria-labelledby="screen-heading">
      <p class="crumb">${esc(level.title)} · Round ${session.roundIndex + 1} of ${level.rounds.length}</p>
      <h2 id="screen-heading" tabindex="-1">${esc(round.title)}</h2>
      <p>${esc(round.prompt)}</p>

      <ul class="stats" aria-label="Progress">
        <li>Round <strong>${roundNumber(session)}</strong> of ${totalRounds(session)}</li>
        <li>Attempts on this round: <strong>${progress.attempts}</strong></li>
        <li class="dropped${ui.animate === 'fragment' ? ' bump' : ''}">Dropped packets: <strong>${session.droppedPackets}</strong></li>
        <li>Rounds solved: <strong>${sum.completedRounds}</strong> of ${sum.totalRounds}</li>
      </ul>

      ${diagramHtml(level, round, ui)}

      <h3>Your packet</h3>
      <dl class="header-grid" aria-label="Packet header">${headerChips(round.packet, null)}</dl>

      <h3>${esc(level.table.name)}</h3>
      ${tableHtml(level, round)}

      <form id="gate-form" novalidate>
        <fieldset class="gates">
          <legend>Choose the exit gate</legend>
          <div class="gate-list">${gates}</div>
        </fieldset>
        <div class="actions">
          <button type="submit"${solved ? ' disabled' : ''}>Submit</button>
          ${solved ? '' : '<button type="button" class="secondary" data-action="help">Help</button>'}
          ${session.view === 'feedback' && !solved ? '<button type="button" class="secondary" data-action="retry">Try again</button>' : ''}
          ${solved ? '<button type="button" data-action="next">Next</button>' : ''}
          <button type="button" class="secondary" data-action="restart">Restart</button>
        </div>
      </form>
      ${after}
    </section>`;
}

// ---- Explanation region ----------------------------------------------------
export function explanationHtml(session) {
  if (session.view !== 'awaiting-answer' && session.view !== 'feedback') return '';
  const progress = currentProgress(session);
  const round = currentRound(session);
  const parts = [];
  const fb = session.feedback;
  if (fb) {
    const tone = fb.tone === 'good' ? 'good' : fb.tone === 'bad' ? 'bad' : 'info';
    parts.push(`<div class="note ${tone}">
      <h3 id="fb-heading" tabindex="-1">${esc(fb.headline)}</h3>
      ${fb.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}
    </div>`);
  }
  if (progress.helpRevealed && !progress.solved) {
    const resolved = resolve(currentLevel(session), round);
    const gate = resolved.error ? null : round.gates.find((g) => g.id === resolved.expected.gateId);
    parts.push(`<div class="note info">
      <h3>Help</h3>
      <p><strong>Method.</strong> ${esc(round.help.method)}</p>
      <ol>${round.help.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      <p class="reveal">The correct gate is ${esc(gate ? gate.label : '')}. Select it and submit to finish this round.</p>
      <p class="crumb">Using Help is recorded as assistance. It does not solve the round.</p>
    </div>`);
  }
  return parts.join('');
}

// ---- Summary --------------------------------------------------------------
export function summaryHtml(session) {
  const sum = summary(session);
  const perLevel = session.doc.levels.map((level) => {
    const solved = level.rounds.filter((r) => session.rounds[r.id].solved).length;
    const assisted = level.rounds.filter((r) => session.rounds[r.id].assisted).length;
    return `<tr><td>${esc(level.title)}</td><td>${solved} of ${level.rounds.length}</td><td>${assisted}</td></tr>`;
  }).join('');
  const reads = {
    switch: 'Destination MAC address',
    router: 'Destination IP address (it also rewrites the MAC addresses and subtracts 1 from TTL)',
    firewall: 'Protocol and destination port (first match wins; no match means implicit deny)',
  };
  const recap = session.doc.levels.map((l) => `<tr><td>${esc(l.table.name)} (${esc(l.device)})</td><td>${esc(reads[l.device] || '')}</td></tr>`).join('');
  return `
    <section aria-labelledby="screen-heading">
      <h2 id="screen-heading" tabindex="-1">Run complete</h2>
      <p>You got the packet through every device. Here is your session, with each count shown separately.</p>
      <ul class="summary-grid">
        <li><span class="big">${sum.completedRounds} of ${sum.totalRounds}</span>Completed rounds</li>
        <li><span class="big">${sum.attempts}</span>Valid attempts</li>
        <li><span class="big">${sum.droppedPackets}</span>Dropped packets (wrong answers)</li>
        <li><span class="big">${sum.roundsAssisted} of ${sum.totalRounds}</span>Rounds assisted (Help used or gate revealed)</li>
      </ul>
      <p class="crumb">Completing every round is not proof of independent mastery. Rounds where help was used are counted separately.</p>
      <div class="table-scroll" role="region" aria-label="Results by level" tabindex="0">
        <table>
          <caption>Results by level</caption>
          <thead><tr><th scope="col">Level</th><th scope="col">Rounds solved</th><th scope="col">Rounds assisted</th></tr></thead>
          <tbody>${perLevel}</tbody>
        </table>
      </div>
      <h3>What each device reads</h3>
      <div class="table-scroll" role="region" aria-label="What each device reads" tabindex="0">
        <table>
          <thead><tr><th scope="col">Device</th><th scope="col">Reads</th></tr></thead>
          <tbody>${recap}</tbody>
        </table>
      </div>
      <div class="actions"><button type="button" data-action="restart">Play again</button></div>
    </section>`;
}

export function screenHtml(session, ui) {
  switch (session.view) {
    case 'briefing': return briefingHtml(session);
    case 'summary': return summaryHtml(session);
    default: return challengeHtml(session, ui);
  }
}
