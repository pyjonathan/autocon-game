# Implementation Plan: Packet Run

**Branch**: `001-packet-run` | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-packet-run/spec.md`, seeded by the root [PLAN.md](../../PLAN.md)

## Summary

Packet Run is a static, browser-based teaching game. The player is a packet and chooses the exit gate at a switch, a router, and a firewall, learning that each device reads a different part of the header. The approach is semantic HTML, CSS, and native JavaScript modules, with no framework or backend. A pure rule evaluator decides the single correct gate for each device. Authored level data lives in one JSON file. A small state module tracks attempts, dropped packets, assisted rounds, and progress in memory. A dependency-free browser test runner checks the rules, state, and content validation against independently hand-checked cases.

Delivery goes in slices: first one correct round end-to-end, then all six rounds, then accessibility checks, then packaging.

## Technical Context

**Language/Version**: JavaScript (ES2020+ native modules), HTML5, CSS3

**Primary Dependencies**: None at runtime. No framework, bundler, or rendering library. Diagrams use inline SVG only where they help teach.

**Storage**: N/A. Session state is in memory only, and reload starts fresh. Authored content is a static `data/levels.json`.

**Testing**: Dependency-free browser test runner at `tests/index.html`, plus manual playthrough checks for keyboard, narrow window, and reduced motion. Zero discovered tests counts as failure.

**Target Platform**: Current desktop and laptop browsers with ES module and `fetch` support, served from static hosting, including a repository subpath such as GitHub Pages.

**Project Type**: Static web application (single project, no backend).

**Performance Goals**: Feedback and screen changes feel instant (no waiting on animation). The full game loads from static files in a single page load.

**Constraints**: Offline-capable after load. No account, backend, live device, model, or API key. Relative asset paths and case-correct filenames. Must be usable on a laptop and a narrow window.

**Scale/Scope**: 3 levels, 6 rounds, one core mechanic, one short session (5–10 minutes).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status |
| --- | --- | --- |
| I. Technical truth | Evaluator decides correctness from documented rules; every rule has a source; hand-checked cases recorded independently | Pass (cases in spec; sources to be confirmed before release) |
| II. Teaches through a decision | One gate choice per round; briefing before challenge; specific wrong-answer feedback; Help text ordered method, steps, gate | Pass |
| III. Honest progress | Valid-correct-only completion; invalid input not counted; duplicate submit guarded in state; no lives/timer; separate counts | Pass (dropped packets are a display-only tally) |
| IV. Access | Native controls, visible focus, live region, text equivalents, reduced motion, narrow layout | Pass (checks recorded in the quickstart) |
| V. Deterministic, self-contained | Static files, no backend, no runtime AI | Pass |
| VI. Content/logic separate | `data/levels.json` plus pure `engine/rules.js`; validation before play; feedback derived from evaluator output | Pass |
| VII. Done is demonstrated | README and tests record pass/fail/not-run with evidence | Pass (planned) |

No violations, so Complexity Tracking is empty. Re-check after Phase 1 design: still passing (see Post-Design Check below).

## Project Structure

### Documentation (this feature)

```text
specs/001-packet-run/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── content-schema.md
│   ├── evaluator.md
│   └── ui-contract.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
index.html                   Semantic page shell and module entry point
style.css                    Layout, focus, feedback states, reduced motion
main.js                      Load → validate → start; render loading/errors
engine/
  net.js                     Small pure helpers: MAC and IPv4 parsing, prefix matching
  rules.js                   Pure evaluation per device; no DOM, no progress
  content.js                 Validate authored data and source references
  state.js                   Session transitions, attempts, assistance, restart
  feedback.js                Turn evaluator results into explanations
ui/
  render.js                  Briefing, challenge, feedback, summary views
  controls.js                Input events, keyboard and focus behavior
data/
  levels.json                Briefings, rounds, help text, source records
tests/
  harness.js                 Shared test registry and assertions
  fixtures.js                Hand-written fixtures copied from the spec
  run-node.mjs               Optional: run the same tests from a terminal with Node
  index.html                 Browser test runner with visible pass/fail summary
  rules.test.js              Independent expected results from the spec
  state.test.js              Attempts, assistance, duplicate submit, progression
  content.test.js            Invalid, missing, and ambiguous authored data
README.md                    Actual run instructions, behavior, and evidence
```

**Structure Decision**: a single static project at the repository root, with `engine/` (pure logic), `ui/` (rendering and input), `data/` (authored content), and `tests/` (browser runner), as in the root PLAN.md. Feature documents stay under `specs/001-packet-run/`. View files may be merged if separate files add no value.

## Key Design Decisions

- **Hardest behavior:** one evaluator that keeps three distinct fallbacks: unknown MAC floods, route miss uses the default route, rule miss hits the implicit deny. Firewall rules are first-match, top to bottom.
- **Gate identity:** each round lists `gates` with stable IDs and labels. The UI never infers the answer from position, label, or animation.
- **Clarified behavior from the spec:**
  - Wrong-answer feedback on the 1st wrong attempt explains the mistake only. On the 2nd wrong attempt and every later one, it also names the correct gate and marks the round assisted (FR-022).
  - One Help action reveals the method, the worked steps, then the gate, and marks the round assisted (FR-010).
  - The summary reports rounds assisted out of the total number of rounds, 6 in the shipped game (FR-012).
- **Feedback from evidence:** explanations are assembled from evaluator `evidence` values and per-level wording in data, so they cannot disagree with the rule engine.
- **State owns counts:** attempts, dropped packets, wrong attempts per round, assisted rounds, completed rounds, current position, and view live only in `engine/state.js`.

## Implementation Order

| Slice | Deliverable | Evidence before the next slice |
| --- | --- | --- |
| 1 · Prove the rule | `engine/rules.js` with the spec's correct, wrong, and boundary cases | Expected results pass independently of the UI |
| 2 · Complete one round | Briefing, challenge, feedback, retry, Next for Level 1 Round 1 | One correct path and one wrong path work in the browser |
| 3 · Add the curriculum | All six rounds, content validation, Help, 2-wrong-attempt reveal, summary | Each shipped round agrees with its reviewed cases |
| 4 · Make it usable | Keyboard and focus, reduced motion, narrow layout, error states | Manual checks recorded |
| 5 · Package the result | README with run and test commands and recorded evidence | Another attendee can run and explain the game |

## Verification Plan

Details and commands are in [quickstart.md](quickstart.md). Each acceptance scenario in the spec gets a recorded pass, fail, or not-run result with the date, environment, and evidence. The test runner checks code behavior; a human reviews the teaching text against the references and plays the game keyboard-only.

## Scope Controls

No persistence, multiplayer, runtime AI, procedural generator, editor, or audio. If time runs short, propose the smallest coherent reduction to the spec and update the tasks. Skipped checks stay visible.

## Post-Design Check

After Phase 1: the data model and contracts keep rules, content, and progress in separate modules (VI), keep all grading deterministic and in static files (V), add no lives or timers (III), and name accessibility checks (IV). All gates still pass.

## Complexity Tracking

No constitution violations to justify.

## Notes for the Maintainer

The root [PLAN.md](../../PLAN.md) predates the clarification session. It still describes ordered hints and per-level assistance. This plan, the data model, and the contracts are authoritative for the clarified behavior.
