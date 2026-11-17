# Research: Packet Run

No `NEEDS CLARIFICATION` items remained after the specify and clarify steps. This document records the technology and design decisions the plan relies on.

## Decision 1: Native JavaScript modules, no framework or bundler

- **Decision:** Semantic HTML, CSS, and native ES modules.
- **Rationale:** The game is six rounds of one mechanic. A framework adds setup time to a 60-minute workshop build and nothing the game needs. Plain modules keep the rule engine independently testable.
- **Alternatives considered:** A framework (extra tooling, no benefit at this size). A game engine or Three.js (the constitution wants a decision-based game, and a canvas makes keyboard and screen-reader access harder).

## Decision 2: Authored content in one JSON file, loaded over HTTP

- **Decision:** `data/levels.json` with `schemaVersion`, `sources`, and `levels`, fetched with a relative URL.
- **Rationale:** Satisfies "content and logic reviewed separately" and lets a round be added without touching the rule engine. A relative URL works under a repository subpath.
- **Alternatives considered:** Content embedded in JavaScript (mixes content and logic). One file per level (more files to validate for six rounds).
- **Consequence:** The game must be served over HTTP. `file://` is not supported because modules and `fetch` need a server.

## Decision 3: Gates as stable IDs with a native radio group

- **Decision:** Every round lists its `gates`, and an answer is one gate ID. The UI presents them as a native single-choice control with labels.
- **Rationale:** Native controls give keyboard and screen-reader behavior for free. Stable IDs keep grading independent of position, label, and animation.
- **Alternatives considered:** Clickable SVG gates (hard to make keyboard-accessible, and risks pointer-only play). Drag-and-drop (pointer-centric).

## Decision 4: Pure evaluator with structured evidence

- **Decision:** `evaluate(round, answer)` returns a status, the expected result, a reason code, and evidence values. Feedback text is assembled from evidence and per-level wording in data.
- **Rationale:** The explanation cannot disagree with the rule, and tests can check outcomes without a DOM.
- **Alternatives considered:** A hand-authored answer key per round (can silently override the rule, which the constitution forbids).

## Decision 5: Evaluation algorithms

- **Switch:** exact match of the normalized destination MAC against the table; a miss floods to every port except the ingress port.
- **Router:** find the route whose prefix contains the destination IP; with no overlapping non-default prefixes allowed, at most one specific route can match; otherwise use the default route. TTL decreases by 1 for display.
- **Firewall:** first-match, top to bottom, on protocol equality and port equality or `any`; no match gives implicit deny.
- **Rationale:** Matches the spec's model exactly and avoids longest-prefix tie-breaking, which the spec excludes.
- **Alternatives considered:** Full longest-prefix match (excluded by the spec for beginner scope).

## Decision 6: Session state in one module, in memory only

- **Decision:** `engine/state.js` owns all counters and transitions, with no persistence.
- **Rationale:** The spec says reload starts a new session. One owner makes duplicate-submit and reveal rules testable.
- **Alternatives considered:** `localStorage` persistence (a stretch feature that the spec says must be specified first).

## Decision 7: Browser test runner with no dependencies

- **Decision:** `tests/index.html` imports the pure modules, runs assertions, shows totals and failed case IDs, and fails on zero discovered tests.
- **Rationale:** No install step, runs from the same static server, and matches the constitution's evidence requirements.
- **Alternatives considered:** Node-based test frameworks (extra tooling for attendees).

## Decision 8: Motion and accessibility approach

- **Decision:** Animation only reveals consequences (header chips rewriting, packet fragmenting). All values appear as text. Under reduced motion, before and after values show without animation. Feedback goes to a live region, and focus moves deliberately on screen changes.
- **Rationale:** Satisfies Principle IV and FR-015 to FR-018.
- **Alternatives considered:** Animation as the only indicator (violates the constitution).

## Open release checks

- Confirm the IEEE 802.1D clause and NIST SP 800-41 section cited in the spec. All other references (RFC 1812, RFC 9293, RFC 768) must still be checked against the shipped explanations.
