# AAA Snake: PROMPTS

Every prompt sent to Claude Code for this project, verbatim and numbered. Earlier entries are never edited.

## 1. Setup, Snake v1.0, the measurement rig, the short recorder, the proposed updates

````text
You are building the project for CodeMask episode 4: "How I Turned Snake
Into a AAA Game with Claude Code". We start from an honest, tiny Snake game
and release a series of "updates". Each update adds one cliché of big-budget
games (unskippable intro, story cutscenes, open world, progression, a fake
battle pass, a day-one patch...). The joke is told with real measurements:
after every update we measure how much heavier and slower the game got and
how long it now takes to reach the first apple. Every update also becomes a
30-second vertical short, released as we go; the long video comes last.

This prompt covers setup, Snake v1.0, the measurement rig, the short-clip
recorder, and a PROPOSED list of updates. Do not build any update yet.

## Part A: repository and rules
Create a new local git repository `aaa-snake`. Do not push and do not create
a remote. Add:

1. CLAUDE.md with these rules, to hold for the whole project:
   - Browser game. Plain HTML/JS/canvas for v1.0; later updates may add
     tooling only when the update needs it, and every dependency is pinned
     and logged in DEVLOG with the reason.
   - Performance budget: the target machine is my MacBook with an Apple M1
     chip. Graphics may get fancier from update to update, but stay 2D
     canvas plus at most one lightweight WebGL post-processing pass. No 3D
     engines, no heavy asset packs. Every version must stay playable on the
     M1: median frame rate at least 50 fps and 5th percentile at least
     30 fps in `npm run measure`, unless an update is explicitly approved
     as a "this one is slow on purpose" joke, and even then never below
     30 fps median.
   - Every update is one git tag (v1.0, v1.1, ...) and one build in
     dist/<version>/. Every version stays playable side by side. Never
     rewrite an old tag.
   - Game logic is deterministic: no Math.random and no wall-clock time in
     game state. Use a seeded generator. Same seed and same inputs give the
     same game.
   - Numbers: only measured ones, produced by `npm run measure`, with the
     command and the raw output saved under measurements/. Never estimate.
     Never round in the logs.
   - Parody only: purchase buttons, loot boxes and "premium currency" are
     fake. No payment SDKs, no network requests for them, no real prices
     charged; every purchase screen carries a visible "parody" label. No
     real game, studio, brand or character names, logos or art, and no hero
     that imitates a known game character.
   - Disclosure: any generated image or voice line records the tool name
     and version as shown in its UI, the date and the exact prompt.
   - PROMPTS.md: every prompt I send you, verbatim and numbered.
   - DEVLOG.md: what you did, what broke, the real numbers, and anything
     surprising or funny that actually happened in the session (quote it,
     do not invent or polish it).
   - Anonymity: commits authored as CodeMask (copy the identity from the
     bug-driver repo, never the global git config), TZ=UTC for every
     commit, no local paths, no usernames, no .DS_Store, no personal data.
   - All repository text in English.
2. PROMPTS.md (this prompt is #1), DEVLOG.md, a short README, .gitignore.

## Part B: Snake v1.0
1. A small, honest, fun Snake: grid, arrow keys/WASD, apples, growing,
   game over, score, restart. Plain squares, no effects. Target: about 200
   lines of game code, no dependencies. Readable code: this file will be
   shown line by line to beginners.
2. Tag v1.0 and build it to dist/v1.0/.

## Part C: measurement rig (`npm run measure <version>`)
Use a headless browser (Playwright, pinned). It runs on my M1 Mac; record
the machine model, chip, RAM, OS and browser version in every measurement
file. A scripted bot player with a fixed seed plays the given version. For
each version, 5 runs; save every run's raw numbers and the median to
measurements/<version>.json. Measure:
1. Time to first apple: from navigation start to the moment the first apple
   is eaten. The bot always takes the fastest allowed path: it presses skip
   wherever the game allows skipping and goes straight for the apple. Log
   which screens it had to pass through, with the time spent on each.
2. Control share: over a fixed 3-minute session, the share of time in which
   the player's input actually steers the snake (vs. intros, cutscenes,
   menus, loading, popups). This is our pre-registered proxy for "is it
   still a game".
3. Load time: navigation start to the first frame that accepts input.
4. Size: lines of code (state the tool), bytes of JS, bytes of all assets,
   total download bytes.
5. Memory: JS heap after 60 s of play (state exactly which metric).
6. Frame rate during play: median and 5th percentile. Say whether headless
   frame rate matches a visible window on this Mac; if it does not, measure
   frame rate in a visible window instead and say so.
Also write measurements/summary.csv with one row per version, and
`npm run chart` that renders the "bloat chart" (each metric vs. version)
to out/bloat.png from that CSV.
Run the rig on v1.0 and on a test fixture page, and add tests for the rig.

## Part D: proposed update list (proposal only)
Write UPDATES.md with 8 to 10 proposed updates in order. For each: the
version, the AAA cliché it parodies, what exactly changes in the game, how
it should move the metrics, a one-line corporate-style patch note, whether
it needs generated art or voice, and what it does to the graphics within
the performance budget. Starting ideas (change, reorder or replace them,
and say why):
- unskippable intro and studio logos;
- story and voiced cutscenes: the snake becomes a gritty action hero,
  working name "Commander Snek", with a tragic backstory, while on screen
  it is still a few squares;
- open world with hundreds of map markers and still one apple;
- skill tree where "Turn left" is a skill unlocked at level 5;
- a parody battle pass and loot boxes (fake) whose top reward is "the
  ability to see the apple";
- a day-one patch and a loading screen;
- an always-online check (local stub, no network);
- a "remastered" edition with the fanciest graphics the budget allows;
- a final update where an in-game arcade cabinet runs v1.0.
Leave one slot open for a feature chosen by viewers in the comments; mark
it as such and say where in the order it could go.
Graphics should climb step by step (for example: smooth movement and a
sprite with eyes, then lighting and shadows on a textured field, then
cinematic post-processing in the remaster), never past the budget.
Do not repeat jokes from the web game "Triple-A Minesweeper" (yellow paint on
ledges, a hero who keeps repeating his task). Mark which updates could be
skipped if time runs out.

## Part E: short-clip recorder (`npm run short <version>`)
Every update will be released as a 30-second vertical short before the long
video exists, so each version must produce its clip by script, in one
fixed layout:
1. Output: 1080x1920, 30 fps, up to 30 s, H.264 MP4 plus the frames, under
   out/shorts/<version>/. Recorded from the headless browser with the same
   seeded bot as the rig.
2. Layout, identical for every version: the patch note card at the top
   (version and the one-line note from UPDATES.md), the game in the middle,
   and a live counter "time to first apple" at the bottom that counts up
   during the clip and freezes at the measured median from
   measurements/<version>.json. The counter must show the measured number,
   never an estimate.
3. The clip starts on action (the game already moving or the update's
   first new screen appearing), never on a title card.
4. Keep a safe margin: nothing important in the bottom 25 % or the right
   15 % of the frame, where the app's buttons and captions sit.
5. Run it on v1.0 and show me the first, middle and last frames.

## STOP here
Commit and send me the report below. Do not build any update until I approve
UPDATES.md; it gets frozen before v1.1.

## Report format
- File tree and commit hashes
- v1.0: line count and a short description of how the code is organised
- Output of npm test and `npm run measure v1.0`, pasted as is
- out/bloat.png generated from v1.0 alone (to check the chart works)
- Three frames from `npm run short v1.0`
- UPDATES.md in full
- What broke
- Questions for me
- Output of `git log --format='%h %an <%ae> %cn <%ce> %cI'`, pasted as is
````

Built: the repo and its rules; Snake v1.0 (tag v1.0, dist/v1.0/); the measuring rig with a test fixture, `npm run fps-check`
and the bloat chart; the short recorder; UPDATES.md as a proposal. No update built.
What broke: the bot pressed before the first frame was drawn; headless WebGL ran in software; the per-frame frame-rate
median jumped under load; the short's first frame was a title card; the replay lost a key on the fixture. All fixed; see DEVLOG.md.

## 2. UPDATES.md approved with changes, answers, a longer v1.0 short, then build v1.1

````text
UPDATES.md is approved with these changes, then frozen before v1.1:
1. Rename the hero: Commander Snek becomes Warden Snek (a retired orchard
   warden). Keep every guardrail against imitating known characters.
2. v1.2: the day-one patch may be fetched only from the page's own origin
   (same host as the game). The rig keeps failing any request to another
   host. Write this into UPDATES.md and the rig's checks.
3. Keep the v1.5 note that control share may go up; it is an honest result
   of our pre-registered proxy and we will say so.
Answers: load time stays "first frame of a screen that accepts any key";
the replay-on-virtual-clock recorder is accepted; no "cinematic 30 fps"
mode in v1.9; 240 lines of v1.0 stay as they are.
Short clip: make v1.0's clip 20-25 s (several apples), counter frozen at
the measured median. Re-run `npm run short v1.0` and show the three frames.
Git identity: use the same author/committer email as the ping-vtuber repo
(codemask@codemask.invalid) for all future commits; do not rewrite history.
Then build v1.1 exactly as UPDATES.md describes, tag it, run `npm run
measure v1.1` and `npm run short v1.1`, update summary.csv and the bloat
chart, and STOP. Report: the measure output as is, the three frames, the
chart, DEVLOG quotes of anything that broke, git log as before.
````

Built: UPDATES.md frozen with the three changes; the rig's own-origin check and `accepts`-based load time; a 24 s v1.0
short; v1.1 Launch experience (tag v1.1), measured, its short, the chart with two versions.
What broke: a black first frame in the v1.1 short, chart labels under the line, two test bugs, and one commit made
while a test was failing (fixed in a later commit). See DEVLOG.md.

## 3. One fixed plan for every short; then build v1.2

````text
v1.1 is accepted. Two things, in this order.

## 1. Short clips: new fixed plan for every version
A short must open on the result, never on what the update added. From
now on every clip (including a re-render of v1.1) follows this plan:
- 0-3 s: the previous version reaches its first apple at real speed; its
  counter freezes at its measured median. Next to it, the new version's
  counter value appears, with the label "v<prev> -> v<new>".
- 3-6 s: the patch note, large.
- 6-22 s: the new version's screens from launch to the first apple, time-
  compressed (3x to 4x, whatever fits), the counter running at the
  bottom and freezing at the measured median.
- last 3 s: the new version eats its first apple at real speed.
Total 25-30 s. The counter always shows measured numbers; the speed-up
factor is shown on screen in small type ("4x"). Keep the safe margins.
Re-render v1.1 with this plan and show its first, middle and last frames.
v1.0 keeps its own clip (there is no previous version).

## 2. Build v1.2
Exactly as the frozen UPDATES.md describes: the day-one patch fetched from
the page's own origin only (the offOrigin rule must pass), the throttled
progress bar showing real bytes, "Installing", "Preparing your
experience", the loading screen with tips, patch notes scrolling by, then
"Press any key". Graphics step: the textured grass field drawn once
offscreen from the seed, soft shadows under the snake and the apple. Stay
inside the performance budget.
Before measuring, write in DEVLOG what you expect each metric to do and
why (direction only, no numbers). Then tag v1.2, run `npm run measure
v1.2` and `npm run short v1.2`, update summary.csv and the chart, run the
full npm test, and STOP. Do not start v1.3.

## Report
- The measure output as is; expected vs. measured direction per metric
- Three frames each for the re-rendered v1.1 and for v1.2
- The chart; DEVLOG quotes of anything that broke; git log as before
````

Built: one fixed plan for every short after v1.0 (v1.1 re-rendered); v1.2 Day-one patch (tag v1.2), expectations
written before measuring, measured, its short, the chart with three versions.
What broke: the patch's grass was drawn before it existed and froze the game; the comparison counter spilled out of
its box; three test bugs. See DEVLOG.md.

## 4. Frame rate over 60 s of play; then build v1.3, Story mode

````text
v1.2 is accepted.

## 1. Frame-rate method
Measure frame rate over 60 s of play (the same window as the memory
metric), not 60 s from page load. Re-measure v1.0, v1.1 and v1.2 with the
new method so every version uses the same one. Keep the old measurement
files under measurements/old-method/ and write in DEVLOG why the method
changed and what the old numbers were. Update summary.csv and the chart.

## 2. Build v1.3: Story mode, Warden Snek
Exactly as the frozen UPDATES.md describes. For the voice: do not generate
audio. Write every line to voice/LINES.md (numbered, with the scene and
the emotion in one word), add a placeholder silent audio of the right
length per line so the build and the rig work, and tell me the exact
ElevenLabs settings to use when I record them. The lines must not
imitate any known character; Warden Snek is a retired orchard warden.
Keep the guardrails from UPDATES.md. Graphics step as planned: dark
field, soft light around the head, glowing apple, letterbox in cutscenes.
Before measuring, write the expected direction of each metric in DEVLOG.
Tag v1.3, run measure and short, update the chart, full npm test, STOP.
Do not start v1.4.

## Report
As before, plus voice/LINES.md in full and the ElevenLabs settings.
````

Built: frame rate over the first 60 s of play, v1.0 to v1.2 measured again (old files in measurements/old-method/);
v1.3 Story mode with 17 lines in voice/LINES.md and silent placeholders (no audio generated), expectations written
before measuring, measured, its short, the chart with four versions.
What broke: a ghost apple after every bite; the light grew with the close-up; the E prompt covered the head; MP3
placeholders longer than their slots; two test bugs. See DEVLOG.md.

## 5. Build v1.4, Always online

````text
v1.3 is accepted. Build v1.4 (always online) exactly as the frozen
UPDATES.md describes: "Connecting to SnakeNet..." as a local stub with no
network request (the offOrigin rule and the external-request check must
stay at zero), a sign-in screen with a pre-filled guest account, a server
queue counting down from a seed-derived position, a terms-of-service
window that must be scrolled to the bottom before Accept lights up, and
seed-timed "Connection interrupted. Reconnecting..." pauses during play.
Graphics step: UI chrome only (top bar with online indicator and a
currency counter, toasts, spinners). No new rendering tech.
The voice files for v1.3 are still placeholders; when I replace them, the
build must pick them up without any other change. Make sure v1.4 inherits
them from the same place.
Before measuring, write the expected direction of each metric in DEVLOG,
and this time also write what you expect control share to do during play
(the reconnect pauses), separately from the launch screens. Tag v1.4, run
measure and short, update the chart, full npm test, STOP. Do not start
v1.5.
Report as before: measure output as is, expected vs. measured, three
frames, chart, DEVLOG quotes, git log.
````

Built: v1.4 Always online, with SnakeNet as a stub that makes no request (connecting, a guest sign-in, a queue from the
seed, terms to scroll before Accept, reconnect pauses from the seed), a top bar with an online indicator and Scales,
toasts and spinners; voice files from src/voice/ for every build (`npm run voice`); control share in play as a new
metric (also for v1.0 to v1.3, from their saved runs); expectations written before measuring, measured, its short, the
chart with five versions.
What broke: the short cut the last word of the patch note; three bugs in my own v1.4 test; v1.3 run 1 had no value
for control share in play. See DEVLOG.md.

## 6. Build v1.5, Open world

````text
v1.4 is accepted. Build v1.5 (open world) exactly as the frozen
UPDATES.md describes: a large world the camera follows, hundreds of map
markers (question marks, viewpoints, empty chests, collectibles with a
running total), a minimap, a full world-map screen, exactly one apple
placed far away by the seed with a quest marker pointing to it, "fast
travel coming in a future update". Rules unchanged: one cell per tick.
Graphics step: tiled textured world drawing only visible tiles, shadows
from trees and rocks, drifting cloud shadows, minimap. 2D canvas.
This is the first version that can hit the performance budget. Before
building, write in DEVLOG the world size you intend and why, and how
culling keeps the frame rate inside the budget. If the measured frame
rate falls below the budget, do not tune the world down silently: stop,
report the numbers, and ask me.
Before measuring, write the expected direction of each metric,
including the two control-share metrics separately. UPDATES.md predicts
control share may go UP here; say whether you still expect that and why.
Tag v1.5, run measure and short, update the chart, full npm test, STOP.
Do not start v1.6.
Report as before.
````

Built: the plan for the world written before building (256 x 256 cells, the apple at least 128 moves away, only the
cells in view drawn); v1.5 Open world with 600 markers, a minimap, a world map, a quest marker and fast travel
"coming in a future update"; a rig fix for a turn sent on a run's last look; expectations written before measuring,
measured, its short, the chart with six versions. The frame rate stayed inside the budget.
What broke: world.js did not load (a variable declared twice); the quest arrow hid under the minimap; v1.0's bot test
failed once (a turn sent on the run's last look counted as refused); an apostrophe broke tools/measure.mjs. See
DEVLOG.md.

## 7. Move the short's speed label; build v1.6, Progression

````text
v1.5 is accepted.
[If moving the label:] First, move the speed label in the short layout so
it never covers the game's top bar; re-render all shorts and show the
v1.5 middle frame.
Then build v1.6 (progression) exactly as the frozen UPDATES.md describes:
XP for moving and eating; "Turn left" (counter-clockwise) is a skill
unlocked at level 5, so until then only right turns work and a locked
turn shows "Skill locked: Turn left (requires level 5)"; every level-up
stops the game for a full-screen LEVEL UP and a skill-tree screen where
the next skill must be chosen before play resumes. The bot spends points
on "Turn left" first, then whatever comes first in the list; its path
search must respect the turns the probe says are allowed. Graphics step:
level-up particles, glowing XP bar, skill tree with animated links. 2D
canvas, inside the budget.
Before measuring, write the expected direction of each metric, both
control-share metrics separately, and your expectation for the first
apple's tick (right-turns-only paths are longer). Tag v1.6, run measure
and short, update the chart, full npm test, STOP. Do not start v1.7.
Report as before.
````

Built: the short's speed label moved into the patch-note card, all six shorts rendered again; a bot path search that
uses only the allowed turns, and the skill-tree rule in keys (logged in UPDATES.md); v1.6 Progression (XP, levels,
LEVEL UP!, a skill tree that sells back smooth movement, eye contact, the shadow and turning left); expectations
written before measuring, measured, its short, the chart with seven versions. The frame rate stayed inside the budget.
What broke: the bot's first turn-limited search was too slow; the skill tree would have offered Turn left too early
after several level-ups at once; test bugs; in one measured run the snake died right after the level-5 skill tree.
See DEVLOG.md.

## 8. Build v1.7, Season 1

````text
v1.6 is accepted. Do not change the post-skill-tree behaviour that killed
run 1; it stays as it is, and the series compares versions as built.
Build v1.7 (Season 1: parody battle pass and loot boxes) exactly as the
frozen UPDATES.md describes: the apple is visible only within a small
vision radius around Snek; the top battle-pass reward is "Apple Vision:
the ability to see the apple"; tiers fill from XP or "can be bought" with
a premium currency that cannot be bought (the button opens a PARODY
screen saying nothing is for sale); a loot box after every game over with
an opening animation, cosmetics only. No payment code, no network, no
prices. Graphics step: loot-box light rays and sparkles, the battle-pass
track with tier cards. 2D canvas, inside the budget.
Write the vision radius in cells in DEVLOG before building and say why.
The bot follows the rule already fixed in UPDATES.md: with no apple
visible it goes to the nearest unseen cell, ties broken by a fixed order.
Before any measurement, estimate in DEVLOG how long one headless run may
take with the search, and if a single run would exceed 20 minutes, stop
and tell me before running all five.
Before measuring, write the expected direction of each metric, both
control-share metrics, and the first apple's tick (it is no longer 163).
Tag v1.7, run measure and short, update the chart, full npm test, STOP.
Do not start v1.8.
Report as before, plus: how many cells the bot explored before it first
saw the apple, per run.
````

## 9. v1.7 again, with skins (sent while #8 was being worked on)

````text
v1.6 is accepted. Do not change the post-skill-tree behaviour that killed
run 1; it stays as it is, and the series compares versions as built.

Build v1.7 (Season 1: parody battle pass and loot boxes) exactly as the
frozen UPDATES.md describes, with one clarification of what "cosmetics
only" means, to be written in DEVLOG before building:

## Skins (the loot-box contents)
- 8 to 12 skins, all drawn in code: colour sets and small effects for the
  snake (a trail, a glow, a pattern). Rarities: Common, Rare, Epic,
  Legendary. The Legendary skin "Classic Green" is the snake's original
  v1.0 look: the game's starting appearance becomes its rarest item.
- Drop odds per rarity are shown in the game on the loot-box screen and
  written in UPDATES.md before building. Drops come from the game's seed,
  so they are deterministic; the bot never chooses or buys anything.
- A skin changes only how the snake is drawn: never speed, rules, tick or
  collision. A test proves a game plays identically under every skin.
- After each loot box, a wardrobe screen shows the new skin and the
  collection; it needs a key press to leave (the bot presses it as it
  does on any screen).
- Report: skin count, bytes added, and the odds table.

## The rest of v1.7, as frozen
- The apple is visible only within a small vision radius around Snek.
  Write the radius in cells in DEVLOG before building and say why.
- Battle pass: tiers fill from XP; the top reward is "Apple Vision: the
  ability to see the apple". "Buy" opens a PARODY screen saying nothing
  is for sale. No payment code, no network, no prices.
- A loot box after every game over, with an opening animation (light
  rays, sparkles). Battle-pass track with tier cards. 2D canvas, inside
  the budget.
- The bot follows the rule already fixed in UPDATES.md: with no apple
  visible it goes to the nearest unseen cell, ties broken by a fixed
  order.

## Before measuring
- Estimate in DEVLOG how long one headless run may take with the search.
  If a single run would exceed 20 minutes, stop and tell me before
  running all five.
- Write the expected direction of each metric, both control-share
  metrics, and the first apple's tick (it is no longer 163).

Tag v1.7, run measure and short, update the chart, full npm test, STOP.
Do not start v1.8.
Report as before, plus: how many cells the bot explored before it first
saw the apple, per run; and the skin and odds tables.
````

## 10. Record the Warden Snek voice (sent while #9 was being worked on)

````text
Record the Warden Snek voice. ElevenLabs voice ID: S44KQ3oLFckbxgyKfold
(my own Voice Design voice, not a library voice, not a clone).

- Write a script `npm run voice -- --record` that generates all 17 lines
  from voice/LINES.md through the ElevenLabs text-to-speech API:
  model eleven_v3, stability 0.5, output mp3_44100_64, the emotion tag
  from LINES.md placed before each line. The API key comes only from
  the environment variable ELEVENLABS_API_KEY; never write it to the
  repo, logs, DEVLOG or PROMPTS.md. The voice ID may be stored in
  LINES.md. No other network calls.
- Save to voice/<id>.mp3, replacing the silent placeholders. Then run
  `npm run voice -- --check`: every file must fit its slot; if a line
  does not fit, tell me which one and by how much, do not re-slot or
  speed up audio on your own.
- Fill in the disclosure line in README (synthetic voice, ElevenLabs,
  designed for this project) and DEVLOG (date, settings, how many
  takes).
- Run `npm run voice` to copy into all builds, re-record the shorts
  v1.3 to v1.6 (and v1.7 if it exists). Report the 17 durations
  against their slots and STOP. Game code must not change: `git diff`
  of src/ is empty.
````

## 11. Retakes for lines 14 and 16; voice in the shorts

````text
Voice report accepted. Do not touch the stash or v1.7 yet.

## Lines 14 and 16
Slots stay as they are: they set cutscene length and therefore every
measured number since v1.3. For each of the two lines record up to three
new takes with the same settings; keep the first take that fits its slot
and delete the others (log take count in RECORDING.json and DEVLOG). If
no take fits after three, shorten the text instead, keeping the meaning
and the emotion tag, re-record up to three takes, and note the old and
new text in LINES.md and DEVLOG. Never change a slot, never speed up or
trim audio. Then `npm run voice -- --check` must return 0, `npm run
voice` recopies into all builds, and the full `npm test` must pass.

## Voice in the shorts
Add an audio track to `npm run short`: silence throughout, except that
in every segment played at 1x (segment D, and A if a line falls there)
each Warden Snek line plays at the moment the replay triggers it, at its
recorded length. Segments played faster than 1x carry no voice. Shorts
for versions without voice (v1.0 to v1.2) get a silent track so all
files have the same structure. Re-record shorts v1.3 to v1.6 and state
for each which line(s) are heard and at what second. Keep the existing
text-not-box checks.

## Housekeeping
- The v1.3 to v1.5 mp4 files changed while v1.6 did not: find out why in
  at most 15 minutes and write one line in DEVLOG; if it takes longer,
  write that it is unexplained and move on.
- Leave the Voice Design description in LINES.md marked "proposed, not
  confirmed" until I send the actual prompt.

Report durations for 14 and 16 (every take), the test count, the shorts
table with voice timestamps, and STOP.
````

## 12. Segment D until the line ends; continue v1.7

````text
Voice report accepted. The shortened spoken line 16 stays as it is in
v1.3 to v1.6 (subtitle unchanged, slots unchanged).

## Fixed short plan, one change
Segment D now ends when the first apple's Warden Snek line finishes
(apple + 600 ms + the line's recorded length), not 1 000 ms after the
apple. Segment A carries no voice at all. The total still fits 25 to
30 s by the existing rule: raise the C factor in steps of 0.05 as far
as needed. Update the plan in README and DEVLOG, re-record shorts v1.3
to v1.6, and for each report: length, C factor, the second at which the
line starts and ends, and that the line is heard in full. Shorts v1.0
to v1.2 are unchanged.

## Continue v1.7
`git stash pop` and continue v1.7 exactly as prompt 8 says, with two
additions:
- In v1.7's story.js the subtitle of line 16 becomes "Another. The
  orchard remembers." with its slot pinned at 2 800 ms (not recomputed
  from the word count). Note it in DEVLOG; earlier builds keep the old
  subtitle.
- The v1.7 short uses the updated plan above.
Everything else from prompt 8 stands: radius 6 cells, the bot rule, the
20-minute run limit, expected directions written before measuring, tag
v1.7, measure, short, chart, full npm test, STOP, no v1.8. Report as
prompt 8 asks.
````

## 13. One run while building; close v1.7; v1.9 Remastered

````text
Stop the running measurement now (Ctrl-C it). New rule from this moment,
written into README (methods) and DEVLOG: during the build
`npm run measure <version>` does ONE headless run and ONE visible run;
summary.csv marks such rows "single run". The bot is deterministic (v1.7
runs 1 and 2: tick 7595 both), so repeats only measure timer noise. The
5-run medians for every version come later from a new
`npm run measure:final`, run once overnight before release. Do not run
it now.

## Close v1.7
Use headless run 1 as v1.7's numbers, do one visible run for FPS, then
the short, the chart, full npm test, tag v1.7. Short report: the usual
table, cells explored before the apple was first seen, the skin and odds
tables, what broke. Do not stop after it.

## v1.9 (remaster) right after
Write the plan in DEVLOG before coding: what "remaster" means in code,
exactly one lightweight WebGL post-process pass (bloom or similar; no 3D
engines), snake "hair physics" as a real simulation on the 20x20 grid
(cheap, deterministic, from the seed), and a "Minimum requirements"
screen whose numbers are the real ones: this build's download bytes, JS
heap after GC and asset size, read from the previous measurement, never
typed by hand. Budget as before: median >= 50 fps, p5 >= 30 fps on this
Mac; if the remaster drops below, scale the effect down until it fits
and say by how much. Nothing else changes: same world, same bot, same
rules, so the first apple's tick must stay 7595; a test checks that.
Expected directions for every metric written before measuring (FPS down,
bytes and heap up, time to first apple: say what you expect from the new
screen). Tag v1.9, measure (single run), short, chart, full npm test,
STOP. Do not start v2.0: its ending is not decided yet.
````

## 14. Fix the v1.7 camera inside v1.7; v2.0 with the ending decided

````text
v1.9 accepted. Two jobs, in this order.

## 1. Fix the v1.7 camera inside v1.7
Decision: no new version, no hotfix patch; v1.7 is simply rebuilt
correct. Apply the same camera fix v1.9 has to the v1.7 sources (the
visible rectangle covers all 480x480 pixels; the test from v1.9 runs
for v1.7 too). Rebuild dist/v1.7, move the v1.7 tag to the fixing
commit (say the old and new commit ids in DEVLOG and in the report;
nothing else in v1.7 changes, the first apple's tick stays 7595, the
rules files stay byte-identical), re-measure v1.7 (single run),
re-record its short with the tick-based key rule, re-run
`npm run requirements v1.7` so v1.9's REMASTERED screen shows the new
v1.7 numbers, and update the chart. Report the new v1.7 numbers next to
the old ones, plus the v1.7 tables that never reached me: skins with
rarities, drop odds, bytes added by skins, and v1.7's "what broke".

## 2. Build v2.0 as frozen in UPDATES.md, with the ending decided
The ending: inside the AAA game there is an arcade cabinet that runs
Snake v1.0. The snake eats the apple there, and that is the end of the
game.
- The cabinet runs the real v1.0 code: import the v1.0 modules from the
  repository history or the shared sources, do not copy them; a test
  proves the inner game reaches its apple at tick 3 with the v1.0 bot
  rule, exactly as dist/v1.0 does.
- Write in DEVLOG before building: where the cabinet stands (I have not
  decided: ask me first if you need it before you can plan; otherwise
  plan both and I will choose), how the bot reaches it (the bot rule
  goes into UPDATES.md before measuring, as always), what key enters it,
  and that arrow keys inside the cabinet count as control for both
  control-share metrics.
- After the inner apple: the game ends. Default: a THE END screen, then
  real credits that double as disclosure (Claude Code wrote the code,
  ElevenLabs voice designed for this project, who did what), no further
  screens, no restart loop. If I give you a different ending screen, use
  that.
- Measurement: the first apple of v2.0 is the one eaten inside the
  cabinet; the rig records the path to the cabinet as screens like any
  other. Expected directions for every metric written before measuring,
  including which way time to first apple moves for each cabinet
  placement.
- The v2.0 short's segment D is the inner apple and the ending, real
  time, with its voice line if one triggers.
No other features, no new jokes of your own: build what is written.
Tag v2.0, measure (single run), short, chart, full npm test, STOP.
Do not start v1.8.
````

## 15. The cabinet's place, and measuring a game that ends early

````text
Cabinet at the start, as frozen in UPDATES.md. Measurement when the game
ends before 60 s of control: both control-share metrics are computed
over the actual window up to THE END (control time / elapsed time until
the end screen), and the summary.csv row and the chart mark it "game
ended at N s". Time to first apple is unaffected. Write the rule in
README (methods) and DEVLOG before measuring, then continue prompt 12
as written.
````

## 16. Frame rate under 1 s of control; the short template; the trailer

````text
v1.7 fix and v2.0 accepted. The line-10 cutscene before THE END stays.
Do not run measure:final yet.

## FPS rule for games with less than 1 s of control (v2.0)
The median is taken over individual frames (1000 / frame ms), the
summary.csv cell says "median over N frames", and the budget check uses
it. Write the rule in README (methods) and DEVLOG, re-evaluate v2.0 from
the saved run (no re-measure), update the chart, and fix the overlapping
version labels at the end of the chart axis.

## Short template, three changes, then re-record everything
1. Premise line. Every short gets the same first line at the top, above
   the patch-note card: "I turned Snake into a AAA game." Under it the
   patch line: "Patch 1.4: online only." (version and a 2-4 word name
   taken from UPDATES.md). The patch-note text follows below; the
   font-shrink and text-not-box checks apply to all three. The premise
   line is visible from frame 0 of segment A.
2. Segment D ends when the first apple's Warden Snek line finishes
   (apple + 600 ms + the line's recorded length); for v2.0 it runs to
   the first frame of the credits. Segment A carries no voice. Total
   still 25 to 30 s by the existing rule (raise the C factor in steps
   of 0.05 as far as needed; v2.0 may be shorter if D ends earlier).
3. New mode `npm run short -- trailer v1.0 v2.0`: 1080x1920, both
   versions side by side from the same seed on a shared virtual clock,
   real time. Top line: "I turned Snake into a AAA game." Bottom: two
   counters, "Snake: first apple in 0.3 s" fixed once v1.0 eats, and
   the v2.0 counter running until its own first apple. v2.0 takes
   107 s, so: first 20 s real time, a time-compressed middle with the
   factor shown (same rule as segment C), the last 10 s real time with
   the inner apple, the line and THE END, so the real counter value is
   on screen at the end. Total 25 to 30 s.

Update the plan in README and DEVLOG. Re-record shorts v1.1 to v2.0
with the current recorder rules (v1.0 keeps its file, it is not
published on its own), record the trailer, and report per file: length,
C factor, the second at which the voice line starts and ends, and the
frame you consider the best still for each. STOP.
````

## 17. The host's voice in the shorts and the trailer

````text
Prompt 13 accepted, including the 15 / 5 / 10 s trailer timing and the
"0.320 s" counter. Before recording: set the short patch names in
UPDATES.md and on the cards to exactly these; they must match the host
lines: 1.1 cinematic intro · 1.2 day-one patch · 1.3 story and voice ·
1.4 online only · 1.5 open world · 1.6 skill tree · 1.7 Season One ·
1.9 Remastered · 2.0 Game of the Year Edition. Then do the host voice.

Host voice for the shorts. The host is Justin, the CodeMask voice: use
the same ElevenLabs voice ID as episodes 1 to 3 (it is in the CodeMask
repo's episode config; tell me the ID you found before recording).
Same pipeline as Warden Snek: `npm run voice -- --record host`, key only
from ELEVENLABS_API_KEY, eleven_v3, the stability the earlier episodes
used, mp3_44100_64, one take per line, every request logged in
voice/RECORDING.json, disclosure line in README.

Lines: voice/HOST.md, pasted below. Four lines per short for v1.1 to
v2.0 and five for the trailer, verbatim, no edits of your own. Read
numbers as written in words.

Timing in a short: line 1 starts at 0 s over segment A; line 2 over the
patch card (the card stays until the line ends, then C starts); line 3
over C; nothing from the host during D (Snek's line plays alone);
line 4 starts right after D, over a freeze of the last frame, and the
short ends when line 4 ends. Host and Snek never overlap. The 25-30 s
target no longer applies: the short is as long as the lines need, but
tell me any short over 45 s. Do not cut lines or speed up audio.
Trailer: line 1 at 0 s, line 2 when v1.0 eats, line 3 over the
compressed middle, line 4 over the cabinet, line 5 over THE END with a
freeze until it ends. Mix: host at full level, Snek as recorded.

Re-record all shorts and the trailer with the host track and report per
file: total length, start and end second of each host line, Snek line
timing, C factor. STOP.

## HOST.md

### v1.1
1. I'm turning Snake into a AAA game. Patch 1.1.
2. A real game doesn't just start. It has a publisher, a studio and an engine, and you see all three first.
3. Four logos you can't skip. First apple moves from zero point three seconds to nineteen.
4. Next patch: a day-one patch. Subscribe so you don't miss it, like it if you've ever skipped a logo, and tell me in the comments what else a real launch needs.

### v1.2
1. I'm turning Snake into a AAA game. Patch 1.2.
2. Big games ship, then patch themselves on day one. So Snake now updates before it runs.
3. The patch is two thousand bytes. Downloading it costs four and a half thousand. The headers are bigger than the fix.
4. Next patch: a story. Subscribe for it, like it if you've waited for a patch on launch night, and comment what the snake's backstory should be.

### v1.3
1. I'm turning Snake into a AAA game. Patch 1.3.
2. Every AAA hero has a voice, a past and a wound. Meet Warden Snek. He had an orchard. They took it.
3. The opening is forty-four seconds. You control the snake eight percent of the time. The rest is cinema.
4. Next patch: online. Yes, for a single-player snake. Subscribe, like it if you skip cutscenes, and comment which feature is still missing.

### v1.4
1. I'm turning Snake into a AAA game. Patch 1.4.
2. Every big release is online now, even the single-player ones. So Snake has a login, a queue and terms of service.
3. There's no one else on the server. You still wait seven seconds. Industry standard.
4. Next patch: an open world. Subscribe for it, like it if you've been in a queue for a single-player game, and comment how big the world should be.

### v1.5
1. I'm turning Snake into a AAA game. Patch 1.5.
2. A twenty-by-twenty field is not content. So the field is now two hundred fifty-six by two hundred fifty-six, with six hundred map markers.
3. One hundred sixty chests. All empty. One apple. Fast travel is coming in a future update.
4. Next patch: a skill tree. Subscribe, like it if you've opened an empty chest, and comment which skill the snake should unlock first.

### v1.6
1. I'm turning Snake into a AAA game. Patch 1.6.
2. AAA games don't give you abilities. You unlock them. So turning is now a skill tree.
3. Left turn: level five. Before that, you earn it. That's called progression.
4. Next patch: a battle pass. You knew it was coming. Subscribe, like it if you've grinded for a basic move, and comment what goes in the loot boxes.

### v1.7
1. I'm turning Snake into a AAA game. Patch 1.7. Season One.
2. A game needs a season, a pass and loot boxes. Cosmetics only, of course. Twelve skins. The legendary one is the snake you started with.
3. The apple is now hidden. The top reward of the pass is the ability to see it. First apple: eighteen minutes.
4. Next patch: the remaster. The game is a week old. Subscribe, like it if you've bought a skin, and comment: one patch is yours, what should it add?

### v1.9
1. I'm turning Snake into a AAA game. Patch 1.9. Remastered.
2. Every classic gets a remaster. Bloom, grain, chromatic aberration, and hair physics on a twenty-by-twenty grid.
3. Four graphics presets. All of them are Ultra. The apple is in the same place.
4. Next patch: the Game of the Year Edition. We haven't won anything. Subscribe for the finale, like it if you've bought a remaster of a game you own, and comment your patch: it's still open.

### v2.0
1. I'm turning Snake into a AAA game. Patch 2.0. The final one.
2. Every big game ends with a nostalgia piece: a little arcade cabinet with the original inside. So I put Snake 1.0 in Snake.
3. Walk six steps, press Enter, and you're playing the real thing. First apple: one hundred and seven seconds. You control the snake for less than one of them.
4. That's the whole game. Play any version: the link is in the description. Subscribe for the full video, like it if you'd play the cabinet, and comment the one patch you want: I'll build it.

### trailer
1. This is Snake. This is Snake after I made it AAA.
2. Done.
3. Logos, a day-one patch, a story, a login, an open world, a skill tree, a season, a remaster.
4. The only way to eat the apple is the arcade cabinet with the old game inside.
5. Same code. Same seed. Same apple. Ten patches. Subscribe: one patch a day, and one of them is yours. Comment it.
````

The answer to the questions (the voice ID found, four timing conflicts, the numbers to check):

````text
Yes, go. Settings as you found them: voice uFIXVu9mmnDZ7dTKCBTX,
eleven_v3, stability 0, similarity 0.75, style 0.2, speed 1,
mp3_44100_64. Key from the MCP entry, environment only, as before.

Timing: do 1 to 4 as you proposed.

Numbers:
- "Ten patches" stays: v1.8 is the viewers' patch, the slot is in
  UPDATES.md, so the series is ten patches.
- "Four logos": count them in v1.1. If it is three logos and a warning,
  change line 3 of v1.1 to "Three logos and a warning you can't skip.
  First apple moves from zero point three seconds to nineteen." That
  is the only line you may change; everything else, report and leave.
- Send the list of other mismatches before recording, I'll answer in
  one message.

Order as you wrote it: names → number check → voice → re-record.
````

The answer to the number check:

````text
1. "Twelve skins" → "Ten skins." Line 2 of v1.7 becomes: "A game needs
   a season, a pass and loot boxes. Cosmetics only, of course. Ten
   skins. The legendary one is the snake you started with."
2. "The game is a week old" → "The game is two days old." (v1.7 line 4).
3. Keep as written: "grid" means the screen.
4. Keep: it is the publishing schedule, not a game fact.
Record the host voice and re-record the shorts and the trailer.
````

## 18. One retake, a pause before line 4, a backup of the voice files

````text
Accepted: C as long as line 3 needs (keep the rule), v2.0 at 46.9 s
(it is the finale), the trailer as it is.

Three things:
1. v1.3 line 2: record up to two more takes, run whisper on each, keep
   the first one that transcribes "Warden Snek" and "He had an orchard"
   correctly; if none does, keep the current take and tell me. Log the
   takes in RECORDING.json. This is the only re-record.
2. Line 4 starts 300 ms after D ends, in every short (v1.6 has 0.4 ms
   now). Re-render the shorts; no new voice requests.
3. Back up voice/host/ and src/voice/ together with RECORDING.json to a
   folder outside the repository (for example ~/codemask-voice-backup/
   aaa-snake/) and tell me the path. They are not in git by design and
   cost money to redo.
Then STOP.
````

## 19. v1.3's host line 2: take 3

````text
Use take 3 for v1.3 line 2 (whisper doesn't know the word "Snek"; the
takes are fine). Re-render v1.3, update RECORDING.json and the backup,
no new voice requests. STOP.
````

## 20. The trailer stacked, and no dead air after "Done."

````text
Trailer, two changes; shorts are not touched.

1. Layout: stacked, not side by side. v1.0 on top, v2.0 below, each
   using the full 1080 width (square game area, so each panel is about
   1080x1080 with a thin divider; the premise line sits in the divider
   or over the top edge, the two counters under their own panels). The
   text-not-box checks apply to both panels.
2. No dead air after "Done.": the first real-time part ends 1 s after
   line 2 ("Done.") ends, not at 15 s. The compressed middle starts
   there and runs as long as line 3 needs (same rule as segment C);
   the last part is unchanged: real time from the approach to the
   cabinet through THE END, line 4 before Snek, line 5 over the freeze.

Re-render the trailer, no new voice requests, and report: length, the
second each part starts, the middle's factor, and the first still of
the stacked layout. STOP.
````

## 21. The trailer, design "A": one full-width panel

````text
Trailer, new design "A": one full-width panel, no split screen.
Layout: premise line in a 90 px band at the top; the game at 1080x1152
(480x512 scaled 2.25x, full width); the "time to first apple" counter
in a band under it; nothing below y=1440. Text-not-box checks apply.

Voice: re-record trailer line 1 as two separate lines, same settings,
one take each, logged in RECORDING.json and the backup:
  1a. This is Snake.
  1b. This is Snake after I made it AAA.
Lines 2 to 5 are reused as recorded. Two requests, no more.

Sequence:
1. v1.0 full screen from its first drawn frame; line 1a at 0 s. The
   apple is eaten at 0.32 s; freeze the frame with the counter stopped
   at 0.320 s and hold it until line 2 ("Done.") ends, plus 400 ms.
2. Hard cut to black, a 500 ms sting of our own, then the card
   "Patch 2.0" with line 1b over it; the card stays until 1b ends.
3. v2.0 from its first drawn frame, time-compressed for exactly the
   length of line 3 (factor in 0.05 steps, shown in the corner, about
   12x); the counter runs the whole time.
4. Real time from 4 s before the cabinet is reached: line 4, Enter,
   the inner apple, Snek's line, THE END. Line 4 ends before Snek.
5. Freeze on THE END with line 5; the file ends when line 5 ends.
The first frame of the file is never black. Report length, the start
second of each part, the factor, and the first still. STOP.
````

## 22. The trailer's line 5, new words

````text
Trailer accepted except line 5. Replace it with:
  5. Same snake. Same apple. Ten patches of progress. Subscribe.
One new voice request, same settings, logged in RECORDING.json and the
backup; the old line stays in the log as trailer-5-old. Update
voice/HOST.md. Re-render the trailer: the freeze on THE END lasts
exactly as long as the new line 5 plus 300 ms, then the file ends.
Report length and the line's start and end. STOP.
````
