# Rules

Connect the Atlantic and Pacific coasts using bordering state cards.

Cards placed on the map use blue borders: 1px on mobile and 2px on desktop.
Gold hard cards retain their gold borders and stars in both themes.

## Difficulty

**Easy** is the default. A dropdown in the top header selects **Easy**, **Medium**, or
**Challenging**, immediately starting a new game and remembering the choice.
Existing games without a difficulty remain Challenging.

Easy shows four larger, neutral-colored selection cards at a time, with centered
full state names and no abbreviations. Map-chain and result cards retain their
compact abbreviations. Faded state seals decorate Easy selection-card backgrounds;
text and borders stay fully opaque. Missing images never block play. Its initial hand has
four coastal states, with at least one from each coast; every pick is valid.
After each valid pick, the hand changes to two valid neighboring states and two
invalid states, shuffled together. When only one winning continuation is
available, it shows one valid and three invalid states. Offered valid choices
always leave a route to the opposite coast without repeating states. Invalid
picks leave the hand unchanged. Reloading preserves the current hand.
Extremely long routes may show already-played non-neighbors as invalid choices
if unused distractors run out; they cannot be played again.

Easy uses all 48 states rather than a fixed 24-card deal. Cards are worth 1 point,
with no gold bonuses or separate coastal-card styling. Hint zeroes the next played
card; each invalid pick deducts 1 point. The moving deadline and its acceleration
are unchanged. Click later map-chain cards to undo; the first card remains locked.
Undo prepares appropriate choices for the restored route. Reaching the opposite
coast automatically wins.

**Medium** follows Easy's rules with six choices instead of four and **2 points
per card**. Its six starting choices are all coastal and cover both coasts.
Later hands contain two winning continuations and four invalid choices (one valid
and five invalid when required). Invalid picks deduct 2 points; hints still zero
the next played card permanently. Medium uses the same deadline, undo rules,
full-name cards, and simplified win screen as Easy.
Medium's desktop hand uses three rows of two cards; phone hands keep two rows
of three cards.

All difficulties use decorative state-seal backgrounds on hand cards: 120px
images in Easy/Medium at 12% opacity and 60px images in Challenging at 10%. Challenging
keeps its centered abbreviations, points, and gold markers above the seals.
The gold star sits in the header so it does not shift the abbreviation off-center.
Hand cards do not show a COAST label; coastal identity remains in accessible names
and Challenging's blue coastal-card highlight.
Images are local, never block play, and do not appear on compact map/result cards.

Personal top-ten scores, counts, and bests are separate by difficulty; Clear
resets all three. All difficulties contribute to the existing daily leaderboard.
Easy/Medium results show the actual route, points, completion time, and personal best
time, announcing a strictly faster time. No longest/most-points reference is
computed or shown. The win dialog also offers “Finding this too easy? Try
Challenging mode!” with a toggle that immediately starts Challenging and saves
that preference.

The detailed deal, gold-card, and reference-solution rules below describe
Challenging; shared rules (borders, penalties, deadline, undo, and effects) also
apply to Easy and Medium.

## Playing

- A solvable deal is prepared when the page opens. A spinner shows while card
  values are calculated, then play is ready without a start button.
- Begin with a coastal card highlighted in blue, then add cards that border the last state.
- Coastal hand cards receive a brief shine sweep every few seconds while play is
  ready and no card has been played, marking the starting choices. It never blocks
  selection and stops on first play; undo does not restart it. It pauses while
  the page is hidden, and reduced motion skips it.
- Every coastal card in a new deal has at least one winning route when selected
  first. Later choices can still require backtracking. Existing saves are unchanged.
- Each state can appear only once in the route.
- The first coastal card is locked for the game. Clicking it in the hand or map
  does not remove it or its suffix. Clicking any later played card removes that
  card and its suffix, including later coastal cards.
- Reaching the opposite coast **ends the game automatically**. You cannot extend
  a route past that coast. There is no assisted-completion control.
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
Bright blue shoreline edges mark the Atlantic and Pacific coastal states,
without coloring their inland borders or changing played-state highlights.

On phones, the map sits above smaller cards in portrait, or to their right in
landscape. Controls and the points total share one row, with a music-note sound
toggle in portrait; the counter does not cover the map. Portrait maps use the
available width, including on shorter screens.
Portrait hands use four rows of six cards. Spare space below those rows goes to
the map panel, moving route cards and messages lower to reduce artwork overlap.
The hand scrolls independently when needed. **?** opens How to play.
The map's bottom message area shows a starting prompt, hints, and errors without
changing the board height. The starting prompt shows a rounded-down lower bound
on the number of winning routes after successful exact analysis (for example,
“more than 7,000”). Counts include both directions separately
and stopping at the first opposite coast. It survives reloads and fades after your
first valid card. Older saves and incomplete analyses omit the count.
In portrait this area stays at the panel's lower edge and may overlap the US. Messages
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

## Moving deadline

The first coastal card starts a single narrow red vertical line at the map panel's far left for a
Pacific start, or far right for an Atlantic start—not at the US outline. It moves
across the entire panel, darkening the area behind it. At its initial speed a full
crossing takes **100 seconds**. Each additional valid card adds **8% of the base
speed**; each Hint or invalid card selection adds **35%**, including penalties before
starting and repeated hints or mistakes. Speed is capped at **3×**. Removals do not
accelerate it. These speed penalties do not replace hint-zeroing or mistake point deductions.

The line chases the geographically furthest-forward state in your current route,
not the last card or the zig-zag card positions. It makes that state pulse dark red when it
touches the state's near edge. Once it passes the far edge, the game ends:
**Try again** appears for one second, then a new game begins automatically. A
timeout counts as one loss and does not reveal an assisted solution.
The message uses larger lettering and a black outline, without text shadows,
in both themes. This styling does not extend the feedback delay
or animate when reduced motion is enabled.

Undo never rewinds the line, refunds acceleration, or changes its initial direction.
The starting card cannot be removed. Older saves with an empty route after the
line started must resume at the original starting card, not a different coast.
The line pauses while the page is hidden (another tab, minimized browser, or locked
phone), and resumes without charging hidden time. Progress and speed survive
reloads; time spent away is not charged. Existing saves without a line start at
zero progress. Wins stop the line; New game resets it.

The 3px-wide line has a subtle glow without repeating internal animation. On the
first coastal play it slams down to the panel's bottom with a brief impact burst;
sparks shed from it while it moves. These effects do not delay the deadline or
change collision rules. Reloading resumes the line without replaying its entrance.
Reduced motion skips the slam, impact, and sparks, and uses a solid red warning
instead of pulsing while keeping the functional deadline.
There is no numeric clock and time does not affect points or score rankings.

## Points and records

Every new Challenging card starts at **3 points**. A **hard card** earns a **+1 bonus**, for **4 points
total**, and is marked with a gold border and gold star (★) in the hand, map chain,
and results. Hard cards keep their ordinary card
colors everywhere: coastal hand cards keep their coastal blue fill, other hand cards stay blue,
and map/result cards keep their existing backgrounds and text colors.

Hard cards occur in **more than zero but fewer than 20%** of this deal's winning
routes. Exactly 20% is not hard; cards that cannot occur in a winning route stay
at 3 points. Count all legal ordered winning routes from either coast, stopping at
the first opposite coast. Reversed routes count separately when both are legal.

Values are calculated exactly in a worker **before play**, then frozen for that
game, including undo, hints, and reloads. If analysis fails or exceeds its work
budget, a notice is shown and all cards are frozen at 3 points. Partial counts
never grant bonuses. Existing games retain their original point values, and
previous score records are not recalculated.
New successfully analyzed games always contain at least one gold card. During
preparation, hands without gold are re-dealt, up to 128 candidates within the
worker's two-second computation budget. The announced all-3-point fallback is
the exception if a qualifying hand cannot be prepared within those limits.

The score is the sum of the route's assigned values, excluding zero-point cards.
Hints zero the whole card, including any hard-card bonus.
Each invalid card selection subtracts the card's assigned value (3 or 4 in new Challenging games), including
invalid first cards and repeated mistakes. Hint penalties do not reduce this cost.
Undoing cards is free and does not erase mistake deductions. Scores may be negative.
Older saved Challenging games keep their frozen 1/3-point or original legacy
values; they are never re-scored. New scoring is versioned as `hard-v3`, with
`base-v2` for the three-point fallback. Medium uses `choice-v1`; Easy stays unchanged.
Mistake deductions persist across reloads and reset with New game. Your final score
and personal records include them; example solution scores do not include mistakes.

Personal records keep the top 10 wins by points. Equal scores put the most recent
game first. New wins also save active play time, measured from the first coastal
card until winning, pausing while hidden and across reloads. No wall-clock
timestamps are stored. Old in-progress games without timing retain no measured time.
The win dialog shows **Your best time** and **Most points** across personal wins,
even when the fastest win falls outside the top ten. The first recorded value sets
a baseline. Later strictly faster times or higher scores show a new-record notice
and a brief celebration; ties do not. Reduced motion keeps the notice without
animation. Reloads do not recount wins or replay record celebrations. Time does not
affect points or online rankings. Clearing Your scores also resets these bests.
Each score shows its winning path and points. Older records without paths show a dash.

## Solutions

Win results show your played route and its points first, with its measured time
beside the points when available, for comparison with your personal bests. Below it is the
most-points route using the dealt cards and frozen point values. Score ties
prefer fewer cards. Routes stop at the first opposite coast. No shortest route
is displayed. New game is the blue primary action.

Each route shows its point total using the game's zero-point cards from hints.
Routes use small linked cards showing only state abbreviations, with smaller
reference cards on mobile. The most-points route is calculated exactly in a worker
so the page stays responsive.

## Local data and effects

The sun/moon button beside difficulty switches between light and dark themes.
Dark is the default. The choice is saved locally and survives New game, difficulty
changes, and Clear. Theme changes never restart play, change scoring, or reset
the moving deadline. Both themes preserve coastal, gold, hint, and deadline cues.
Bright blue marks interface/card/map borders, buttons, points, coastal edges,
and played-card markers, replacing the former green accents. Gold difficulty
cues and red deadline warnings remain distinct. Panels and cards have compact,
squared-off corners; touch-target sizes are unchanged.
Dark mode uses solid black and very dark gray surfaces without gradients or grid
texture. Unplayed coastal cards in Challenging use a distinct solid blue fill;
played cards return to charcoal, and gold difficulty borders stay gold.
Geographic outlines and state boundaries use the same dark gray in both
themes. The extra rectangular map frame is removed in both themes; game/card
frames and separate coastal markers remain blue.

When the optional online leaderboard is configured, **Daily leaderboard**, beside
**Your scores**, shows cumulative winning points for the current UTC day, even
when logged out. Use the top-bar login/logout icon to sign in with Google before
winning to contribute. First login assigns a random pet-style public name to the
account; click the name in the top bar to change it. Chosen names persist across
logins. Each game counts once; timeout losses,
abandoned games, and previous anonymous wins do not count. Hint and mistake
deductions still apply, including negative winning totals. Ties share a rank.
The board changes at midnight UTC without deleting history. Queued offline wins
count on the day the server first receives them. Your public player name and
total are visible to everyone; Google names/emails are not published. Scores are
browser-reported, not cheat-resistant. Local score clearing affects no online data.

The visible score increases when animated points reach the total. Scores and
wins are saved immediately; reduced motion updates the total immediately.

The current game, penalties, records, and sound setting are stored in this browser.
Blocked storage permits play without saving. **Your scores → Clear** removes
scores and game counts immediately, keeping the current game, hint penalties,
and sound setting. Clearing browser data removes all local data.
Your scores scrolls vertically when the list is taller than the screen.
Earlier-format saves are archived, and compatible
games and point records are migrated without carrying old duration fields into active play.

Animations and sounds do not change scores. Reduced-motion settings disable
decorative animation, not the moving deadline. Sound starts after interaction and can be muted. There is no music,
external audio download, analytics, or game server.
