# Rules

Connect the Atlantic and Pacific coasts using 24 state cards.

## Playing

- A solvable deal is ready when the page opens. There is no start button or time limit.
- Begin with a card marked **COAST**, then add cards that border the last state.
- Each state can appear only once in the route.
- Clicking a played card in the hand or on the map removes it and all following cards.
- Reaching the opposite coast **ends the game automatically**. You cannot extend
  a route past that coast. **End game** immediately gives up and shows the solutions.
- **New game** immediately replaces the current game. Abandoned games are not counted.
- Dismissing the **You win** dialog starts a new game automatically.

Pacific endpoints: **CA, OR, WA**.

Atlantic endpoints: **ME, NH, MA, RI, CT, NJ, NY, DE, MD, VA, NC, SC, GA, FL**.

The deck uses the contiguous 48 states, excluding Alaska, Hawaii, and DC.
Gulf-only states are not endpoints. Borders include **AZ–CO, NM–UT, MI–MN,
and NY–RI**, as in the original game, even where there is no land border.

## Map

Played states are highlighted. Their cards form a left-to-right row about two-thirds
down the map, independent of the states' locations. Long rows scroll horizontally.
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
the card to remove instead.

After using Hint, the **next successfully added card scores 0**, even if it is
not the highlighted card. Invalid attempts and removing cards do not consume the
penalty. Multiple hint requests before playing do not stack penalties.

The zero-point card stays at zero for that game, including after undoing and
replaying it. Pending penalties and zero-point cards persist across reloads.

## Points and records

The score is the sum of the route's card values, excluding zero-point cards.
Each invalid card selection subtracts the state's original point value, including
invalid first cards and repeated mistakes. Hint penalties do not reduce this cost.
Undoing cards is free and does not erase mistake deductions. Scores may be negative.
Mistake deductions persist across reloads and reset with New game. Your final score
and personal records include them; example solution scores do not include mistakes.

| Points | States                                                                     |
| ------ | -------------------------------------------------------------------------- |
| 1      | AL, AR, CA, CO, GA, IN, KS, KY, LA, MD, MS, MO, NV, NC, SD, TN, VA, WV, WY |
| 2      | AZ, DE, FL, ID, IL, IA, MN, MT, NE, NJ, ND, OH, OK, OR, SC, TX, UT         |
| 3      | CT, MA, MI, NH, NM, NY, PA, RI, VT, WA, WI                                 |
| 4      | ME                                                                         |

Personal records keep the top 10 wins by points. Equal scores put the most recent
game first. No countdown, elapsed duration, or completion time is tracked or stored
for new games or records.
Each score shows its winning path and points. Older records without paths show a dash.

## Solutions

Results show your played route and its points first. Below it are the shortest
and longest routes using the dealt cards, measured
by card count, not score. Both obey automatic completion at the first opposite
coast. If their lengths match, one solution is shown.

Each route shows its point total using the game's zero-point cards from hints.
Routes use small linked cards showing only state abbreviations. The longest
route is calculated exactly in a worker so the page stays responsive.

## Local data and effects

The current game, penalties, records, and sound setting are stored in this browser.
Blocked storage permits play without saving. **Your scores → Clear** removes
scores and game counts after confirmation, keeping the current game, hint penalties,
and sound setting. Clearing browser data removes all local data.
Earlier-format saves are archived, and compatible
games and point records are migrated without carrying time fields into active play.

Animations and sounds do not change scores. Reduced-motion settings disable
animation. Sound starts after interaction and can be muted. There is no music,
external audio download, analytics, or game server.
