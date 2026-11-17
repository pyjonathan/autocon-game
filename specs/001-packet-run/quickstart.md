# Quickstart: Validating Packet Run

A run-and-verify guide. The files described here do not exist until implementation creates them. Details live in [data-model.md](data-model.md) and [contracts/](contracts/).

## Prerequisites

- A current desktop browser.
- Python 3 (used only as a static file server).

## Run the game

From the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

On Windows use `py` in place of `python3`. Open **http://127.0.0.1:8000**. Opening `index.html` directly with `file://` is not supported.

## Run the automated checks

With the same server running, open **http://127.0.0.1:8000/tests/**. The page must show totals and the IDs of any failed cases. Zero discovered tests counts as a failure. The same tests can also be run from a terminal with `node tests/run-node.mjs` (optional; it needs Node but no packages).

## Validation scenarios

Record **pass / fail / not run**, the date, the environment, and evidence for each in the README.

| # | Scenario | Expected outcome | Spec reference |
| --- | --- | --- | --- |
| 1 | Fresh start | The first briefing shows before any challenge | AC: US1-1 |
| 2 | L1R1: submit `Gi0/3` | Correct; explanation names destination MAC `00:aa:00:00:00:03` and its table entry | US1-2 |
| 3 | L1R1: submit `Gi0/1` | Incorrect; feedback explains destination MAC lookup; correct gate not named; tally +1; round still unsolved | US1-3 |
| 4 | L1R1: a 2nd wrong answer | Feedback now names `Gi0/3`; round is marked assisted; still unsolved until `Gi0/3` is submitted | FR-022 |
| 5 | Submit with nothing selected | Guidance shown; attempts, tally, and completion unchanged | US1-4 |
| 6 | Use Help on any unsolved round | Method, worked steps, then the gate appear in order; round is assisted, not solved. After the round is solved, Help is not offered | FR-010 |
| 7 | Submit again after a correct answer | Nothing changes | US2-3 |
| 8 | L1R2 (`…:09`): submit `Flood` | Correct; explanation lists Gi0/2, Gi0/3, Gi0/4, not Gi0/1 | Edge case |
| 9 | L2R1: submit `Gi0/1` | Correct; TTL shows 64 → 63 and the source and destination MACs change; IPs unchanged | US1-5 |
| 10 | L2R2 (`192.168.3.10`): submit `Gi0/1` | Incorrect; explains it is outside 192.168.2.0–192.168.2.255 | Edge case |
| 11 | L3R1: submit `Rule 2` | Incorrect; explains first match wins and rule 1 matches first | Edge case |
| 12 | L3R2 (UDP 443): submit `Implicit deny` | Correct | Edge case |
| 13 | Finish all six rounds | Summary shows completed rounds, valid attempts, dropped packets, and rounds assisted (out of 6 in the shipped game), separately | US2-5 |
| 14 | Restart, then cancel | Session unchanged | US2-6 |
| 15 | Restart, then confirm | Session cleared; first briefing shows | US2-6 |
| 16 | Break a content file (each of the four invalid-content examples) | Visible content error naming the level and round; not graded; no attempt counted | SC-004 |
| 17 | Keyboard-only playthrough, start to summary | Every core action reachable with visible focus; feedback announced | US3 |
| 18 | Narrow window | Layout stacks; tables scroll in their own container; action buttons remain visible | FR-018 |
| 19 | Reduced motion enabled | No information lost; before and after values shown as text | FR-017 |
| 20 | Fresh browser session with only the static files | Game plays with no backend or external service | FR-019 |
| 21 | Add a trial round (a third round in one level) by editing data only | The content still validates, and the round plays and is graded without any change to the rules code | SC-007 |
| 22 | Choose a wrong gate that has no specific wording (for example Gi0/4 in L1R1) | Generic explanation from the evidence; no crash; counted as a wrong attempt | FR-005 |

## Content review

A person checks every shipped briefing and explanation against the references in the spec, and confirms the two flagged source sections (IEEE 802.1D clause, NIST SP 800-41 section) before release.
