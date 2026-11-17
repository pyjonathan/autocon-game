# Contract: Rule Evaluator

Module: `engine/rules.js`. A pure function. It has no DOM access, timers, network calls, random choice, or progress changes.

## Signature

```text
evaluate(level, round, answer) → {
  status:     "correct" | "incorrect" | "invalid-input" | "content-error",
  expected:   { gateId, ... } | null,
  reasonCode: string,
  evidence:   object
}
```

- `answer` is a single gate ID string, or an empty or missing value.
- `invalid-input`: no selection, or an ID not in the round's `gates`. It never counts as an attempt.
- `content-error`: the round violates a validation rule in [data-model.md](../data-model.md). It is never graded.
- `incorrect`: a valid gate that is not the expected one.

## Algorithms

| Device | Expected gate | Evidence |
| --- | --- | --- |
| Switch | The port whose MAC entry equals the normalized `dstMac`. If none, `flood`. | Destination MAC, matched entry or null, ports flooded (all except ingress) |
| Router | The interface of the one non-default route containing `dstIp`. If none, the default route's interface. | Matched route, whether the default route was used, TTL before and after (minus 1), `rewrittenSrcMac`, `rewrittenDstMac` |
| Firewall | The first rule, top to bottom, whose protocol equals the packet's and whose port equals or is `any`. If none, `implicit-deny`. | Matched rule, its action, or the implicit deny |

## Reason codes

Stable identifiers used by feedback and tests: `correct`, `ingress-port-chosen`, `flood-expected`, `drop-chosen-unknown-mac`, `default-route-misused`, `outside-prefix`, `rule-order-ignored`, `protocol-mismatch` (the chosen rule is for a different protocol), `port-mismatch` (the chosen rule has the right protocol but a different port), `wrong-gate` (generic fallback for any wrong gate without specific wording), `no-selection`, `unknown-gate`, `content-error`.

## Guarantees

- Same inputs always produce the same result.
- The expected gate never depends on gate order, label, or animation.
- Tests compare against expected values written from the spec, not values computed by this function.

## Feedback

`engine/feedback.js` turns the result into text using the evidence values and the round's `misconceptions` wording from data.

- A wrong answer explains the mistake and a next step, and does not name the correct gate on the first wrong attempt. Gates without specific wording get a generic explanation from the evidence (reason code `wrong-gate`).
- From the 2nd wrong attempt on, the text also names the correct gate (FR-022). The state module supplies the wrong-attempt count.
- A correct answer explains why it works, including TTL and MAC values for router rounds.
