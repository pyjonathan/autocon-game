# Packet Run

**Choose the exit gate a packet takes at a switch, a router, and a firewall, and learn which part of the header each device reads.**

Packet Run is a browser game for beginners studying for CompTIA Network+. You play as a data packet travelling from a laptop to a server. At each device you read the packet's header and the device's own table, pick the gate that device would send you through, and read why. Each round explains the result so you can use it on the next challenge.

A project from **NAF AC6 — Loop Engineering, Spec-Driven Development & the Future of VibeOps**.

| Project | Details |
| --- | --- |
| Status | Playable and automatically tested. A human keyboard pass, a human content review, and two source-section confirmations are still outstanding (see Verification) |
| Networking topic | Switch (destination MAC, flooding), router (destination IP, default route, TTL, MAC rewrite), firewall (protocol and port, first match, implicit deny) |
| Typical session | 5–10 minutes, with unlimited thinking time |
| Live demo | Not published |
| Built by | Jonathan Buchanan |

## The challenge

A frame from PC-A arrives on switch SW1 on port Gi0/1. The header shows its destination MAC, `00:aa:00:00:00:03`, and SW1's MAC table lists which port each MAC was learned on. You pick one of six gates (four ports, Flood, or Drop) and submit. If you pick Gi0/1, the game explains that a switch never sends a frame back out its ingress port and that it searches by destination MAC, then lets you try again. From the second wrong attempt on, it also names the right gate.

## What you'll learn

| By the end, you can… | You'll practice by… |
| --- | --- |
| Explain that a switch forwards a frame by destination MAC, and floods when the MAC is unknown | Choosing the exit port from a MAC table (Level 1) |
| Apply a router's decision from the destination IP, using the default route as a fallback, and see TTL drop by 1 and the MAC addresses rewritten | Choosing the egress interface from a routing table (Level 2) |
| Evaluate an ordered firewall rule list on protocol and port, where the first match wins and no match means implicit deny | Choosing the rule that decides a packet (Level 3) |

**Before playing:** you should have heard of MAC addresses, IP addresses, ports, switches, routers, and firewalls. The briefings teach the rest.

## Play locally

Open a terminal in the project root and run:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

On Windows with the Python launcher:

```powershell
py -m http.server 8000 --bind 127.0.0.1
```

Open **http://127.0.0.1:8000**. Keep the terminal running; **Ctrl+C** stops the server. If port 8000 is busy, use 8001 in both the command and the URL.

The game loads JavaScript modules and a JSON file over HTTP, so opening `index.html` directly with `file://` is not supported. [Why modules need serving](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules). It needs only static files: no account, backend, model, or API key.

## How to play

1. Read the briefing for the level and inspect the packet header and the device's table.
2. Select one gate and press **Submit**.
3. Read the explanation. A wrong answer lets you try again, and a correct answer enables **Next**.
4. Use **Help** if you are stuck. It shows the method, then the worked steps for this round, then the correct gate. Help is recorded as assistance and does not solve the round.
5. Finish all six rounds (three levels of two) to reach the summary.

| Control | Action |
| --- | --- |
| Gate options (arrow keys, Space, or click) | Choose a gate. Selecting never submits |
| Submit (Enter, Space, or click) | Submit the selected gate. Nothing is counted if no gate is selected |
| Help | Reveal the worked solution for this round (not offered once the round is solved) |
| Try again | After a wrong answer, clear the selection and choose again |
| Next | After a correct answer, go to the next round, level, or the summary |
| Restart | Opens a confirmation. Confirm clears the session, and Cancel or Esc changes nothing |

**Progress:** a round completes only on a valid, correct submission. Attempts, dropped packets (one per wrong answer), rounds solved, and rounds assisted (Help used, or the gate revealed after the 2nd wrong attempt) are shown separately. Dropped packets are only a tally: there are no lives, timer, or score. Progress lives in the page, so a reload starts a fresh session.

## What this game models

A simplified, vendor-neutral model of unicast IPv4 over Ethernet.

- **Switch:** looks up the destination MAC in an already-learned MAC table. A hit forwards out that one port, and a miss floods out every port except the ingress port.
- **Router:** finds the route whose prefix contains the destination IP, or uses the default route if none does. It decrements TTL by 1 and rewrites the Ethernet addresses. The IP addresses stay the same.
- **Firewall:** a stateless, ordered rule list on protocol and destination port. The first match wins, and no match means implicit deny.

**Outside the model:** VLANs, spanning tree, ARP exchanges, broadcast and multicast, IPv6, NAT, stateful inspection (many real firewalls are stateful), overlapping route prefixes and longest-prefix tie-breaking, TTL expiry, fragmentation, and the physical layer.

| Reference | What it supports |
| --- | --- |
| [RFC 1812](https://www.rfc-editor.org/rfc/rfc1812), §5.3.1 Time to Live (TTL) | A forwarding router must reduce the TTL (confirmed against the RFC text) |
| [RFC 1812](https://www.rfc-editor.org/rfc/rfc1812), §5.2.4.3 Next Hop Address | How a router selects a route for a destination (section title confirmed; the default-route wording has not been re-read line by line) |
| [RFC 9293](https://www.rfc-editor.org/rfc/rfc9293) §3.1 and RFC 768 | TCP and UDP both carry a destination port, and the protocol is part of what identifies the traffic |
| IEEE 802.1D-2004, forwarding process | A bridge forwards by destination MAC and floods unknown destinations. **Clause not confirmed**, so the game does not show a section for it |
| [NIST SP 800-41 Rev. 1](https://csrc.nist.gov/pubs/sp/800/41/r1/final), packet filtering | Rules are evaluated in order, and default deny is the recommended baseline. **Section not confirmed**, so the game does not show a section for it |

## How it was built

The project follows the workshop's Spec Kit workflow: **constitution → specify → clarify → plan → tasks → analyze → implement**.

- **Stack:** semantic HTML, CSS, and native JavaScript modules. No framework, bundler, or runtime dependency.
- **Build tools:** Claude Code with GitHub Spec Kit (version 1.4.0, per `.specify/init-options.json`). A Chrome DevTools driver was used to check the game in a real browser. That driver is not part of this repository.
- **Runtime:** a modern browser and any static file server.
- **Planning inputs:** `CONSTITUTION.md`, `SPEC.md`, and `PLAN.md` in the repository root (the starter-kit inputs; `PLAN.md` predates the clarification session).
- **Working artifacts:** `.specify/memory/constitution.md`, `specs/001-packet-run/spec.md`, `plan.md`, `tasks.md`, `data-model.md`, `contracts/`, and `quickstart.md`.
- **One useful design decision:** the analysis step caught that a validator requiring exactly 3 levels of 2 rounds would have blocked adding a round by editing data alone. The runtime validator now accepts any valid content, and a separate test checks that the shipped file has the 3×2 shape.

```text
index.html, style.css, main.js   Page shell, styles, load → validate → start
engine/rules.js                  Pure evaluator: decides the one correct gate
engine/content.js                Validates the content file before play
engine/state.js                  The only place counters and progress change
engine/feedback.js               Builds explanations from the evaluator's evidence
engine/net.js                    MAC and IPv4 helpers
ui/render.js, ui/controls.js     Rendering, input, and focus handling
data/levels.json                 Briefings, tables, rounds, help, and sources
tests/                           Browser test runner and tests
```

## Verification

**Last checked:** 2026-11-17, Windows 11, Google Chrome (headless) for browser checks, Node v24.15.0 for the terminal test run, Python 3.14.4 static server. The repository had no commits beyond the initial one when these checks ran, so there is no commit identifier to cite.

Run the tests by opening **http://127.0.0.1:8000/tests/** with the server running. Optionally, `node tests/run-node.mjs` runs the same tests in a terminal. An empty test suite counts as a failure.

| Check | Result | Evidence / notes |
| --- | --- | --- |
| Correct, incorrect, and boundary cases (rules) | **Pass** | 86 of 86 automated tests pass in both the Chrome test page and Node. They cover all 12 spec cases, UDP 53, invalid input, and content errors. Expected values were hand-written from the spec |
| Invalid content is rejected without grading or counting | **Pass** | 4 spec cases (no default route, overlapping prefixes, destination MAC on the ingress port, TTL below 2) show a visible error naming the level (and round), with no playable screen. A missing content file shows a load error with a retry action |
| Briefings and explanations checked against sources | **Not run** (independent review) | Written by the same author as the code. RFC 1812 §5.3.1 was checked against the RFC text. The IEEE 802.1D clause and NIST section remain unconfirmed. A human reviewer is still needed |
| Retry, help, duplicate Submit, completion, restart | **Pass** | A 35-check scripted playthrough in Chrome covers wrong and right answers, the 2nd-wrong-attempt reveal, Help, duplicate submit, all six rounds, the summary counts, and restart with confirm, cancel, and Esc |
| Keyboard-only core playthrough | **Pass (simulated)** | A script sent real Tab, Space, Arrow, Enter, and Escape key events through all six rounds, Help, the summary, and restart, and checked visible focus on the main controls. **A human keyboard-only pass has not been done** |
| Narrow layout | **Pass** | At 360 px wide, no horizontal page overflow, the action buttons stay inside the window, and tables scroll in labeled containers |
| Reduced motion | **Pass** | With reduced motion, animations are off while before/after values remain as text. With motion allowed, the packet and header animations run |
| Add a round by editing data only | **Pass** | A third round added to Level 1 validates and plays, with no change to the rules code |
| Fresh run from static files only | **Pass** | Served by a plain static server, with no requests leaving the local origin and no console errors |
| Screen-reader testing, other browsers, other platforms | **Not run** | Only headless Chrome on Windows was used. This is not an accessibility certification |
| Post-workshop learner checks (time to finish, recall of what each device reads) | **Not run** | To be recorded by the facilitator after the session |
| Published demo | **Not applicable** | No demo is published |

## Known limitations and next steps

- **Known limitation:** the IEEE 802.1D clause and the NIST SP 800-41 section are not confirmed, and no human has reviewed the teaching text or run the game with a keyboard only or a screen reader.
- **Known limitation:** a stateless firewall is a simplification. Real firewalls are usually stateful.
- **Next improvement:** add a round with overlapping prefixes to teach longest-prefix match, which this version excludes on purpose.

Found an incorrect answer or unclear explanation? Open an issue with the level and round, the input values, your choice, the expected result, the actual result, and a reference if available.

## Credits

Created by Jonathan Buchanan. Workshop by John Capobianco, Joksan Flores, and Elliot Conner. Adapted from the [NAF AC6 workshop materials](https://github.com/automateyournetwork/NAF_AC6) and [Networking Video Game Starter Kit](https://github.com/automateyournetwork/NetworkingVideoGameStarterKit), using [GitHub Spec Kit](https://github.com/github/spec-kit).

**Assets and dependencies:** the game uses only original assets and has no runtime dependencies.

**License:** no license file has been added to this repository yet.
