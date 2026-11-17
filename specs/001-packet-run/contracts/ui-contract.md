# Contract: Player Interface

What the player can see and do on each screen. Requirement IDs refer to [spec.md](../spec.md).

## Screens

| Screen | Contents | Primary actions |
| --- | --- | --- |
| Loading / error | Status text; on error, the level and round ID and what failed | Retry loading |
| Briefing | Device, the one header field it reads, terms, a different worked example, model boundaries | Start the level (Continue) |
| Challenge | Packet header chips with every value, the device's complete table, the gates, the dropped-packets tally, an explanation area | Select gate, Submit, Help, Restart |
| Feedback | Result in text, values used, the rule, the explanation; after 2 wrong attempts, the correct gate | Retry (wrong) or Next (correct) |
| Summary | Completed rounds, valid attempts, dropped packets, rounds assisted (out of the total number of rounds), shown separately | Restart |

## Controls

- **Gates:** a native single-choice group with a visible group label and one labeled option per gate. Selecting a gate does not submit.
- **Submit:** explicit. Disabled after the round is solved, and also guarded in state logic.
- **Help:** a single action that reveals the method, then the worked steps, then the gate, and marks the round assisted. Offered on an unsolved round (including while wrong-answer feedback shows) and not offered once the round is solved.
- **Next:** appears only after a correct submission.
- **Restart:** opens a confirmation. Confirm clears the session and returns to the first briefing. Cancel changes nothing.

## Required text equivalents

- Every header value and every table row is shown as text, never only as an image or animation.
- The dropped-packets tally and attempts are separate labeled values.
- Router rounds show TTL and the source and destination MACs before and after as text.
- Each diagram has a text description that carries the same information.

## Accessibility behavior (FR-015 to FR-018)

- Every control is reachable and operable by keyboard, in an order that follows the visible layout, with visible focus and an accessible name.
- Feedback appears in a live region and stays on screen until the player moves on.
- Focus moves deliberately when the screen changes (to the heading or the feedback).
- Success and failure use text and an icon or label in addition to color.
- With reduced motion requested, animations are replaced by the text before and after values, and nothing waits on animation.
- At a narrow width, the layout stacks, dense tables scroll inside a labeled container, and Submit, Help, and Next stay visible.

## Motion (when motion is allowed)

- Correct router hop: the header chips rewrite in place (source and destination MACs change, TTL 64 → 63, IPs unchanged).
- Wrong gate: the packet fragments and the dropped-packets tally increments.
- Animation never delays feedback or controls.
