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
