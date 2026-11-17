# Tasks: Packet Run

**Input**: Design documents from `/specs/001-packet-run/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: Included. The plan and constitution require a dependency-free browser test runner, with expected results written from the spec and not computed by the code under test (Principle I). Write each test task before the code it checks and confirm it fails first.

**Organization**: Tasks are grouped by user story. All paths are relative to the repository root.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1, US2, or US3 (from [spec.md](spec.md))

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project skeleton and the test runner, so every later task can be checked.

- [X] T001 Create the folders `engine/`, `ui/`, `data/`, `tests/` and empty module files `main.js`, `engine/rules.js`, `engine/content.js`, `engine/state.js`, `engine/feedback.js`, `ui/render.js`, `ui/controls.js` per the plan's source layout
- [X] T002 [P] Create `index.html`: semantic page shell with a `<main>` landmark, an `<h1>`, a container for screens, a persistent live region for feedback, and `<script type="module" src="main.js">` using relative paths
- [X] T003 [P] Create `style.css`: base type hierarchy, visible `:focus-visible` styles, a `prefers-reduced-motion` block, and a narrow-window layout that stacks panels
- [X] T004 [P] Create `tests/index.html`: a dependency-free browser test runner that imports the `tests/*.test.js` modules, shows totals and failed case IDs, and reports failure when zero tests are discovered
- [X] T005 [P] Create `README.md` skeleton: what the game teaches, run command (`python3 -m http.server 8000 --bind 127.0.0.1`, `py` on Windows), test URL `http://127.0.0.1:8000/tests/`, a pass/fail/not-run results table (date, environment, evidence), and the model's simplifications and exclusions from the spec

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The rule evaluator, content validation, feedback builder, authored content, and loader. Every user story depends on these.

**CRITICAL**: No user story work starts until this phase is complete.

- [X] T006 [P] Write `tests/rules.test.js` with inline fixtures (SW1, R1, FW1 and the full header values from the spec's Reference Scenario Data) and hand-written expected results for all 12 spec cases: L1R1 `gi0-3` correct and `gi0-1` incorrect (`ingress-port-chosen`); L1R2 unknown MAC `00:aa:00:00:00:09` `flood` correct (ports gi0-2, gi0-3, gi0-4) and `drop` incorrect (`drop-chosen-unknown-mac`); L2R1 `192.168.2.77` `gi0-1` correct with TTL 64→63 and rewritten MACs, and `gi0-2` incorrect (`default-route-misused`); L2R2 `192.168.3.10` `gi0-2` correct (default route) and `gi0-1` incorrect (`outside-prefix`); L3R1 TCP 23 `rule-1` correct and `rule-2` incorrect (`rule-order-ignored`); L3R2 UDP 443 `implicit-deny` correct and `rule-3` incorrect (`port-mismatch`: UDP matches, but only port 53), and `rule-2` incorrect (`protocol-mismatch`: a TCP rule against a UDP packet). Also: extra UDP 53 expects `rule-3`; a wrong gate with no specific wording (for example `gi0-4` in L1R1) returns `incorrect` with reason code `wrong-gate`; empty or unknown gate returns `invalid-input`
- [X] T007 Implement `engine/rules.js`: pure `evaluate(level, round, answer)` per [contracts/evaluator.md](contracts/evaluator.md). Switch: match normalized (case-insensitive) `dstMac`, else `flood` to all ports except ingress. Router: the one non-default route containing `dstIp`, else the default route; evidence includes TTL before and after (minus 1), and the rewritten source and destination MACs (`rewrittenSrcMac`, `rewrittenDstMac`). Firewall: first rule where protocol is equal and port is equal or `"any"`, else `implicit-deny`. Returns `status`, `expected`, `reasonCode`, `evidence`. No DOM, timer, network, or random choice. Make T006 pass
- [X] T008 [P] Write `tests/content.test.js` covering the four spec invalid-content cases (router table with no default route; two overlapping non-default prefixes; switch destination MAC mapped to the ingress port; TTL below 2) plus the other validation rules in [data-model.md](data-model.md); each must produce a content error naming the level and round ID and never a graded result. Also add a test that a document with an extra (third) round in a level still validates (SC-007), and a separate shipped-file test that `data/levels.json` has exactly 3 levels in the order switch, router, firewall, each with exactly 2 rounds (FR-020)
- [X] T009 Implement `engine/content.js` (after T007, because it asks the evaluator for the expected gate): `validateDocument(doc)` that checks the whole document before play and returns errors naming the level and round ID. Enforce verbatim: `schemaVersion` required and supported integer; `levels` at least 1; each level at least 1 round (the exact 3×2 shipped shape is checked by the shipped-file test in T008, not here); unique IDs (level, round, port, interface, rule); `srcMac`/`dstMac` "six two-digit hex groups, colon-separated; compared case-insensitively"; `srcIp`/`dstIp` "dotted-quad IPv4, each octet 0–255"; `protocol` is `TCP` or `UDP`; `dstPort` "integer 1–65535" or `"any"` in firewall rules; `ttl` "integer 2–255"; route "prefix lengths of 31 or 32" rejected; router table "no default route, or with two overlapping non-default prefixes" rejected; switch destination MAC "broadcast or multicast" or "mapped to the ingress port" rejected; `ingress` and table entries must name a known port or interface; `gates` must contain the evaluator's expected gate and only gate IDs from the table; `sourceIds` must exist in `sources`. Make T008 pass
- [X] T010 [P] Implement `engine/feedback.js`: `explain(result, round, context)` builds explanation text from evaluator `evidence` plus per-gate `misconceptions` wording in data. A wrong answer explains the mistake and a next step. Use the round's specific `misconceptions` wording when present, otherwise a generic explanation from the evidence with reason code `wrong-gate`. The correct gate is named only when `context.wrongAttempts >= 2` (the 2nd wrong attempt and every later one, FR-022), and not on the 1st. A correct answer explains why it works, including TTL and the source and destination MACs before and after for router rounds. Return text with stable reason codes
- [X] T011 Create `data/levels.json` document header: `schemaVersion`, and `sources` with five records (title, url, section, claim): IEEE 802.1D-2004 forwarding process (section flagged "to be confirmed"), RFC 1812 §5.2.4.3, RFC 1812 §5.3.1, RFC 9293 §3.1 with RFC 768, NIST SP 800-41 Rev. 1 §3 (section flagged "to be confirmed"). Give unconfirmed sections an `unconfirmed: true` marker so the UI does not show their section to learners until T035 confirms them
- [X] T012 Add Level 1 (switch, SW1) to `data/levels.json`: briefing with a worked example different from the challenge and the model's boundaries; table `ports` gi0-1 to gi0-4 and `macEntries` `00:aa:00:00:00:01`→gi0-1, `…:02`→gi0-2, `…:03`→gi0-3 (gi0-4 uplink, no entries); rounds l1r1 and l1r2 using the full header values in the spec's Reference Scenario Data (ingress gi0-1; l1r1 dst MAC `00:aa:00:00:00:03`, l1r2 dst MAC `00:aa:00:00:00:09`); gates gi0-1..gi0-4, `flood`, `drop`; per-round `help` (method, steps, gate note) and `misconceptions` (`gi0-1` → `ingress-port-chosen`, `drop` → `drop-chosen-unknown-mac`)
- [X] T013 Add Level 2 (router, R1) to `data/levels.json`: interfaces gi0-0 `192.168.1.1/24`, gi0-1 `192.168.2.1/24`, gi0-2 `203.0.113.2/30`; routes `192.168.1.0/24`→gi0-0, `192.168.2.0/24`→gi0-1, `0.0.0.0/0` via `203.0.113.1`→gi0-2; rounds l2r1 and l2r2 using the full header values in the spec's Reference Scenario Data (ingress gi0-0; src `192.168.1.10`; l2r1 dst `192.168.2.77`, l2r2 dst `192.168.3.10`; TTL 64); `display.rewrittenSrcMac` and `display.rewrittenDstMac` per round (l2r1 `00:bb:00:00:00:02` and `00:cc:00:00:02:4d`; l2r2 `00:bb:00:00:00:03` and `00:dd:00:00:00:01`); gates gi0-0, gi0-1, gi0-2, `drop`; help text and misconceptions (`gi0-2` in l2r1 → `default-route-misused`, `gi0-1` in l2r2 → `outside-prefix`)
- [X] T014 Add Level 3 (firewall, FW1) to `data/levels.json`: rules rule-1 DENY TCP 23, rule-2 PERMIT TCP any, rule-3 PERMIT UDP 53; rounds l3r1 (TCP, dst port 23) and l3r2 (UDP, dst port 443) using the full header values in the spec's Reference Scenario Data; gates rule-1, rule-2, rule-3, `implicit-deny`; briefing states the firewall is stateless and that real firewalls are often stateful; help text and misconceptions (`rule-2` in l3r1 → `rule-order-ignored`, `rule-3` in l3r2 → `protocol-mismatch`)
- [X] T015 Implement `main.js` load path and the loading and error views in `ui/render.js`: fetch `data/levels.json` with a relative URL, run `validateDocument`, and on failure show an error screen naming the level and round ID with a retry-load action; a content error never counts as an attempt

**Checkpoint**: `tests/` shows rules and content tests passing, and the game loads valid content or shows a clear content error.

---

## Phase 3: User Story 1 - Make and understand a decision (Priority: P1) MVP

**Goal**: The player reads a briefing, inspects a packet and a device table, selects a gate, submits, and gets correct or wrong feedback with retry.

**Independent Test**: Play Level 1 Round 1: submit `Gi0/1` (wrong), then `Gi0/3` (correct). Quickstart scenarios 1–5 and 8–12.

### Tests for User Story 1

> Write these first and confirm they fail before implementation.

- [X] T016 [P] [US1] Write the submission tests in `tests/state.test.js`: a valid wrong answer adds 1 to `attempts`, `wrongAttempts`, and `droppedPackets` and leaves the round unsolved; an invalid or empty submission changes no counter; a valid correct answer adds 1 attempt and sets `solved`; a submit after `solved` changes nothing; the 1st wrong attempt does not name the correct gate, and the 2nd and every later wrong attempt set `assisted` and make feedback name it; selecting a gate never changes state

### Implementation for User Story 1

- [X] T017 [US1] Implement the submission part of `engine/state.js`: session object per [data-model.md](data-model.md) (`view`, `position`, `rounds` progress, `droppedPackets`), `submit(answer)` that calls the evaluator, guards duplicate submits after success, and sets `view` to `feedback`; the module is the only place counters change. Make T016 pass
- [X] T018 [US1] Implement briefing, challenge, and feedback views in `ui/render.js`: briefing with Continue; challenge showing every packet header value as labeled chips, the device's complete table as text, the gates as a native single-choice group with a visible group label, the dropped-packets tally and attempts as separate labeled values, Submit, and an explanation area; feedback showing result, values used, and the rule, with Retry on wrong and Next on correct
- [X] T019 [US1] Implement `ui/controls.js` events for US1: select gate (no submit), Submit (empty selection shows input guidance and changes no counter), Retry, Continue, and Next; Next advances to the next round or level
- [X] T020 [US1] Wire `main.js` to start at the first briefing and connect `engine/state.js`, `ui/render.js`, and `ui/controls.js`, so a fresh session shows the first briefing before any challenge
- [X] T021 [P] [US1] Add motion in `style.css` and `ui/render.js`: after a correct router hop the header chips rewrite in place (source and destination MACs change, TTL 64→63, IPs unchanged); a wrong gate fragments the packet and increments the tally; animation never delays feedback or controls
- [X] T022 [US1] Run quickstart scenarios 1–5, 8–12, and 22 in the browser and record pass, fail, or not run with date, environment, and evidence in `README.md`

**Checkpoint**: Level 1 through Level 3 rounds can be played, graded, and retried; US1 works on its own.

---

## Phase 4: User Story 2 - Learn from help and finish the game (Priority: P1)

**Goal**: Help, honest progress counts, level completion, the summary, and a safe restart.

**Independent Test**: Use Help, submit wrong and right answers, complete a level, finish all six rounds, then restart. Quickstart scenarios 6, 7, 13–15.

### Tests for User Story 2

- [X] T023 [P] [US2] Extend `tests/state.test.js`: Help marks the round `assisted` once without setting `solved`; using Help twice still counts one assisted round; a level completes only when both rounds are `solved`; the final Next opens the summary; the summary reports completed rounds, valid attempts, dropped packets, and rounds assisted (out of the total number of rounds) separately; Help is rejected on a solved round and does not change its `assisted` status; Restart with confirmation clears all counters and returns to the first briefing; cancelling Restart changes nothing

### Implementation for User Story 2

- [X] T024 [US2] Extend `engine/state.js`: `useHelp()` (sets `assisted`, never `solved`), level-completion and summary transitions, `requestRestart()`, `confirmRestart()`, and `cancelRestart()` (using `pendingRestart`). Make T023 pass
- [X] T025 [US2] Add the single Help action to `ui/render.js` and `ui/controls.js`: one reveal showing, in order, the method, the worked steps with this round's values, and the correct gate; it does not submit and does not solve the round, and it is offered only while the round is unsolved
- [X] T026 [US2] Add the summary view in `ui/render.js`: completed rounds, valid attempts, dropped packets, and rounds assisted (out of the total number of rounds), as four separate labeled values, with a note that completion is not proof of independent mastery
- [X] T027 [US2] Add the Restart confirmation in `ui/render.js` and `ui/controls.js`: Restart opens a confirmation; Confirm clears the session and returns to the first briefing; Cancel changes nothing
- [X] T028 [US2] Run quickstart scenarios 6, 7, 13, 14, and 15 and record results in `README.md`

**Checkpoint**: A full six-round session can be completed and summarized, and restarted safely.

---

## Phase 5: User Story 3 - Play with accessible controls (Priority: P1)

**Goal**: The whole game works by keyboard, with text feedback, reduced motion, and a narrow layout.

**Independent Test**: Complete a full playthrough using only the keyboard, then repeat with reduced motion and a narrow window. Quickstart scenarios 17–19.

- [X] T029 [US3] Audit and fix keyboard operation in `ui/controls.js` and `ui/render.js`: every core action (inspect, select gate, Submit, Help, Retry, Next, Continue, Restart and its confirmation) is reachable in an order that follows the visible layout, with visible focus and an accessible name on each control
- [X] T030 [US3] Implement deliberate focus management in `ui/controls.js`: move focus to the screen heading or the feedback after each screen change, and return focus to a sensible control after Restart is cancelled
- [X] T031 [US3] Route all feedback through the live region in `index.html` and `ui/render.js`; feedback text stays on screen until the player moves on, and success and failure use text and a label or icon in addition to color
- [X] T032 [P] [US3] Add text equivalents in `ui/render.js`: every header value and table row as text, router TTL and source and destination MACs before and after as text, and a text description for each SVG diagram carrying the same information
- [X] T033 [P] [US3] Finish reduced-motion and narrow-layout support in `style.css`: under `prefers-reduced-motion` replace animations with static before and after values; at a narrow width stack the panels, let dense tables scroll inside a labeled container, and keep Submit, Help, and Next visible
- [X] T034 [US3] Perform the keyboard-only playthrough (scenario 17), the narrow-window check (18), and the reduced-motion check (19), and record exactly what was checked in `README.md` without claiming accessibility certification. Status: done with simulated key events in headless Chrome; a human keyboard-only pass is still outstanding (see README)

**Checkpoint**: All three stories work independently and together.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Source verification, final evidence, and packaging.

- [ ] T035 Confirm the two flagged source sections (IEEE 802.1D-2004 clause and NIST SP 800-41 Rev. 1 section) and update `data/levels.json` and `specs/001-packet-run/spec.md` with the confirmed sections. Status 2026-11-17: RFC 1812 §5.3.1 (TTL, "MUST reduce the TTL by at least one") and the title of §5.2.4.3 ("Next Hop Address") were checked against the RFC text. The IEEE 802.1D clause (paywalled) and the NIST SP 800-41 section (PDF not readable by the fetch tool) are NOT confirmed, so they keep `unconfirmed: true` and their sections stay hidden in the UI
- [ ] T036 Review every shipped briefing, help text, and misconception explanation against the cited references and the spec's technical model, and record the review in `README.md` (Principle I)
- [X] T037 [P] Run quickstart scenario 16: break `data/levels.json` in each of the four invalid-content ways and confirm a visible content error with the level and round ID, no grading, and no attempt counted
- [X] T038 [P] Run quickstart scenario 20 (fresh browser session, static files only) and scenario 21 (add a third round to one level by editing data only, confirm it validates and plays with no change to `engine/rules.js`), and record results
- [X] T039 Run the full test page at `http://127.0.0.1:8000/tests/` and record totals; confirm at least one test was discovered
- [X] T040 Finish `README.md`: actual run and test commands, implemented behavior, remaining limits, and the results table with every acceptance scenario marked pass, fail, or not run with date, environment, and evidence (Principle VII)
- [ ] T041 Confirm the spec, plan, tasks, and README describe the same game, then re-run `/speckit-analyze` and resolve anything new; update the root `PLAN.md` if it is kept, since it still describes ordered hints and per-level assistance
- [ ] T042 Record the facilitator's observations for SC-001 (time to finish six rounds) and SC-005 (which header field each tester says a switch, a router, and a firewall use) after the workshop session in `README.md`

### Scope cut line (constitution: 60-minute workshop build)

If time runs short, ship T001–T034 first, because they cover all three stories and the accessibility checks. T035, T036, T039, and T040 are release gates and should not be skipped. T037, T038, T041, and T042 may slip if they are recorded as not run in `README.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. Blocks all user stories.
- **User Stories (Phases 3–5)**: Depend on Foundational. US2 extends `engine/state.js`, `ui/render.js`, and `ui/controls.js` from US1, so run US1 first. US3 audits the screens built in US1 and US2, so run it last.
- **Polish (Phase 6)**: Depends on all stories.

### Within Phase 2

- T006 before T007 (the tests fail first); T008 before T009.
- T011 before T012, T013, and T014 (same file, run in order).
- T009 comes after T007 (it asks the evaluator for the expected gate). It needs the data from T012–T014 to run end to end, but its tests (T008) use inline fixtures, apart from the shipped-file test, which needs T012–T014.
- T015 needs T009 and T011–T014.

### Within Each Story

- Test task, then implementation, then recorded verification.
- US1: T016 → T017 → T018, T019 → T020 → T021, T022.
- US2: T023 → T024 → T025, T026, T027 → T028.
- US3: T029, T030, T031 in order (same files); T032 and T033 can run alongside; T034 last.

### Parallel Opportunities

- Setup: T002, T003, T004, T005.
- Foundational: T006 and T008 and T010 together at the start (different files).
- US1: T016 can be written while T018 is drafted; T021 alongside T019/T020.
- US3: T032 and T033.
- Polish: T037 and T038.

## Parallel Example: Foundational Start

```text
Task: "Write tests/rules.test.js with inline fixtures and hand-written expected results" (T006)
Task: "Write tests/content.test.js covering the four invalid-content cases" (T008)
Task: "Implement engine/feedback.js" (T010)
```

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Phase 1 (Setup) and Phase 2 (Foundational).
2. Complete Phase 3 (US1).
3. **Stop and validate:** play the rounds and confirm the spec's correct, wrong, and boundary cases (T022).
4. Demo if ready.

### Incremental Delivery

1. Setup and Foundational give a tested rule engine and valid content.
2. US1 gives a playable, gradable game (MVP).
3. US2 adds Help, summary, and restart, which makes it a complete session.
4. US3 adds the accessibility checks, which the constitution treats as part of the core game.
5. Polish confirms sources and records the evidence.

If time runs short, reduce scope openly and update the spec and these tasks. Fix incorrect teaching and broken core interactions before visual effects (Principle VII).

## Notes

- Expected results in tests are written from the spec, not computed by `engine/rules.js`.
- Commit after each task or logical group. Keep failed and not-run checks visible in `README.md`.
- The expected gate is never stored in the data. The evaluator derives it.
