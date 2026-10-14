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
