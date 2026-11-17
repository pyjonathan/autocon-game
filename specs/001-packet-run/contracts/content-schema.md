# Contract: Authored Content (`data/levels.json`)

The shape of the content file is defined in [data-model.md](../data-model.md). This contract states what the loader guarantees.

## Loading

- The file is fetched over HTTP with a relative URL, and the whole document is validated before the first screen shows.
- On a validation failure the game shows an error screen naming the level and round ID, offers a retry-load action, and grades nothing.
- A content or loading error never counts as a learner attempt.

## Authoring rules

- Add a round by adding data and its checks. The rule engine, scoring, and screens do not change (Principle VI).
- Briefings state the model's boundaries (simplified IPv4 over Ethernet, stateless firewall, no overlapping prefixes) wherever they affect what the player can conclude.
- Each level references source records with a title, URL, section, and claim. Sources flagged "to be confirmed" in the spec must be confirmed before release.
- Per-gate misconception wording is data. Numbers (TTL, matched prefix, ports) come from evaluator evidence.

## Example round (Level 1, Round 1; abbreviated)

```json
{
  "id": "l1r1",
  "ingress": "gi0-1",
  "packet": {
    "srcMac": "00:aa:00:00:00:01", "dstMac": "00:aa:00:00:00:03",
    "srcIp": "10.0.0.1", "dstIp": "10.0.0.3",
    "protocol": "TCP", "dstPort": 443, "ttl": 64
  },
  "gates": [
    {"id": "gi0-1", "label": "Gi0/1"}, {"id": "gi0-2", "label": "Gi0/2"},
    {"id": "gi0-3", "label": "Gi0/3"}, {"id": "gi0-4", "label": "Gi0/4"},
    {"id": "flood", "label": "Flood"}, {"id": "drop", "label": "Drop"}
  ],
  "misconceptions": {
    "gi0-1": {"text": "Gi0/1 is where the frame arrived, and a switch never sends a frame back out its ingress port. ..."}
  }
}
```

The example omits the help text and wording fields. The expected gate (`gi0-3`) is not stored in the round; the evaluator derives it from the table.
