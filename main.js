// Entry point: load → validate → start. Content or loading problems show an error screen and
// never count as a learner attempt.
import { validateDocument, formatError } from './engine/content.js';
import { createSession } from './engine/state.js';
import { createController } from './ui/controls.js';

const screen = document.getElementById('screen');
const explanation = document.getElementById('explanation');
const dialog = document.getElementById('restart-dialog');

const controller = createController({ screen, explanation, dialog, onReload: load });

async function load() {
  controller.showLoading();
  let doc;
  try {
    const response = await fetch('data/levels.json'); // relative URL: works under a repository subpath
    if (!response.ok) throw new Error(`data/levels.json returned HTTP ${response.status}`);
    doc = await response.json();
  } catch (err) {
    controller.showError([err && err.message ? err.message : 'Could not load data/levels.json'], 'load');
    return;
  }
  const result = validateDocument(doc);
  if (!result.valid) {
    controller.showError(result.errors.map(formatError), 'content');
    return;
  }
  controller.start(createSession(doc));
}

load();
