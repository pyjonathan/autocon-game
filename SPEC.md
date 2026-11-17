# Packet Run · First playable specification

## The pitch

**As a data packet travelling down a wire, you choose the exit gate at a switch, a router, and a firewall by reading the header field each device actually uses, and you watch your packet get forwarded, rewritten, or dropped.**

The player is a packet on its way from a laptop to a server. Each round shows the packet's header fields and the device's own table (a MAC table, a routing table, or a rule list), and asks the player to pick the gate the device would send the packet through. A correct decision sends the packet through the gate, and the header visibly updates where the device would change it. An incorrect decision drops the packet, adds one to a dropped-packets tally, and explains which header field the device really reads. The session ends when all six rounds are solved and the summary is shown.

## Who this is for

- **Learner:** a beginner studying for CompTIA Network+, at a conference workshop.
- **Assumed knowledge:** they have heard of MAC addresses, IP addresses, ports, and the terms switch, router, and firewall. They may not be able to say which one uses which.
- **What the briefing teaches:** a packet carries several addresses at once, and each device looks at only one of them. The briefing defines destination MAC, destination IP, protocol, destination port, TTL, flooding, default route, and implicit deny, and uses a worked example that differs from the challenge.
- **Why interaction helps:** learners often think "the switch routes by IP" or "any device can see everything". Choosing a gate forces them to commit to the field the device reads, and a wrong choice shows what that device would actually do.
- **Session target:** 5–10 minutes for a first playthrough, with unlimited thinking time.

## Learning outcomes and evidence

| ID | After playing, the learner can… | The game asks them to… | Evidence of success |
| --- | --- | --- | --- |
| LO1 | Explain that a switch forwards a frame by destination MAC, and floods when the MAC is unknown | Pick the exit port for a frame given a MAC table | Both Level 1 rounds solved with the correct gate |
| LO2 | Apply a router's forwarding decision using the destination IP, using the default route when no specific route matches, and recognize that TTL drops by 1 and the MAC is rewritten | Pick the egress interface for a packet given a routing table | Both Level 2 rounds solved; TTL and MAC values shown after the hop match the rule |
| LO3 | Evaluate an ordered firewall rule list on protocol and port, with first match winning and implicit deny when nothing matches | Pick the rule that decides the packet's fate | Both Level 3 rounds solved with the correct rule or implicit deny |

## The technical model

- **Rule being taught:**
  - **Switch:** look up the destination MAC in the MAC table. If found, forward out that one port. If not found, flood out every port except the ingress port.
  - **Router:** find the route whose prefix contains the destination IP. If no specific route matches, use the default route (0.0.0.0/0). Forward out that route's interface, decrement TTL by 1, and rewrite the Ethernet addresses. The IP addresses are unchanged.
  - **Firewall:** check rules top to bottom. The first rule whose protocol and destination port both match decides the packet. If no rule matches, the implicit deny at the end drops it.
- **Context:** simplified, vendor-neutral model of unicast IPv4 over Ethernet II.
- **Assumptions:** the switch's MAC table is already learned, ARP is already resolved, the router has only connected routes and one default route, and the packet's TTL is at least 2.
- **Excluded behavior:** VLANs, spanning tree, ARP exchanges, broadcast and multicast, IPv6, NAT, stateful inspection, overlapping route prefixes and longest-prefix tie-breaking, TTL expiry, fragmentation, and the physical layer (copper versus fiber).
- **Authoritative references:**
  - IEEE 802.1D-2004, forwarding process (clause to be confirmed before release): a bridge forwards a frame by its destination MAC, and floods when the destination is unknown.
  - [RFC 1812](https://www.rfc-editor.org/rfc/rfc1812) §5.2.4.3 (Next Hop Address): a router chooses the next hop by matching the destination IP against its routes, with a default route as the fallback.
  - [RFC 1812](https://www.rfc-editor.org/rfc/rfc1812) §5.3.1 (Time to Live): a forwarding router decrements TTL.
  - [RFC 9293](https://www.rfc-editor.org/rfc/rfc9293) §3.1 (Header Format) and [RFC 768](https://www.rfc-editor.org/rfc/rfc768): TCP and UDP both have destination ports, and the protocol is part of what identifies the traffic.
  - [NIST SP 800-41 Rev. 1](https://csrc.nist.gov/pubs/sp/800/41/r1/final) §3 (firewall technologies, packet filtering; section to be confirmed): packet filters evaluate rules in order, and a default-deny posture is the recommended baseline.

Tell the learner about these boundaries in plain language. The game accepts exactly one correct gate per round. Rounds whose data could produce two valid answers are authoring errors, not part of the first version.

## The repeatable game loop

1. **Brief:** introduce the device and the one header field it reads, with a worked example different from the challenge.
2. **Inspect:** show the packet's header fields and the device's table, with every decision-relevant value visible.
3. **Choose:** the player selects one gate and explicitly submits.
4. **Explain:** display the result, the values used, and the rule that connects them.
5. **Retry or advance:** a wrong answer leaves the round playable, and a correct answer enables Next.
6. **Reflect:** the level summary shows completed rounds, valid attempts, dropped packets, and assistance used.

**Worked interaction (Level 1, Round 1):** The player sees a frame from PC-A arriving on switch port Gi0/1, with destination MAC `00:aa:00:00:00:03`. The MAC table lists `…:01` on Gi0/1, `…:02` on Gi0/2, and `…:03` on Gi0/3. The gates are Gi0/1–Gi0/4, Flood, and Drop. A plausible wrong move is choosing Gi0/1, because that is where the packet came from. Feedback: "Gi0/1 is where the frame arrived. The switch searches its MAC table for the destination MAC, 00:aa:00:00:00:03, and that is learned on Gi0/3. A switch never sends a frame back out its ingress port. Your packet was dropped; try again." The correct move is Gi0/3: the packet passes through, and the explanation names the table entry.

## Required stories and acceptance criteria

### US1 · Make and understand a decision — P1

As a learner, I want to apply the rule to visible evidence and understand the result.

- **AC1:** Given a fresh session, when I start, then I see the first briefing before answering a challenge.
- **AC2:** Given Level 1 Round 1 (ingress Gi0/1, destination MAC `00:aa:00:00:00:03`, table as in the cases), when I submit Gi0/3, then the packet passes through Gi0/3, the round is marked solved, and the explanation names the destination MAC and the matching table entry.
- **AC3:** Given that challenge, when I submit Gi0/1, then feedback says the switch searches by destination MAC and not by where the frame arrived, completion stays unchanged, one dropped packet is tallied, and I can retry.
- **AC4:** Given no selection or malformed input, when I submit, then input guidance appears and attempts, dropped packets, and completion remain unchanged.

### US2 · Learn from help and finish the game — P1

As a learner, I want help when stuck and a clear view of my progress.

- **AC5:** A hint first explains the method ("find the header field this device reads, then look it up in the table"). Further help can show a worked solution. Assistance is recorded without marking the round complete.
- **AC6:** Each valid submission counts as one attempt until the round is solved. A wrong attempt also adds one to the dropped-packets tally, which is shown separately from attempts and has no consequence beyond display. A correct submission completes the round once, and repeated submission after success has no effect.
- **AC7:** A level completes after both of its rounds are solved. Next opens the following round or level, and the final round opens a session summary.
- **AC8:** Restart asks for confirmation, then clears the current session and returns to the first briefing. Cancel preserves the session.

### US3 · Play with accessible controls — P1

As a keyboard user, I want to inspect the challenge, choose, submit, get help, and advance without a mouse.

- **AC9:** All core controls have visible focus and accessible names, and keyboard interaction reaches every core action. Gates are a native radio group.
- **AC10:** Correct and incorrect feedback includes text, remains available to read, and is announced to assistive technology. Motion can be reduced without losing information, and the header's before and after values are shown as text.

## Version-one content

**Three levels, two rounds per level, six rounds total.** One new example per round, and the same core mechanic throughout: choose the gate this device would use.

| Level | New concept | Prerequisite | Misconception to expose |
| --- | --- | --- | --- |
| 1 · Switch (LO1) | Switches forward by destination MAC; unknown MAC means flood | Knows what a MAC address is | Choosing by where the frame came from, or thinking an unknown destination is dropped |
| 2 · Router (LO2) | Routers match the destination IP to a route, fall back to the default route, rewrite the MAC, and decrement TTL | Level 1 | Picking an interface because the address "looks similar", or thinking a router drops traffic it has no specific route for |
| 3 · Firewall (LO3) | Rules are checked top to bottom, the first match decides, and no match means implicit deny | Level 2 | Matching on port alone and ignoring protocol, or reading past the first matching rule |

**Progression:** sequential on first playthrough, with retry and no penalty. Completion requires a correct submission in every round. Hints remain available. No points, lives, timer, leaderboard, or streak mechanic in v1. The dropped-packets tally is information only.

**Session behavior:** progress is held for the current page session, and reload starts again. Saving across reloads is a stretch feature and must be specified before it is added.

## Cases the implementation must satisfy

Expected results below are hand-checked from the rule statements above. Switch MAC table (SW1): `00:aa:00:00:00:01`→Gi0/1, `…:02`→Gi0/2, `…:03`→Gi0/3. Gi0/4 is an uplink with no learned entries. Router R1 routes: `192.168.1.0/24` connected on Gi0/0, `192.168.2.0/24` connected on Gi0/1, `0.0.0.0/0` via `203.0.113.1` out Gi0/2. Firewall FW1 rules: 1 DENY TCP 23, 2 PERMIT TCP any, 3 PERMIT UDP 53, then implicit deny.

| Case | Input state | Player action | Expected result | Why / source |
| --- | --- | --- | --- | --- |
| L1R1 correct | SW1 above; ingress Gi0/1; dst MAC `…:03` | Submit Gi0/3 | Correct; forwarded out Gi0/3 only | Destination MAC found in table (802.1D) |
| L1R1 plausible mistake | Same | Submit Gi0/1 | Incorrect; feedback: lookup uses destination MAC, Gi0/1 is the ingress port | Source/ingress confusion |
| L1R2 correct (boundary: unknown MAC) | Same table; ingress Gi0/1; dst MAC `…:09` | Submit Flood | Correct; out Gi0/2, Gi0/3, Gi0/4, not Gi0/1 | Unknown destination is flooded (802.1D) |
| L1R2 plausible mistake | Same | Submit Drop | Incorrect; feedback: a switch floods unknown unicast, it does not drop it | Drop misconception |
| L2R1 correct | R1 above; ingress Gi0/0; src `192.168.1.10`; dst `192.168.2.77`; TTL 64 | Submit Gi0/1 | Correct; out Gi0/1; TTL becomes 63; destination MAC is rewritten to the next hop's | Prefix match, RFC 1812 §5.2.4.3 and §5.3.1 |
| L2R1 plausible mistake | Same | Submit Gi0/2 | Incorrect; feedback: a specific connected route matches, so the default route is not used | Default route misuse |
| L2R2 correct (boundary: near-miss prefix) | Same R1; dst `192.168.3.10`; TTL 64 | Submit Gi0/2 | Correct; default route via `203.0.113.1`; TTL 63 | 192.168.3.10 is outside 192.168.2.0/24 and 192.168.1.0/24; default route is the fallback |
| L2R2 plausible mistake | Same | Submit Gi0/1 | Incorrect; feedback: 192.168.3.10 is not inside 192.168.2.0–192.168.2.255 | Looks-similar misconception |
| L3R1 correct | FW1 above; TCP, dst port 23 | Submit Rule 1 | Correct; DENY, decided by rule 1 | First match wins, even though rule 2 would also match |
| L3R1 plausible mistake | Same | Submit Rule 2 | Incorrect; feedback: rules are checked top to bottom and rule 1 matches first | Reading past first match |
| L3R2 correct (boundary: port right, protocol wrong) | FW1 above; UDP, dst port 443 | Submit Implicit deny | Correct; no rule matches, so DENY | Protocol and port must both match |
| L3R2 plausible mistake | Same | Submit Rule 3 | Incorrect; feedback: rule 3 matches UDP but only port 53, not 443 | Protocol-only matching |
| Extra boundary | FW1 above; UDP, dst port 53 | (Evaluator case) | Rule 3, PERMIT | Both fields match rule 3 |
| Unsupported content | Router table with no default route; two overlapping non-default prefixes; switch destination MAC equal to the ingress port's own entry; TTL below 2 | Open round | Visible content error; no grading or progress | Authoring error, not learner failure |

## Experience direction

- **Visual metaphor:** a side-scrolling wire. The player's packet travels toward a device "boss" whose gates are labeled with its real table entries. The header is drawn as labeled chips on the packet.
- **One memorable moment:** after a correct router hop, the packet's header chips rewrite in front of the player: the destination MAC changes and TTL goes from 64 to 63, while the IP addresses stay put. A wrong gate fragments the packet and bumps the dropped-packets tally.
- **Always visible:** the full header (source and destination MAC, source and destination IP, protocol, destination port, TTL), the device's complete table, and every gate label.
- **Feedback voice:** patient and specific; explain the observed choice before offering the next step.
- **Layout:** challenge first, action next, explanation beside or below it. Don't hide technical values behind hover-only interactions.

## Non-goals

No user accounts, multiplayer, backend, live infrastructure access, runtime AI, leaderboard, or level editor. No shooting or reflex gameplay. No simulation of ARP, spanning tree, VLANs, NAT, stateful firewalls, TCP handshakes, congestion control, or fiber-versus-copper physical layers. Visual polish must fit the existing mechanic.

## Open decisions for clarify

- Is "Flood" a single gate (current proposal) or should the player select the set of ports it reaches? A set would be more precise, but it changes the choice shape and the evaluator.
- Should the router round's TTL and rewritten MAC be graded, or only displayed after a correct choice? Current proposal: displayed and checked in tests, not part of the player's answer.
- Is a stateless firewall acceptable for Network+ learners, given that exam material emphasizes stateful inspection? Current proposal: yes, and the briefing states this exclusion.

Delete this section when resolved, or record the answer beside each question. Don't let unresolved decisions become silent implementation guesses.

## Release evidence

All required acceptance criteria must have a recorded result. All six rounds and their explanations must be checked against the references. A teammate must complete the core flow using only the keyboard. The README must describe implemented behavior, exact run/test commands, and any remaining limits.
