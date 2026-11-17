# Packet Run · Implementation plan

## Build target

Implement the clarified specification for Packet Run within the workshop build block. First deliver one complete round with correct grading, explanatory feedback, retry, and advance. Then add content and polish through the same implementation.

**Hardest behavior to get right:** one evaluator that resolves the single correct gate for three different devices while keeping each fallback distinct: an unknown MAC floods, a route miss uses the default route, and a rule miss hits the implicit deny. Firewall rules must be evaluated first-match, top to bottom.

**First evidence we'll check:** Level 1 Round 1 from the spec: SW1 with ingress Gi0/1 and destination MAC `00:aa:00:00:00:03` resolves to Gi0/3. Then the two boundaries: unknown MAC `…:09` floods to Gi0/2, Gi0/3, and Gi0/4, and `192.168.3.10` on R1 resolves to the default route out Gi0/2.

## Stack and serving

- Semantic HTML, CSS, and native JavaScript modules. No framework, bundler, backend, or runtime model.
- DOM controls plus SVG only where a diagram helps teach the concept. No rendering dependency by default. If choosing Three.js or another library, record its version, loading strategy, reason, and accessible alternative here before implementation.
- `data/levels.json` for authored content; load it over HTTP using a relative URL.
- In-memory session state. Reload starts a fresh session, as specified. No persistence in v1.
- Static hosting, including a repository subpath such as GitHub Pages. Use relative asset paths and case-correct filenames.

Preview from the repository root after implementation creates `index.html`:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open **http://127.0.0.1:8000**. On Windows use `py` in place of `python3`. Native modules and JSON fetching need a web server; opening the HTML with `file://` is not the supported run path. [MDN reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules).

## Proposed files and responsibilities

```text
index.html                   Semantic page shell and module entry point
style.css                    Layout, focus, feedback states, reduced motion
main.js                      Load → validate → start; render loading/errors
engine/
  rules.js                   Pure domain evaluation; no DOM or progress changes
  content.js                 Validate authored level data and source references
  state.js                   Session transitions, attempts, completion, restart
  feedback.js                Explain structured evaluation results
ui/
  render.js                  Briefing, challenge, feedback, and summary views
  controls.js                Input events and keyboard/focus behavior
data/
  levels.json                Briefings, challenges, hints, source records
tests/
  index.html                 Browser test runner with visible pass/fail summary
  rules.test.js              Independent expected results from the specification
  state.test.js              Attempts, assistance, duplicate submit, progression
  content.test.js            Invalid/missing/ambiguous authored data
README.md                    Actual run instructions, behavior, and evidence
```

Use `data/` and `tests/` at the root alongside `engine/` and `ui/`. Keep modules small enough to understand; combine view files if separate files add no value.

## Data contract

Define one document containing `schemaVersion`, `sources`, and `levels`. Each level has a unique ID, title, learning outcome, briefing, source IDs, and ordered rounds. Each round has a unique ID, domain-specific challenge, stable choice IDs where applicable, and ordered hints.

**Domain fields:**
- Each level has `device`: `"switch"`, `"router"`, or `"firewall"`, plus a `table` whose shape depends on the device.
- `packet`: `srcMac` and `dstMac` (six two-digit hex groups separated by colons, compared case-insensitively), `srcIp` and `dstIp` (dotted-quad IPv4, each octet 0–255), `protocol` (`"TCP"` or `"UDP"`), `dstPort` (integer 1–65535), and `ttl` (integer 2–255).
- `ingress`: the ID of the port or interface the packet arrives on.
- Switch table: `ports` (ID, label) and `macEntries` (MAC, port ID).
- Router table: `interfaces` (ID, label, address/prefix) and `routes` (prefix address, prefix length 0–30, interface ID, optional next-hop IP). The default route is prefix `0.0.0.0/0`.
- Firewall table: ordered `rules` (ID, action `"PERMIT"` or `"DENY"`, protocol `"TCP"` or `"UDP"`, destination port as an integer or `"any"`).
- Round-level display data, not used by grading: `rewrittenDstMac` for router rounds.

**Choice representation:** a single stable gate ID string. Switch rounds use port IDs plus `"flood"` and `"drop"`. Router rounds use interface IDs plus `"drop"`. Firewall rounds use rule IDs plus `"implicit-deny"`. Each round lists its `gates` with labels, and every gate ID must exist in that list.

**Validation rules:** reject the following as content errors that name the level and round ID.
- Missing or wrongly typed fields, and duplicate level, round, port, interface, or rule IDs.
- Invalid MAC, IPv4, protocol, port, or TTL values; prefix lengths of 31 or 32; TTL below 2.
- A router table with no default route, or with two non-default prefixes that overlap.
- A switch whose destination MAC is a broadcast or multicast address, or whose table maps the destination MAC to the ingress port.
- An `ingress` or table entry that refers to an unknown port or interface.
- A round whose gate list lacks the evaluator's expected result, or lists a gate ID not in the table.
- Missing source records, or hints that reference unknown source IDs.

The loader must validate the whole content file before starting. Show a useful content error with the level/round ID; do not count it as a learner attempt. Briefings and hints reference source records with a title, URL, section, and supported claim. Fixed wording and per-level content live in data; numeric reasoning may be assembled from evaluator results.

Do not invent a universal quiz schema that discards the domain's real structure. Adapt the [worked example's plan](https://github.com/automateyournetwork/NAF_AC6/blob/main/WORKSHOP/LAB/Examples/PrefixQuest/PLAN.md) only if it fits your game.

## Domain evaluation contract

```text
evaluate(challenge, answer) → {
  status: "correct" | "incorrect" | "invalid-input" | "content-error",
  expected: domain-specific canonical result, or null,
  reasonCode: stable identifier for the rule/misconception,
  evidence: structured values used to explain the decision
}
```

- This is a pure function: same inputs, same result; no DOM, timer, network, random choice, or score changes.
- Compute the result with the algorithm for the level's `device`. The UI must not choose the correct answer by position, label, or animation destination.
  - **Switch:** normalize `dstMac`. If a MAC entry matches, the expected gate is that entry's port. If none matches, the expected gate is `"flood"`, and the evidence lists every port except the ingress port.
  - **Router:** find the routes whose prefix contains `dstIp`. Ignoring the default route, validation guarantees at most one match. If one matches, use its interface. Otherwise use the default route's interface. The evidence includes the matched route, `ttl` before and after (decrement by 1), and `rewrittenDstMac`.
  - **Firewall:** walk `rules` in order and take the first rule where the protocol is equal and the port is equal or `"any"`. If none matches, the expected gate is `"implicit-deny"`. The evidence includes the matched rule's action, or the implicit deny.
- Distinguish a learner's incorrect decision from invalid input and broken authored content.
- Define accepted equivalent answers and reject unsupported ambiguity explicitly.
- Expected answers in tests come from independently reviewed cases. Don't calculate them by calling the same evaluator being tested.

**Feedback example:** Level 2 Round 2, the learner chooses `gi0-1`. The evaluator returns `incorrect` with reason code `outside-prefix`. The explanation reads: "192.168.3.10 is not inside 192.168.2.0/24, which covers 192.168.2.0–192.168.2.255, so that route doesn't match. No specific route matches, so R1 uses the default route 0.0.0.0/0 and forwards out Gi0/2 toward 203.0.113.1. TTL drops from 64 to 63."

Other stable reason codes include `ingress-port-chosen`, `flood-expected`, `default-route-misused`, `rule-order-ignored`, and `protocol-mismatch`.

## Session transitions

```text
loading → briefing → awaiting-answer
                     ├─ invalid input → guidance → awaiting-answer
                     ├─ incorrect → feedback → retry same round
                     └─ correct → feedback → Next → next round/briefing/summary
loading/content failure → error screen → retry loading
confirmed Restart → fresh first briefing
```

The state module owns attempts, dropped packets (incremented once per valid incorrect submission, display only), assistance, completed round IDs, current round, and current view. Selection and hints do not submit an answer. Count valid submissions only while a round is unsolved. Disable Submit after success; guard in state logic as well. Advance only through explicit Next. Restart requires confirmation; cancellation changes nothing.

## Interaction and visual direction

Translate the side-scrolling wire into a compact challenge area: the packet on the left with its header as labeled chips, the device's table in the middle, and the gates as a native radio group on the right, with Submit and hint buttons below and a persistent explanation area. Use a clear type hierarchy and one consistent visual language. Motion should reveal a consequence: after a correct router hop the header chips visibly rewrite (the destination MAC changes and TTL goes from 64 to 63, while the IPs stay), and a wrong gate fragments the packet and increments the dropped-packets tally. With reduced motion, show the before and after header values as text without animation.

Use native controls where possible, move focus deliberately after screen changes, and announce feedback through a live region. Respect `prefers-reduced-motion`. Display textual values alongside diagrams. A learner must not need animation, color vision, pointer precision, or hover to reason about the answer.

## Implementation order

| Slice | Deliverable | Evidence before the next slice |
| --- | --- | --- |
| 1 · Prove the rule | Pure evaluator plus the spec's correct/wrong/boundary cases | Expected results pass independently of the UI |
| 2 · Complete one round | Briefing, challenge, feedback, retry, Next | One correct and one wrong path work in the browser |
| 3 · Add the curriculum | All scoped levels, validation, hints, session summary | Each shipped round agrees with its reviewed cases |
| 4 · Make it usable | Keyboard/focus, reduced motion, narrow layout, clear error states | Manual checks are recorded |
| 5 · Package the result | README, screenshot if available, optional hosting | Another attendee can run and explain the game |

Generate `tasks.md` from these slices and the actual acceptance criteria. Do not create a large task tree for hypothetical stretch features.

## Verification and reporting

Implement a dependency-free browser test runner at `tests/index.html` that imports the pure modules, runs all assertions, and shows totals plus failed case IDs. It must report zero discovered tests as failure. Open **http://127.0.0.1:8000/tests/** after starting the same server.

| Check | What must be established |
| --- | --- |
| Domain cases | Correct, plausible wrong, and boundary outcomes for the supported model |
| Input/content failures | Invalid submissions do not consume attempts; malformed content cannot be graded |
| State transitions | Retry, hints, duplicate submission, level completion, final summary, restart/cancel |
| Source review | Each briefing and explanation agrees with the cited technical rule |
| Browser playthrough | Fresh start to summary, keyboard-only core actions, readable feedback |
| Layout/motion | Typical laptop, narrow viewport, reduced motion |
| Hosting, if used | Assets and data load under the published repository path |

For each required acceptance criterion, record **pass / fail / not run**, the date, environment, and evidence in the README or a linked verification note. The test runner checks code behavior; a human still reviews the teaching content and actual interaction.

## Scope controls

No persistence, multiplayer, runtime AI, procedural scenario generator, editor, or audio in v1. If time runs short, propose the smallest coherent reduction to the specification and update the tasks. Do not hide skipped checks or silently weaken correctness.
