# Feature Specification: Packet Run

**Feature Branch**: `001-packet-run` (feature identifier; no git branch has been created, and work is on `master`)

**Created**: 2026-11-17

**Status**: Draft

**Input**: User description: "Please refer to the SPEC.md file and build the specification"

## Overview

As a data packet travelling down a wire, the player chooses the exit gate at a switch, a router, and a firewall by reading the header field each device actually uses, and watches the packet get forwarded, rewritten, or dropped.

The learner is a beginner studying for CompTIA Network+, playing in a conference workshop. They know the terms MAC address, IP address, port, switch, router, and firewall, but may not be able to say which device uses which. Each round shows the packet's header fields and the device's own table (a MAC table, a routing table, or a rule list), and asks the player to pick the gate that device would send the packet through. The session ends when all six rounds are solved and the summary is shown. A first playthrough takes 5–10 minutes, with unlimited thinking time.

## Clarifications

### Session 2026-11-17

- Q: After a wrong answer, should the feedback name the correct gate, or only explain the mistake? → A: The 1st wrong attempt on a round gets an explanation of the mistake and the method only. The feedback shown after the 2nd wrong attempt, and after every later wrong attempt, also names the correct gate ("after 2 wrong attempts"). The player must still select and submit it to solve the round.
- Q: How many steps should help take before the worked solution appears? → A: One. A single Help action reveals the full worked solution at once. To stay consistent with the constitution (method first, then a worked step), the revealed text is ordered: the method, then the worked steps with this round's values, then the gate.
- Q: In the summary, is assistance counted as rounds assisted or total Help presses? → A: Rounds assisted (out of the total number of rounds, 6 in the shipped game). A round counts once if Help was used or the gate was revealed automatically after 2 wrong attempts, however many times.

## Learning Outcomes

| ID | After playing, the learner can… | The game asks them to… | Evidence of success |
| --- | --- | --- | --- |
| LO1 | Explain that a switch forwards a frame by destination MAC, and floods when the MAC is unknown | Pick the exit port for a frame, given a MAC table | Both Level 1 rounds solved with the correct gate |
| LO2 | Apply a router's forwarding decision using the destination IP, using the default route when no specific route matches, and recognize that TTL drops by 1 and the MAC is rewritten | Pick the egress interface for a packet, given a routing table | Both Level 2 rounds solved; TTL and MAC values shown after the hop match the rule |
| LO3 | Evaluate an ordered firewall rule list on protocol and port, with first match winning and implicit deny when nothing matches | Pick the rule that decides the packet's fate | Both Level 3 rounds solved with the correct rule or implicit deny |

## The Technical Model

- **Switch:** look up the destination MAC in the MAC table. If found, forward out that one port. If not found, flood out every port except the ingress port.
- **Router:** find the route whose prefix contains the destination IP. If no specific route matches, use the default route (0.0.0.0/0). Forward out that route's interface, decrement TTL by 1, and rewrite the Ethernet addresses. The IP addresses are unchanged.
- **Firewall:** check rules top to bottom. The first rule whose protocol and destination port both match decides the packet. If no rule matches, the implicit deny at the end drops it.
- **Context:** a simplified, vendor-neutral model of unicast IPv4 over Ethernet II.
- **Starting assumptions:** the switch's MAC table is already learned, ARP is already resolved, the router has only connected routes plus one default route, and the packet's TTL is at least 2.
- **Excluded:** VLANs, spanning tree, ARP exchanges, broadcast and multicast, IPv6, NAT, stateful inspection, overlapping route prefixes and longest-prefix tie-breaking, TTL expiry, fragmentation, and the physical layer (copper versus fiber).
- **References:** IEEE 802.1D-2004 forwarding process (clause to be confirmed); RFC 1812 §5.2.4.3 (next hop) and §5.3.1 (TTL); RFC 9293 §3.1 and RFC 768 (ports); NIST SP 800-41 Rev. 1 §3 (packet filtering; section to be confirmed).

The learner is told about these boundaries in plain language. Exactly one gate is correct per round; content that could yield two valid answers is an authoring error.

## Reference Scenario Data

These fixed values define the six rounds and are the basis for the acceptance scenarios.

- **Switch SW1:** MAC table `00:aa:00:00:00:01`→Gi0/1, `00:aa:00:00:00:02`→Gi0/2, `00:aa:00:00:00:03`→Gi0/3. Gi0/4 is an uplink with no learned entries.
- **Router R1:** connected route `192.168.1.0/24` on Gi0/0, connected route `192.168.2.0/24` on Gi0/1, default route `0.0.0.0/0` via `203.0.113.1` out Gi0/2.
- **Firewall FW1:** rule 1 DENY TCP 23; rule 2 PERMIT TCP any; rule 3 PERMIT UDP 53; then implicit deny.

| Round | Header values | Correct gate | Plausible wrong gate and the misconception it exposes |
| --- | --- | --- | --- |
| L1R1 | Ingress Gi0/1; destination MAC `…:03` | Gi0/3 | Gi0/1: choosing by where the frame came from |
| L1R2 | Ingress Gi0/1; destination MAC `…:09` (unknown) | Flood (out Gi0/2, Gi0/3, Gi0/4) | Drop: thinking an unknown destination is dropped |
| L2R1 | Ingress Gi0/0; destination IP `192.168.2.77`; TTL 64 | Gi0/1 | Gi0/2: using the default route although a specific route matches |
| L2R2 | Ingress Gi0/0; destination IP `192.168.3.10`; TTL 64 | Gi0/2 (default route) | Gi0/1: picking an interface because the address looks similar |
| L3R1 | TCP, destination port 23 | Rule 1 (DENY) | Rule 2: reading past the first matching rule |
| L3R2 | UDP, destination port 443 | Implicit deny | Rule 3: matching on protocol only |

**Full packet header values.** Every round shows all seven header fields. Values not used by the rule are fixed here so they are not invented during authoring. The router rows also give the Ethernet addresses shown after the hop.

| Round | Src MAC | Dst MAC | Src IP | Dst IP | Protocol / port | TTL |
| --- | --- | --- | --- | --- | --- | --- |
| L1R1 | `00:aa:00:00:00:01` | `00:aa:00:00:00:03` | `10.0.0.1` | `10.0.0.3` | TCP / 443 | 64 |
| L1R2 | `00:aa:00:00:00:01` | `00:aa:00:00:00:09` | `10.0.0.1` | `10.0.0.9` | TCP / 443 | 64 |
| L2R1 | `00:aa:00:00:01:0a` | `00:bb:00:00:00:01` (R1 Gi0/0) | `192.168.1.10` | `192.168.2.77` | TCP / 443 | 64 |
| L2R2 | `00:aa:00:00:01:0a` | `00:bb:00:00:00:01` (R1 Gi0/0) | `192.168.1.10` | `192.168.3.10` | TCP / 443 | 64 |
| L3R1 | `00:aa:00:00:01:14` | `00:ee:00:00:00:01` (FW1) | `10.1.1.20` | `203.0.113.10` | TCP / 23 | 64 |
| L3R2 | `00:aa:00:00:01:14` | `00:ee:00:00:00:01` (FW1) | `10.1.1.20` | `203.0.113.10` | UDP / 443 | 64 |

After a router hop the frame shows: L2R1 source MAC `00:bb:00:00:00:02` (R1 Gi0/1) and destination MAC `00:cc:00:00:02:4d` (the host at 192.168.2.77), TTL 63; L2R2 source MAC `00:bb:00:00:00:03` (R1 Gi0/2) and destination MAC `00:dd:00:00:00:01` (next hop 203.0.113.1), TTL 63. The IP addresses are unchanged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Make and understand a decision (Priority: P1)

A learner reads a briefing, inspects a packet and a device table, chooses a gate, submits, and learns from the explanation whether the choice was right and why.

**Why this priority**: This is the whole learning loop. Without it there is no game.

**Independent Test**: Play Level 1 Round 1 only: submit a wrong gate and then the correct gate, and confirm the feedback and the round's status.

**Acceptance Scenarios**:

1. **Given** a fresh session, **When** I start, **Then** I see the first briefing before any challenge.
2. **Given** Level 1 Round 1 (ingress Gi0/1, destination MAC `00:aa:00:00:00:03`), **When** I submit Gi0/3, **Then** the packet passes through Gi0/3, the round is marked solved, and the explanation names the destination MAC and the matching table entry.
3. **Given** that round, **When** I submit Gi0/1, **Then** feedback says the switch searches by destination MAC and not by where the frame arrived, completion stays unchanged, one dropped packet is tallied, and I can retry.
4. **Given** no selection or malformed input, **When** I submit, **Then** input guidance appears and attempts, dropped packets, and completion remain unchanged.
5. **Given** Level 2 Round 1 and the correct gate, **When** I submit it, **Then** the explanation shows TTL going from 64 to 63 and the source and destination MACs changing while the IP addresses stay the same.

---

### User Story 2 - Learn from help and finish the game (Priority: P1)

A learner who is stuck can ask for help, keeps retrying safely, and sees an honest summary of progress at the end.

**Why this priority**: Beginners get stuck, and the constitution requires honest progress reporting and safe retry.

**Independent Test**: Use Help, submit wrong and right answers repeatedly, complete a level, finish the game, and restart.

**Acceptance Scenarios**:

1. **Given** a round, **When** I use Help, **Then** a single reveal shows, in order, the method ("find the header field this device reads, then look it up in the table"), the worked steps using this round's values, and the correct gate; assistance is recorded without marking the round complete.
2. **Given** an unsolved round, **When** I make valid submissions, **Then** each counts as one attempt, and each wrong one also adds one to the dropped-packets tally, which is shown separately from attempts.
3. **Given** a solved round, **When** I submit again, **Then** nothing changes.
4. **Given** an unsolved round, **When** I submit my 1st wrong answer, **Then** the feedback does not name the correct gate. **When** I submit my 2nd wrong answer, **Then** the feedback names the correct gate, the round is recorded as using assistance, and the round stays unsolved until I submit that gate.
5. **Given** both rounds of a level are solved, **When** I choose Next, **Then** the level is complete and the following round or level opens; after the final round I see a session summary showing completed rounds, valid attempts, dropped packets, and rounds assisted (out of the total number of rounds, 6 in the shipped game).
6. **Given** a session in progress, **When** I choose Restart, **Then** I am asked to confirm; confirming clears the session and returns me to the first briefing, and cancelling changes nothing.

---

### User Story 3 - Play with accessible controls (Priority: P1)

A keyboard user can inspect the challenge, choose, submit, get help, and advance without a mouse.

**Why this priority**: The constitution makes access part of the core game, and the workshop audience will vary.

**Independent Test**: Complete a full playthrough with the keyboard only, then repeat with reduced motion enabled and a narrow window.

**Acceptance Scenarios**:

1. **Given** any screen, **When** I use only the keyboard, **Then** every core action is reachable, focus is visible, and every control has an accessible name.
2. **Given** feedback after a submission, **When** it appears, **Then** it is shown as text, stays available to read, and is announced to assistive technology.
3. **Given** reduced motion is requested, **When** I play, **Then** no information is lost, and the header's before and after values are shown as text.

---

### Edge Cases

- **Unknown destination at a switch (L1R2):** the frame is flooded to every port except the ingress port, not dropped.
- **Near-miss address at a router (L2R2):** `192.168.3.10` is close to the connected networks but outside them, so the default route applies.
- **Right port, wrong protocol (L3R2):** UDP 443 does not match any rule, even though rule 2 permits TCP traffic, so the implicit deny applies.
- **Fully matching rule (extra check):** UDP port 53 is decided by rule 3, PERMIT.
- **Unsupported authored content:** a router table with no default route, two overlapping non-default prefixes, a switch destination MAC equal to the ingress port's own entry, or a TTL below 2 shows a visible content error and is never graded; it never counts against the learner.
- **Empty or malformed submission:** shows guidance and does not count as an attempt.
- **Repeated Submit after success:** has no effect.
- **Cancelling Restart:** leaves the session intact.
- **Page reload:** starts a fresh session.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The game MUST present a briefing for each level before the first challenge of that level. The briefing introduces the device, the one header field it reads, and a worked example that differs from the challenge.
- **FR-002**: Each round MUST show every decision-relevant value: the packet's header fields and the device's complete table.
- **FR-003**: Each round MUST let the player select exactly one gate and explicitly submit the choice. Selecting a gate or using Help MUST NOT submit an answer.
- **FR-004**: The game MUST decide correctness from the documented rule for the level's device and the round's inputs, not from the gate's position, label, or animation. Exactly one gate is correct per round.
- **FR-005**: The game MUST show the result, the values used, and the rule connecting them after every valid submission. A wrong answer MUST explain the specific mistake and a next step, and MUST NOT name the correct gate until the round has had 2 wrong attempts (see FR-022); a correct answer MUST explain why it works. Every wrong gate MUST get an explanation: a gate with specific misconception wording uses it, and any other wrong gate gets a generic explanation built from the rule's evidence (the header value used, the table entry that applies, and why the chosen gate does not match).
- **FR-006**: Router rounds MUST show the packet's TTL decreasing by 1 and the source and destination MACs changing after a correct choice, with IP addresses unchanged.
- **FR-007**: A round MUST complete only on a valid, correct submission. Wrong answers MUST leave the round playable.
- **FR-008**: Empty or malformed submissions MUST show input guidance and MUST NOT change attempts, the dropped-packets tally, or completion.
- **FR-009**: Each valid submission on an unsolved round MUST count as one attempt, and each wrong one MUST add one to the dropped-packets tally. Submissions after success MUST have no effect.
- **FR-010**: The game MUST provide a single Help action that reveals, in order, the method, the worked steps with the round's own values, and the correct gate. Using it MUST record assistance without marking the round complete or implying independent mastery. Help is available on an unsolved round, including while its wrong-answer feedback is showing. Once a round is solved, Help is not offered, so a solved round's assisted status cannot change afterward.
- **FR-011**: A level MUST complete when both of its rounds are solved. Next MUST open the following round or level, and the final round MUST open a session summary.
- **FR-012**: The summary MUST show completed rounds, valid attempts, dropped packets, and rounds assisted (out of the total number of rounds), separately. A round counts as assisted once, however many times Help was used or the gate was revealed.
- **FR-013**: Restart MUST require confirmation; confirming clears the session and returns to the first briefing, and cancelling changes nothing.
- **FR-014**: The game MUST validate all authored content before presenting a challenge. Invalid or ambiguous content MUST show a visible content error naming the level and round, MUST NOT be graded, and MUST NOT count as a learner attempt.
- **FR-015**: All core actions MUST be reachable by keyboard with visible focus and accessible names, and feedback MUST be announced to assistive technology.
- **FR-016**: Success and failure MUST be conveyed with text as well as color, and essential diagrams MUST have a text equivalent.
- **FR-017**: The game MUST respect reduced-motion preferences, and animation MUST NOT delay feedback or controls.
- **FR-018**: The game MUST remain usable on a typical laptop and a narrow window; dense tables MAY scroll within a labeled container without hiding the action buttons.
- **FR-019**: The game MUST run from static files with no account, backend, live device, model, or API key, and progress MUST be held only for the current page session.
- **FR-020**: The game MUST ship exactly three levels of two rounds each, in the order switch, router, firewall, with no points, lives, timer, leaderboard, or streak mechanic.
- **FR-021**: Level content, help text, and source references MUST be editable separately from the game's rules, so that adding a round that uses the existing mechanic needs only a content change.
- **FR-022**: Once a round has had 2 wrong attempts, the feedback for that wrong attempt and for every later wrong attempt on the round MUST also name the correct gate, and the round MUST be recorded as having used assistance. Naming the gate MUST NOT solve the round: the player still has to select it and submit.

### Key Entities

- **Level**: a device (switch, router, or firewall), a learning outcome, a briefing, source references, and two ordered rounds.
- **Round**: a packet header, the device's table, the available gates, a help text (method, worked steps, and the correct gate), and one correct gate determined by the rule.
- **Packet header**: source and destination MAC, source and destination IP, protocol, destination port, and TTL.
- **Gate**: a selectable exit with a stable identity and label: a port, an interface, a rule, flood, drop, or implicit deny.
- **Session**: current position, attempts, dropped packets, assistance, and completed rounds, held only while the page is open.
- **Source reference**: a title, link, section, and the claim it supports.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time learner can complete all six rounds in 5–10 minutes of play.
- **SC-002**: In all twelve hand-checked correct and plausible-wrong cases (two per round), the game gives the expected result and explanation.
- **SC-003**: A tester can complete the whole game, from fresh start to summary, using only the keyboard.
- **SC-004**: Every one of the four invalid-content examples in Edge Cases is rejected with a visible content error and without affecting any learner counts.
- **SC-005**: After playing, a learner can say which header field a switch, a router, and a firewall each use. This is checked by asking each tester after the workshop, with a target of at least 90% answering all three correctly.
- **SC-006**: Every acceptance scenario has a recorded pass, fail, or not-run result, with the date and evidence, before release.
- **SC-007**: A trial challenge using an existing mechanic can be added by changing content only, with no change to the game's rules.

## Assumptions

- Learners are beginners at a conference workshop, with Network+ as the reference syllabus; no prior game experience is needed.
- The first release is a browser game within a 60-minute workshop build, and every round is a single decision, not a timed or reflex challenge.
- The dropped-packets tally is display only. It never ends the game or limits retries (the constitution forbids lives and timers in this version).
- "Flood" is a single selectable gate, not a set of ports. This is the proposed default for the open decision and can be revisited in clarify.
- The router's TTL and rewritten MAC are displayed and tested but are not part of the player's answer. This is the proposed default for the open decision and can be revisited in clarify.
- A stateless firewall is used, and the briefing states that real firewalls are often stateful. This is the proposed default for the open decision and can be revisited in clarify.
- The IEEE 802.1D clause and NIST SP 800-41 section cited above must be confirmed before release (constitution Principle I). Until confirmed, those two section references are not shown to learners.
- Constitution Principle II says help reveals "a method first, then a worked step". This spec reads that as an ordering rule: the single Help reveal shows the method first, then the worked steps, then the gate. If a progressive, multi-step reveal is wanted instead, that is a constitution amendment.
- SC-001 (5–10 minutes) and SC-005 (90% recall) are workshop observations, not build work. The facilitator records them after the session; the game needs no extra feature for them.
- The runtime content validator accepts any content that follows the data model (at least one level, at least one round per level). The shipped file must have exactly three levels of two rounds each (FR-020), and that is checked by a test on the shipped file, so adding a trial round (SC-007) is not blocked.
- Persistence across reloads, multiplayer, accounts, runtime AI, a leaderboard, a level editor, and audio are out of scope for this version.
- No shooting or reflex gameplay is included; the packet's journey is illustrated, and it does not change the rule being taught.
