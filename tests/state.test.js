// Session-state tests (T016 and T023): attempts, dropped packets, assistance, duplicate submit,
// the "2nd wrong attempt names the gate" rule, progression, summary, and restart.
import { test, assert, eq } from './harness.js';
import * as S from '../engine/state.js';
import { makeFixtureDocument } from './fixtures.js';

function fresh() {
  const s = S.createSession(makeFixtureDocument());
  S.continueFromBriefing(s); // on L1R1, awaiting an answer
  return s;
}

const progress = (s, roundId) => s.rounds[roundId];

// ---- Basics ---------------------------------------------------------------
test('a fresh session starts at the first briefing before any challenge', () => {
  const s = S.createSession(makeFixtureDocument());
  eq(s.view, 'briefing');
  eq(s.levelIndex, 0);
  eq(s.roundIndex, 0);
  eq(S.summary(s).completedRounds, 0);
});

test('selecting nothing never changes state: empty submit is invalid-input, no counters move', () => {
  const s = fresh();
  const out = S.submit(s, '');
  eq(out.status, 'invalid-input');
  eq(progress(s, 'l1r1').attempts, 0);
  eq(progress(s, 'l1r1').wrongAttempts, 0);
  eq(s.droppedPackets, 0);
  eq(progress(s, 'l1r1').solved, false);
  eq(s.view, 'awaiting-answer');
});

test('an unknown gate is invalid-input and does not count as an attempt', () => {
  const s = fresh();
  eq(S.submit(s, 'gi0-9').status, 'invalid-input');
  eq(progress(s, 'l1r1').attempts, 0);
  eq(s.droppedPackets, 0);
});

// ---- Wrong answers ---------------------------------------------------------
test('a valid wrong answer adds 1 attempt, 1 wrong attempt, 1 dropped packet; round stays unsolved', () => {
  const s = fresh();
  const out = S.submit(s, 'gi0-1');
  eq(out.status, 'incorrect');
  eq(progress(s, 'l1r1').attempts, 1);
  eq(progress(s, 'l1r1').wrongAttempts, 1);
  eq(s.droppedPackets, 1);
  eq(progress(s, 'l1r1').solved, false);
  eq(progress(s, 'l1r1').assisted, false);
});

test('the 1st wrong attempt does not name the correct gate', () => {
  const s = fresh();
  const out = S.submit(s, 'gi0-1');
  eq(out.feedback.revealsGate, false);
  assert(!out.feedback.paragraphs.join(' ').includes('Gi0/3'), 'feedback must not name Gi0/3 on the 1st wrong attempt');
  eq(progress(s, 'l1r1').assisted, false);
});

test('the 2nd wrong attempt names the correct gate and marks the round assisted, but does not solve it', () => {
  const s = fresh();
  S.submit(s, 'gi0-1');
  const out = S.submit(s, 'gi0-2');
  eq(out.status, 'incorrect');
  eq(out.feedback.revealsGate, true);
  assert(out.feedback.paragraphs.join(' ').includes('Gi0/3'), 'feedback should name Gi0/3');
  eq(progress(s, 'l1r1').assisted, true);
  eq(progress(s, 'l1r1').solved, false);
  eq(progress(s, 'l1r1').attempts, 2);
  eq(s.droppedPackets, 2);
});

test('every later wrong attempt also names the correct gate', () => {
  const s = fresh();
  S.submit(s, 'gi0-1');
  S.submit(s, 'gi0-2');
  const out = S.submit(s, 'gi0-4');
  eq(out.feedback.revealsGate, true);
  eq(progress(s, 'l1r1').assisted, true);
  eq(progress(s, 'l1r1').assisted, true);
});

test('after the gate is named, the player still has to select and submit it to solve the round', () => {
  const s = fresh();
  S.submit(s, 'gi0-1');
  S.submit(s, 'gi0-2');
  eq(progress(s, 'l1r1').solved, false);
  const out = S.submit(s, 'gi0-3');
  eq(out.status, 'correct');
  eq(progress(s, 'l1r1').solved, true);
  eq(progress(s, 'l1r1').attempts, 3);
});

// ---- Correct answers and duplicate submit ---------------------------------
test('a valid correct answer adds 1 attempt, solves the round, and does not add dropped packets', () => {
  const s = fresh();
  const out = S.submit(s, 'gi0-3');
  eq(out.status, 'correct');
  eq(progress(s, 'l1r1').attempts, 1);
  eq(progress(s, 'l1r1').solved, true);
  eq(s.droppedPackets, 0);
  eq(s.view, 'feedback');
});

test('submitting again after success changes nothing (duplicate submit guard)', () => {
  const s = fresh();
  S.submit(s, 'gi0-3');
  const before = JSON.stringify(s.rounds);
  const dropped = s.droppedPackets;
  const out = S.submit(s, 'gi0-3');
  eq(out.status, 'ignored');
  eq(JSON.stringify(s.rounds), before);
  eq(s.droppedPackets, dropped);
  const wrong = S.submit(s, 'gi0-1');
  eq(wrong.status, 'ignored');
  eq(JSON.stringify(s.rounds), before);
  eq(s.droppedPackets, dropped);
});

test('submit is ignored while the briefing is showing', () => {
  const s = S.createSession(makeFixtureDocument());
  eq(S.submit(s, 'gi0-3').status, 'ignored');
  eq(progress(s, 'l1r1').attempts, 0);
});

test('a content error is never graded and never counts', () => {
  const doc = makeFixtureDocument();
  doc.levels[0].table.macEntries = 'broken';
  const s = S.createSession(doc);
  S.continueFromBriefing(s);
  const out = S.submit(s, 'gi0-3');
  eq(out.status, 'content-error');
  eq(progress(s, 'l1r1').attempts, 0);
  eq(s.droppedPackets, 0);
});

// ---- Help ------------------------------------------------------------------
test('Help marks the round assisted without solving it, and does not submit an answer', () => {
  const s = fresh();
  const help = S.useHelp(s);
  eq(help.ok, true);
  eq(progress(s, 'l1r1').assisted, true);
  eq(progress(s, 'l1r1').solved, false);
  eq(progress(s, 'l1r1').attempts, 0);
  eq(s.droppedPackets, 0);
  assert(help.gateLabel === 'Gi0/3', 'Help reveals the gate from the evaluator');
});

test('using Help twice still counts one assisted round', () => {
  const s = fresh();
  S.useHelp(s);
  S.useHelp(s);
  eq(S.summary(s).roundsAssisted, 1);
});

test('Help is rejected on a solved round and does not change its assisted status', () => {
  const s = fresh();
  S.submit(s, 'gi0-3');
  eq(progress(s, 'l1r1').assisted, false);
  const help = S.useHelp(s);
  eq(help.ok, false);
  eq(progress(s, 'l1r1').assisted, false);
});

test('Help is rejected while a briefing is showing', () => {
  const s = S.createSession(makeFixtureDocument());
  eq(S.useHelp(s).ok, false);
});

test('Help is allowed while wrong-answer feedback is showing', () => {
  const s = fresh();
  S.submit(s, 'gi0-1');
  eq(s.view, 'feedback');
  eq(S.useHelp(s).ok, true);
  eq(progress(s, 'l1r1').assisted, true);
});

// ---- Progression ----------------------------------------------------------
function solve(s, answers) {
  for (const a of answers) {
    eq(S.submit(s, a).status, 'correct');
    S.next(s);
    if (s.view === 'briefing') S.continueFromBriefing(s);
  }
}

test('Next is refused until the round is solved', () => {
  const s = fresh();
  S.submit(s, 'gi0-1');
  eq(S.next(s).ok, false);
  eq(s.roundIndex, 0);
});

test('Next moves to the next round, then to the next level briefing, then to the summary', () => {
  const s = fresh();
  eq(S.submit(s, 'gi0-3').status, 'correct');
  eq(S.next(s).ok, true);
  eq(s.view, 'awaiting-answer');
  eq(s.roundIndex, 1);
  eq(S.isLevelComplete(s, 0), false);
  eq(S.submit(s, 'flood').status, 'correct');
  eq(S.isLevelComplete(s, 0), true);
  S.next(s);
  eq(s.view, 'briefing');
  eq(s.levelIndex, 1);
  eq(s.roundIndex, 0);
});

test('finishing all six rounds opens the summary with separate counts', () => {
  const s = fresh();
  S.submit(s, 'gi0-1'); // 1 wrong on l1r1
  solve(s, ['gi0-3', 'flood', 'gi0-1', 'gi0-2', 'rule-1', 'implicit-deny']);
  eq(s.view, 'summary');
  const sum = S.summary(s);
  eq(sum.completedRounds, 6);
  eq(sum.totalRounds, 6);
  eq(sum.attempts, 7);          // 6 correct + 1 wrong
  eq(sum.droppedPackets, 1);
  eq(sum.roundsAssisted, 0);
});

test('the summary reports rounds assisted once per round', () => {
  const s = fresh();
  S.useHelp(s);                  // l1r1 assisted via Help
  S.submit(s, 'gi0-1');
  S.submit(s, 'gi0-2');          // 2nd wrong: auto-reveal, still the same round
  solve(s, ['gi0-3', 'flood', 'gi0-1', 'gi0-2', 'rule-1', 'implicit-deny']);
  eq(S.summary(s).roundsAssisted, 1);
});

// ---- Restart -------------------------------------------------------------
test('Restart asks for confirmation; cancelling changes nothing', () => {
  const s = fresh();
  S.submit(s, 'gi0-1');
  S.requestRestart(s);
  eq(s.pendingRestart, true);
  const snapshot = JSON.stringify({ r: s.rounds, d: s.droppedPackets, v: s.view, l: s.levelIndex, i: s.roundIndex });
  S.cancelRestart(s);
  eq(s.pendingRestart, false);
  eq(JSON.stringify({ r: s.rounds, d: s.droppedPackets, v: s.view, l: s.levelIndex, i: s.roundIndex }), snapshot);
});

test('Confirming Restart clears all counters and returns to the first briefing', () => {
  const s = fresh();
  S.submit(s, 'gi0-1');
  S.useHelp(s);
  S.requestRestart(s);
  S.confirmRestart(s);
  eq(s.view, 'briefing');
  eq(s.levelIndex, 0);
  eq(s.roundIndex, 0);
  eq(s.droppedPackets, 0);
  eq(s.pendingRestart, false);
  const sum = S.summary(s);
  eq(sum.attempts, 0);
  eq(sum.roundsAssisted, 0);
  eq(sum.completedRounds, 0);
});

test('Restart cannot be confirmed without being requested first', () => {
  const s = fresh();
  S.submit(s, 'gi0-1');
  S.confirmRestart(s);
  eq(progress(s, 'l1r1').attempts, 1);
});

test('selecting a gate is not a state operation: only submit changes counters', () => {
  const s = fresh();
  const before = JSON.stringify(s.rounds) + s.droppedPackets;
  // There is intentionally no select() in the state module; the UI keeps the selection.
  assert(typeof S.select === 'undefined', 'state must not expose a select() that could change counters');
  eq(JSON.stringify(s.rounds) + s.droppedPackets, before);
});
