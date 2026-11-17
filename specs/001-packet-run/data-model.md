# Data Model: Packet Run

Entities come from the spec's Key Entities. Authored entities live in `data/levels.json`; session entities live in memory only.

## Authored content

### Document

| Field | Type | Rules |
| --- | --- | --- |
| `schemaVersion` | integer | Required; must be a supported version |
| `sources` | list of Source | Required; unique IDs |
| `levels` | list of Level | At least 1. The shipped file has exactly 3 in the order switch, router, firewall (FR-020), which a test on the shipped file checks. The runtime validator does not enforce that count, so a trial level or round can be added by editing data only (SC-007) |

### Source

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | Unique |
| `title` | string | Required |
| `url` | string | Required |
| `section` | string | Required |
| `claim` | string | The statement this source supports |
| `unconfirmed` | boolean (optional) | `true` while the section reference is unverified. The game then shows the source's title and claim but not its section |

### Level

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | Unique |
| `title` | string | Required |
| `device` | `"switch"` \| `"router"` \| `"firewall"` | Selects the evaluation algorithm |
| `outcome` | string | Learning outcome (LO1, LO2, or LO3) |
| `briefing` | object | Terms, method, a worked example different from the challenge, and the model's exclusions |
| `sourceIds` | list of string | Each must exist in `sources` |
| `table` | Table | Shape depends on `device` (below) |
| `rounds` | list of Round | At least 1. The shipped file has exactly 2 per level (checked by the shipped-file test, not the runtime validator) |

### Table by device

- **Switch:** `ports` (list of `{id, label}`), `macEntries` (list of `{mac, portId}`).
- **Router:** `interfaces` (list of `{id, label, address, prefixLength}`), `routes` (list of `{prefix, prefixLength, interfaceId, nextHop?}`). The default route is `0.0.0.0/0`.
- **Firewall:** `rules`, an ordered list of `{id, action, protocol, dstPort}`. `action` is `PERMIT` or `DENY`, `protocol` is `TCP` or `UDP`, and `dstPort` is an integer or `"any"`.

### Round

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | Unique across the document |
| `packet` | Packet header | See below |
| `ingress` | string | Must name a port or interface in the level's table (not used for firewall rounds) |
| `gates` | list of Gate | Must contain the evaluator's expected gate |
| `help` | object | `method` and `steps` (using the round's own values), shown in that order. The correct gate is added by the game from the evaluator, so it is not authored |
| `display` | object | Display-only values. Router rounds: `rewrittenSrcMac` and `rewrittenDstMac` shown after the hop |
| `misconceptions` | map of gate ID → reason code and wording | Optional specific feedback for plausible wrong gates. Wrong gates without an entry get the generic explanation built from evaluator evidence (reason code `wrong-gate`) |

### Packet header

| Field | Type | Valid values |
| --- | --- | --- |
| `srcMac`, `dstMac` | string | Six two-digit hex groups, colon-separated; compared case-insensitively |
| `srcIp`, `dstIp` | string | Dotted-quad IPv4, each octet 0–255 |
| `protocol` | string | `TCP` or `UDP` |
| `dstPort` | integer | 1–65535 |
| `ttl` | integer | 2–255 |

### Gate

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | Unique within the round. Switch: port IDs, `flood`, `drop`. Router: interface IDs, `drop`. Firewall: rule IDs, `implicit-deny` |
| `label` | string | Shown to the player and used as the accessible name |

## Validation rules (content errors)

A content error names the level and round ID, is never graded, and never counts as a learner attempt.

- Missing or wrongly typed fields; duplicate level, round, port, interface, or rule IDs.
- Invalid MAC, IPv4, protocol, port, or TTL values; TTL below 2; route prefix lengths of 31 or 32.
- A router table with no default route, or with two overlapping non-default prefixes.
- A switch destination MAC that is broadcast or multicast, or that the table maps to the ingress port.
- An `ingress` or table entry that refers to an unknown port or interface.
- A gate list that lacks the evaluator's expected gate, or lists a gate not in the table.
- A source ID that does not exist.

## Session state (in memory)

| Field | Type | Meaning |
| --- | --- | --- |
| `view` | enum | `loading`, `briefing`, `awaiting-answer`, `feedback`, `summary`, `error` |
| `position` | `{levelIndex, roundIndex}` | Current round |
| `rounds` | map of round ID → RoundProgress | One entry per round |
| `droppedPackets` | integer | Total valid wrong submissions; display only |
| `pendingRestart` | boolean | True while the restart confirmation is open |

### RoundProgress

| Field | Type | Meaning |
| --- | --- | --- |
| `solved` | boolean | True only after a valid, correct submission |
| `attempts` | integer | Valid submissions while unsolved |
| `wrongAttempts` | integer | Valid wrong submissions; at 2 or more, feedback names the correct gate |
| `assisted` | boolean | True once Help was used or the gate was revealed automatically; counts once |
| `helpRevealed` | boolean | True once the Help panel was opened, so it stays visible until the round is solved |

### Derived summary values

- Completed rounds: count of `solved`.
- Valid attempts: sum of `attempts`.
- Dropped packets: `droppedPackets`.
- Rounds assisted: count of `assisted`, out of the total number of rounds (6 in the shipped game).

## State transitions

```text
loading → briefing → awaiting-answer
awaiting-answer --Help--------------> awaiting-answer   (assisted = true; Help is not offered
                                                         once the round is solved)
awaiting-answer --invalid input-----> awaiting-answer   (no counters change)
awaiting-answer --valid wrong-------> feedback          (attempts+1, wrongAttempts+1,
                                                         droppedPackets+1; if wrongAttempts >= 2:
                                                         assisted = true and gate named)
feedback (wrong) --retry------------> awaiting-answer   (round still unsolved)
awaiting-answer --valid correct-----> feedback          (attempts+1, solved = true)
feedback (correct) --Next-----------> briefing | awaiting-answer | summary
solved round --any submit-----------> no change
loading failure | content error ----> error (retry loading)
Restart --confirm--> first briefing, all counters cleared
Restart --cancel---> no change
```

State transitions happen only in `engine/state.js`. Selecting a gate never changes state.
