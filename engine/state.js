// Session state: the only module that changes counters, completion, and the current view.
// In memory only; a reload starts a fresh session (FR-019).
import { evaluate, resolve } from './rules.js';
import { explain } from './feedback.js';

function emptyProgress() {
  return { solved: false, attempts: 0, wrongAttempts: 0, assisted: false, helpRevealed: false };
}

function freshFields(doc) {
  const rounds = {};
  for (const level of doc.levels) for (const round of level.rounds) rounds[round.id] = emptyProgress();
  return {
    view: 'briefing',          // briefing | awaiting-answer | feedback | summary
    levelIndex: 0,
    roundIndex: 0,
    rounds,
    droppedPackets: 0,         // display only; never ends the game or limits retries
    pendingRestart: false,
    feedback: null,            // last explanation shown, or null
    lastStatus: null,
  };
}

export function createSession(doc) {
  return { doc, ...freshFields(doc) };
}

export const currentLevel = (s) => s.doc.levels[s.levelIndex];
export const currentRound = (s) => currentLevel(s).rounds[s.roundIndex];
export const currentProgress = (s) => s.rounds[currentRound(s).id];

export function roundNumber(s) {
  let n = 0;
  for (let i = 0; i < s.levelIndex; i++) n += s.doc.levels[i].rounds.length;
  return n + s.roundIndex + 1;
}

export function totalRounds(s) {
  return s.doc.levels.reduce((sum, l) => sum + l.rounds.length, 0);
}

export function isLevelComplete(s, levelIndex) {
  return s.doc.levels[levelIndex].rounds.every((r) => s.rounds[r.id].solved);
}

/** Briefing → first round of the level. */
export function continueFromBriefing(s) {
  if (s.view !== 'briefing') return { ok: false };
  s.view = 'awaiting-answer';
  s.feedback = null;
  return { ok: true };
}

/**
 * Submits the selected gate. Only valid answers on an unsolved round change counters.
 * Returns { status: "correct" | "incorrect" | "invalid-input" | "content-error" | "ignored", result, feedback }.
 */
export function submit(s, answer) {
  const canAnswer = s.view === 'awaiting-answer' || (s.view === 'feedback' && !currentProgress(s).solved);
  const progress = currentProgress(s);
  if (!canAnswer || progress.solved) return { status: 'ignored', result: null, feedback: null };

  const level = currentLevel(s);
  const round = currentRound(s);
  const result = evaluate(level, round, answer);

  if (result.status === 'invalid-input' || result.status === 'content-error') {
    const feedback = explain(result, level, round, { wrongAttempts: progress.wrongAttempts });
    s.feedback = feedback;
    s.lastStatus = result.status;
    return { status: result.status, result, feedback };
  }

  progress.attempts += 1;
  if (result.status === 'correct') {
    progress.solved = true;
  } else {
    progress.wrongAttempts += 1;
    s.droppedPackets += 1;
    if (progress.wrongAttempts >= 2) progress.assisted = true; // gate is named from the 2nd wrong attempt on
  }
  const feedback = explain(result, level, round, { wrongAttempts: progress.wrongAttempts });
  s.feedback = feedback;
  s.lastStatus = result.status;
  s.view = 'feedback';
  return { status: result.status, result, feedback };
}

/** After a wrong answer, go back to choosing a gate. */
export function retry(s) {
  if (s.view !== 'feedback' || currentProgress(s).solved) return { ok: false };
  s.view = 'awaiting-answer';
  return { ok: true };
}

/**
 * Help: reveals the method, the worked steps, then the gate. Marks the round assisted.
 * Not offered on a solved round, or while a briefing or the summary is showing.
 */
export function useHelp(s) {
  const progress = currentProgress(s);
  const allowed = (s.view === 'awaiting-answer' || s.view === 'feedback') && !progress.solved;
  if (!allowed) return { ok: false };
  const level = currentLevel(s);
  const round = currentRound(s);
  const resolved = resolve(level, round);
  if (resolved.error) return { ok: false };
  progress.assisted = true;
  progress.helpRevealed = true;
  const expected = round.gates.find((g) => g.id === resolved.expected.gateId);
  return { ok: true, help: round.help, gateLabel: expected ? expected.label : resolved.expected.gateId };
}

/** Advance after a solved round: next round, next level briefing, or the summary. */
export function next(s) {
  if (s.view !== 'feedback' || !currentProgress(s).solved) return { ok: false };
  s.feedback = null;
  if (s.roundIndex + 1 < currentLevel(s).rounds.length) {
    s.roundIndex += 1;
    s.view = 'awaiting-answer';
  } else if (s.levelIndex + 1 < s.doc.levels.length) {
    s.levelIndex += 1;
    s.roundIndex = 0;
    s.view = 'briefing';
  } else {
    s.view = 'summary';
  }
  return { ok: true };
}

export function requestRestart(s) {
  s.pendingRestart = true;
}

export function cancelRestart(s) {
  s.pendingRestart = false;
}

/** Clears the session only if a restart was requested and is now confirmed. */
export function confirmRestart(s) {
  if (!s.pendingRestart) return { ok: false };
  Object.assign(s, freshFields(s.doc));
  return { ok: true };
}

/** Counts shown separately in the summary. */
export function summary(s) {
  const all = Object.values(s.rounds);
  return {
    completedRounds: all.filter((r) => r.solved).length,
    totalRounds: all.length,
    attempts: all.reduce((n, r) => n + r.attempts, 0),
    droppedPackets: s.droppedPackets,
    roundsAssisted: all.filter((r) => r.assisted).length,
  };
}
