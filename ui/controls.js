// Input events, keyboard behavior, and deliberate focus management.
// Native controls are used throughout, so keyboard operation comes from the browser.
import * as State from '../engine/state.js';
import { screenHtml, explanationHtml, errorHtml, loadingHtml } from './render.js';

export function createController({ screen, explanation, dialog, onReload }) {
  let session = null;
  const ui = { selected: null, animate: null };

  /** Focus targets are applied after each render so focus is never lost. */
  const FOCUS = {
    heading: () => screen.querySelector('h2'),
    gates: () => screen.querySelector('input[name="gate"]:checked') || screen.querySelector('input[name="gate"]'),
    next: () => screen.querySelector('[data-action="next"]'),
    help: () => screen.querySelector('[data-action="help"]'),
    submit: () => screen.querySelector('button[type="submit"]'),
    restart: () => screen.querySelector('[data-action="restart"]'),
  };

  function render(focus) {
    screen.innerHTML = screenHtml(session, ui);
    explanation.innerHTML = explanationHtml(session);
    ui.animate = null;
    const target = focus && FOCUS[focus] ? FOCUS[focus]() : null;
    if (target) target.focus();
  }

  function selectedGate() {
    const checked = screen.querySelector('input[name="gate"]:checked');
    return checked ? checked.value : '';
  }

  function onSubmit(event) {
    event.preventDefault();
    const answer = selectedGate();
    ui.selected = answer || null;
    const outcome = State.submit(session, answer);
    if (outcome.status === 'ignored') return;
    if (outcome.status === 'correct') {
      render('next');
    } else if (outcome.status === 'incorrect') {
      ui.animate = 'fragment';
      render('gates');
    } else {
      // invalid input or content error: guidance only, nothing counted
      render('gates');
    }
  }

  const actions = {
    continue() {
      State.continueFromBriefing(session);
      ui.selected = null;
      render('heading');
    },
    help() {
      const result = State.useHelp(session);
      if (result.ok) render('help');
    },
    retry() {
      State.retry(session);
      ui.selected = null;
      render('gates');
    },
    next() {
      const result = State.next(session);
      if (!result.ok) return;
      ui.selected = null;
      render('heading');
    },
    restart() {
      State.requestRestart(session);
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else if (window.confirm('Restart the game? This clears your progress.')) actions['restart-confirm']();
      else actions['restart-cancel']();
    },
    'restart-confirm'() {
      State.confirmRestart(session);
      if (dialog.open) dialog.close();
      ui.selected = null;
      render('heading');
    },
    'restart-cancel'() {
      State.cancelRestart(session);
      if (dialog.open) dialog.close();
    },
    reload() {
      if (onReload) onReload();
    },
  };

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    const handler = actions[button.dataset.action];
    if (handler && (session || button.dataset.action === 'reload')) {
      event.preventDefault();
      handler();
    }
  });

  // Submit is always explicit; selecting a gate never submits or changes any counter.
  screen.addEventListener('submit', (event) => {
    if (event.target.id === 'gate-form') onSubmit(event);
  });
  screen.addEventListener('change', (event) => {
    if (event.target.name === 'gate') ui.selected = event.target.value;
  });

  // Escape closes the dialog; treat that as Cancel.
  dialog.addEventListener('close', () => {
    if (session && session.pendingRestart) State.cancelRestart(session);
  });

  return {
    start(newSession) {
      session = newSession;
      ui.selected = null;
      render(null); // do not steal focus on the initial page load; the skip link stays the first tab stop
    },
    showLoading() {
      screen.innerHTML = loadingHtml();
      explanation.innerHTML = '';
    },
    showError(messages, kind) {
      session = null;
      screen.innerHTML = errorHtml(messages, kind);
      explanation.innerHTML = '';
      const heading = screen.querySelector('h2');
      if (heading) heading.focus();
    },
  };
}
