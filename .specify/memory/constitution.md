<!--
Sync Impact Report
Version change: (unratified template) → 1.0.0
Modified principles: none renamed; all principles newly defined from CONSTITUTION.md
  (C1–C7 → I–VII)
Added sections: Core Principles I–VII, Release Scope and Technical Constraints,
  Development Workflow and Quality Gates, Governance
Removed sections: none (template example comments removed)
Follow-up TODOs: none. Source section numbers cited in SPEC.md (IEEE 802.1D clause,
  NIST SP 800-41 section) are still to be confirmed under Principle I.
-->

# Packet Run Constitution

**Purpose:** help Network+ candidates practice recognizing which part of a packet header each
network device reads (switch: destination MAC, router: destination IP, firewall: protocol and
port) through choosing the exit gate a packet takes at each device.

## Core Principles

### I. Technical Truth Is a Release Requirement

The game MUST never reward a technically incorrect answer. Grading MUST be reproducible from a
documented rule and the challenge inputs. Unsupported or ambiguous content is an authoring error:
the game MUST show an explanation that the challenge is unavailable and MUST prevent grading it.

The model being taught is a simplified, vendor-neutral model of unicast IPv4 over Ethernet.
Switch MAC tables are already populated and ARP is already resolved when a round starts. A router
has only connected routes plus one default route. A firewall is a stateless, ordered rule list
that matches protocol and destination port. Excluded: VLANs, spanning tree, ARP exchanges,
broadcast and multicast, IPv6, NAT, stateful inspection, overlapping route prefixes
(longest-prefix tie-breaking), TTL expiry, and fragmentation. Simplifications MUST appear in the
briefing and README wherever they affect what the player can conclude. Fictional worlds and
animations MAY illustrate a rule; they MUST NOT change it.

**Evidence:** hand-checked correct, incorrect, and boundary cases; a source link and section for
each networking rule; review of all shipped briefings and explanations. Expected results are
recorded independently of the implementation under test.

### II. Every Round Teaches Through a Decision

The player's main action MUST exercise the target skill. A concept MUST be introduced before it
is tested, and the values needed to reason about the answer MUST be shown. A wrong answer MUST
explain the specific mistake and give the player a useful next step. A correct answer MUST
explain why it works.

The learning sequence is: switch reads the destination MAC (foundation) → router reads the
destination IP, rewrites the MAC, and decrements TTL (application) → firewall reads protocol and
port with first-match order and an implicit deny (transfer). Hints reveal a method first, then a
worked step. Worked solutions are available when a learner is stuck; viewing one is recorded as
assistance, never as independent mastery.

**Evidence:** a teammate can connect each player action to a learning outcome and describe what
they learned from a deliberately wrong choice.

### III. Progress Is Honest and Retry Is Safe

A round completes only on a valid, correct submission. Incorrect answers keep the challenge
available. Empty or malformed submissions give input guidance without counting as a wrong
attempt. Repeated Submit actions MUST NOT award progress twice.

There are no lives, countdown, or speed bonus in this first version. Hints and retries have no
penalty. Completed rounds, attempts, and assistance are shown separately; completion is not proof
of independent mastery. The specification MUST say exactly what advances a round, finishes a
level, and resets a session.

**Evidence:** wrong-answer, repeated-submit, hint, completion, and reset checks match the
specification.

### IV. Access Is Part of the Core Game

All core actions MUST be usable by keyboard with visible focus, readable labels, and an
understandable order. Success and failure MUST be explained with text as well as color. Essential
diagrams MUST have a text equivalent. Reduced-motion preferences MUST be respected, and animation
MUST NOT delay the availability of feedback or controls.

The challenge MUST remain usable on a typical laptop and a narrow browser window. Dense technical
data MAY scroll within its own labeled container, without hiding the action buttons.

**Evidence:** a keyboard-only playthrough, a narrow-window check, and a reduced-motion check.
Record what was actually checked; do not claim full accessibility certification.

### V. The First Version Is Deterministic and Self-Contained

The game ships authored content and deterministic domain logic. It requires no account, backend,
live device connection, model, or API key. AI MAY help write code and assets during development;
its output receives the same review as any other contribution.

Runtime AI tutoring, generated questions, and free-text AI grading are stretch work. Adding them
requires an explicit change to this constitution, the specification, and the verification
approach before implementation.

**Evidence:** a clean browser session can play using only the project's static files; no external
content service decides an answer.

### VI. Content and Logic Can Be Reviewed Separately

Level content, hints, sources, and difficulty MUST be stored in editable data. Domain rules MUST
be kept separate from rendering and progress tracking. Data MUST be validated before a challenge
is presented. Feedback MUST agree with the evaluator's reasoning; a hand-authored answer key MUST
NOT silently override the rule engine.

Adding another challenge that uses the existing mechanic MUST require a data change and its
checks, not a new scoring path or a new screen implementation.

**Evidence:** inspect one level's data, trace one answer through the evaluator, and add a trial
challenge without modifying the rule engine.

### VII. Done Is Demonstrated

Only the agreed scope ships. Requirements, plan, tasks, and README MUST describe the same game. A
feature is complete when its acceptance criteria pass and its actual status is recorded. A
screenshot, a checked task box, or the agent saying "done" is insufficient by itself.

When time is short, scope MUST be reduced explicitly. Incorrect teaching and broken core
interactions are fixed before visual effects are added. Failed and untested checks stay visible.

**Evidence:** reproducible run/test commands, recorded verification results, a fresh-start
playthrough, and a README another attendee can follow.

## Release Scope and Technical Constraints

The first release is one core mechanic, three short levels, a browser, and a 60-minute workshop
build. This budget changes only by updating the agreed scope. The game is a static, browser-based
application with in-memory session state, authored content in data files, and no backend or
runtime model (see Principle V).

## Development Workflow and Quality Gates

Work proceeds from specification to plan to tasks to implementation, and these artifacts MUST stay
consistent with each other and with the README (Principle VII). Each acceptance criterion needs a
recorded pass, fail, or not-run result with the date, environment, and evidence. Automated checks
verify code behavior; a human still reviews the teaching content and the actual interaction before
release.

## Governance

This constitution supersedes other project practices. For any material change, the reason MUST be
recorded, the affected specification and plan MUST be updated, and analysis MUST be rerun. A
conflict with this constitution is resolved openly; the build agent MUST NOT weaken a principle
merely to make its implementation pass.

Versioning follows semantic versioning. MAJOR covers removing or redefining a principle in a
backward-incompatible way, MINOR covers adding a principle or section or materially expanding
guidance, and PATCH covers clarifications and wording fixes. Compliance is reviewed against each
principle's stated evidence before release.

**Version**: 1.0.0 | **Ratified**: 2026-11-17 | **Last Amended**: 2026-11-17
