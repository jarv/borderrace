# Rules

Connect the Atlantic and Pacific coasts using 24 state cards.

## Playing

- A solvable deal is prepared when the page opens. A spinner shows while card
  values are calculated, then play is ready without a start button or time limit.
- Begin with a card marked **COAST**, then add cards that border the last state.
- Each state can appear only once in the route.
- Clicking a played card in the hand or on the map removes it and all following cards.
- Reaching the opposite coast **ends the game automatically**. You cannot extend
  a route past that coast. **End game** immediately gives up, then animates a
  completion on the map. It preserves the longest solvable prefix, removing
  blocked cards before adding the shortest continuation. Reduced motion skips
  the animation. Only **New game** remains enabled, including during completion.
  Assisted completion is not a win and does not change your score or hint penalties.
- **New game** immediately replaces the current game. Abandoned games are not counted.
- Dismissing the **You win** dialog starts a new game automatically.
- Wins are saved immediately, with a two-second celebration before results appear.
  Reduced motion skips the animation delay.

Pacific endpoints: **CA, OR, WA**.

Atlantic endpoints: **ME, NH, MA, RI, CT, NJ, NY, DE, MD, VA, NC, SC, GA, FL**.

The deck uses the contiguous 48 states, excluding Alaska, Hawaii, and DC.
Gulf-only states are not endpoints. Borders include **AZ–CO, NM–UT, MI–MN,
and NY–RI**, as in the original game, even where there is no land border.

## Map

Played states are highlighted. Their cards form a left-to-right row about two-thirds
down the map in a slight zig-zag, independent of the states' locations. Long routes
wrap into compact rows inside the map, without horizontal scrolling.
Cards have translucent backgrounds with opaque borders and text.
Undoing cards also removes their state highlights. Unplayed states have no
deck or next-move coloring. The map has no state labels.

On phones, the map sits above smaller cards in portrait, or to their right in
landscape. Controls share one row, with a music-note sound toggle in portrait.
The hand scrolls independently when needed. **?** opens How to play.
The map's bottom message area shows a starting prompt, hints, and errors without
changing the board height. The starting prompt fades after your first valid card.
In portrait this area stays below the US in the screen's upper half. Messages
appear above any overlapping route cards.

## Hints

**Hint** highlights a valid next card. If backtracking is needed, it highlights
the card to remove instead. Messages use abbreviations: **Play XX**, or
**Remove XX, play YY**. Removing XX still removes its entire suffix; YY is the
legal next card after that removal. The zero-point reminder is shown once.

After using Hint, the **next successfully added card scores 0**, even if it is
not the highlighted card. Invalid attempts and removing cards do not consume the
penalty. Multiple hint requests before playing do not stack penalties.

The zero-point card stays at zero for that game, including after undoing and
replaying it. Pending penalties and zero-point cards persist across reloads.

## Points and records

Every card starts at **1 point**. A **hard card** earns a **+2 bonus**, for **3 points
total**, and is marked gold. Coastal hard cards retain a green background with a
gold border so they remain recognizable as coastal cards.

Hard cards occur in **more than zero but fewer than 20%** of this deal's winning
routes. Exactly 20% is not hard; cards that cannot occur in a winning route stay
at 1 point. Count all legal ordered winning routes from either coast, stopping at
the first opposite coast. Reversed routes count separately when both are legal.

Values are calculated exactly in a worker **before play**, then frozen for that
game, including undo, hints, and reloads. If analysis fails or exceeds its work
budget, a notice is shown and all cards are frozen at 1 point. Partial counts
never grant bonuses. Existing games retain their original point values, and
previous score records are not recalculated.
New successfully analyzed games always contain at least one gold card. During
preparation, hands without gold are re-dealt, up to 128 candidates within the
worker's two-second computation budget. The announced all-1-point fallback is
the exception if a qualifying hand cannot be prepared within those limits.

The score is the sum of the route's assigned values, excluding zero-point cards.
Hints zero the whole card, including any hard-card bonus.
Each invalid card selection subtracts the card's assigned value (1 or 3), including
invalid first cards and repeated mistakes. Hint penalties do not reduce this cost.
Undoing cards is free and does not erase mistake deductions. Scores may be negative.
Mistake deductions persist across reloads and reset with New game. Your final score
and personal records include them; example solution scores do not include mistakes.

Personal records keep the top 10 wins by points. Equal scores put the most recent
game first. No countdown, elapsed duration, or completion time is tracked or stored
for new games or records.
Each score shows its winning path and points. Older records without paths show a dash.

## Solutions

Win results show your played route and its points first. Below it is the
most-points route using the dealt cards and frozen point values. Score ties
prefer fewer cards. Routes stop at the first opposite coast. No shortest route
is displayed. End game leaves the completed map visible, without a result dialog.

Each route shows its point total using the game's zero-point cards from hints.
Routes use small linked cards showing only state abbreviations, with smaller
reference cards on mobile. The most-points route is calculated exactly in a worker
so the page stays responsive.

## Local data and effects

The current game, penalties, records, and sound setting are stored in this browser.
Blocked storage permits play without saving. **Your scores → Clear** removes
scores and game counts immediately, keeping the current game, hint penalties,
and sound setting. Clearing browser data removes all local data.
Your scores scrolls vertically when the list is taller than the screen.
Earlier-format saves are archived, and compatible
games and point records are migrated without carrying time fields into active play.

Animations and sounds do not change scores. Reduced-motion settings disable
animation. Sound starts after interaction and can be muted. There is no music,
external audio download, analytics, or game server.
