# AAA Snake: DEVLOG

What was done, what broke, the real numbers, and what actually happened in each session. Numbers come from
`npm run measure` (measurements/) and are never rounded here.

## 2026-10-14 — Prompt 1: setup, Snake v1.0, the measuring rig, the short recorder, the update plan

Commits: bf750bb (rules and logs), b107036 (Snake v1.0, tag v1.0), b685f9e (rig, chart, v1.0 measured),
a919bfc (UPDATES.md proposal), 30d0713 (chart labels), 321cb33 (short recorder), aea276d (replay fix).
No update was built; UPDATES.md waits for approval.

### What was built
- **Snake v1.0**: src/rules.js (96 lines: grid, seeded generator, moves, apples; no screen, keys or clock) and
  src/game.js (144 lines: keys, fixed 100 ms tick, drawing, and a read-only probe for the bot), plus index.html
  (20 lines). Built to dist/v1.0/ and tagged v1.0.
- **The rig** (`npm run measure`): a bot plays seed 1 five times in Chromium's new headless mode, then five times in a
  visible window for frame rate. Raw runs, medians and the command output are in measurements/.
- **`npm run fps-check`**, **`npm run chart`** (out/bloat.png), **`npm run short`** (out/shorts/<version>/).
- 47 tests (`npm test`), including the rig against a fixture page with known timings (tests/fixture).

### Dependencies
- playwright 1.63.0 (dev), exact pin. Reason: the headless browser for the rig, the chart and the short recorder.
  1.64.0 was out, but it was one week old; 1.63.0 was the newest release more than two weeks old. It brings
  Chromium 153.0.8010.12.
- ffmpeg 8.1.1 (system tool, not pinned by npm) encodes the shorts; each clip.json records its version.

### v1.0, measured (`npm run measure v1.0`, medians of 5 runs, measurements/v1.0.json)
- Time to first apple: 320.6000000089407 ms (run 1). Screens on the way: (page load) 16.400000005960464 ms, ready
  15.299999997019768 ms, play 288.90000000596046 ms.
- Load time (first frame that accepts input): 26 ms.
- Control share: 0.9998805555555556 of 180000 ms.
- JS heap (CDP Runtime.getHeapUsage usedSize, after a forced GC, at 60 s of control): 929680 bytes.
- Download: 9423 bytes in 3 requests. JS: 240 lines, 8130 bytes. Code (JS + HTML): 260 lines. Assets: 0 bytes.
- Frame rate in a visible window: median 60 fps, 5th percentile 56.81818181818064 fps. Budget: pass.
- Checks: first apple on tick 3 in all 5 runs; 1125 of 1125 turns accepted; 0 external requests; 0 page errors.

### What broke
- **The bot pressed before anything was on screen.** In the first trial run the bot saw the `ready` screen in the
  game's state and pressed a key before the first frame had been drawn, and the first frame then came late. A player
  can't react to a screen they haven't seen, so the probe got a `shown` flag and the bot now acts only on drawn
  screens. (Trial runs before the rig was finished are not saved, so their numbers are not quoted here.)
- **Headless WebGL ran in software.** Playwright's default headless shell draws WebGL with SwiftShader, not the M1's
  GPU. In `npm run fps-check` (measurements/fps-check-output.txt), the light WebGL load ran at a median of 6 fps in the
  headless shell and 60 fps in a visible window. The rig now uses Chromium's new headless mode (Playwright channel
  "chromium"), which draws with ANGLE Metal on the M1.
- **Even on the GPU, headless frame rate is not the visible window's.** Same check: medians agree on CPU work (40 and
  40 fps) and light WebGL (60 and 60), but not on heavy WebGL (18 headless, 20.5 visible), and the 5th percentile is
  higher headless (59.88023952095548 vs 56.49717514124642 fps with no load). So frame rate is measured in a visible
  window, and the headless figure is kept next to it in every measurement file.
- **The frame-rate median jumped.** rAF timestamps snap to the 60 Hz display, so a frame that takes 25 ms shows up as
  16.7 ms and 33.3 ms intervals in turn. A per-frame median then lands on 60, 30, or the mean of the two. A test run
  failed with: `fps 44.77691977691978 with 25 ms of work per frame`. The median is now taken over per-second frame
  counts (an FPS counter), which reads 40 on that load in every mode; the 5th percentile stays per frame to catch
  stutter.
- **The short's first frame was a title card.** It was captured right after the bot's first key, before the game had
  redrawn, so it still said "Press an arrow key or WASD". Clips now start on the first frame drawn after the key.
- **The replay lost a key.** The recorder replayed the bot's keys at their recorded times. On the fixture, the logo's
  timer starts on the first frame, which comes a few ms later in the replay than in the run, so the bot's Escape landed
  while the logo was still up and was ignored: `Error: the replayed first apple (null ms) is more than 50 ms from the
  median (1846.8999999910593 ms)`. Each key now also waits for the screen and tick it was pressed on. v1.0's short was
  re-recorded after the fix: same 8 apples as the recorded run, first apple 3.933333342274011 ms before the median.
- **The chart said "100.0 %".** Control share 0.9998805555555556 rounded to one decimal looked like a perfect score.
  It now shows two decimals, and labels near the top of a panel drop below the point instead of hitting the title.
- **My own tests, four times:** vm-sandbox arrays failed `deepEqual` against arrays from the test's realm; a counter
  test expected `61.2345` to round up and floating point disagreed; a test expected 2 runs after I changed the run to 3;
  and the determinism test failed on the game's own comment, which says it never uses Math.random:
  `AssertionError [ERR_ASSERTION]: src/rules.js uses Math.random`. Comments are now stripped before that check.
- **favicon.ico.** The visible window asked for /favicon.ico and logged a 404 as a page error; index.html now declares
  an empty icon.

### Surprising, as it happened
- All 5 headless runs of v1.0 played the same game: first apple on tick 3, 225 turns sent and 225 accepted, exactly
  1 death in 3 minutes, in every run.
- With seed 1 the first apple is 3 cells straight ahead of the snake, so the bot's fastest path is to press Right, the
  way the snake is already heading, and wait.
- Before garbage collection the heap read 7387072, 6553656, 6607940, 6459580 and 6302320 bytes; after it, 929660 to
  930284.

### Not tested
- How v1.0 feels in human hands: all play so far was the bot and one scripted test.
- Frame rate in the visible window assumes the window stays on screen (the rig disables Chromium's background
  throttling, but a minimized window was not tried).

🎬 Maybe: "Time to first apple: 0.321 s." The number every later short is measured against.

## 2026-10-14 — Prompt 2: UPDATES.md frozen, v1.1 Launch experience built and measured

Commits: b1d6864 (UPDATES.md approved and frozen), be976f4 (rig: own origin only, `accepts` load time), 2ff5609 (v1.0
short 24 s), 6a96093 (v1.1, tag v1.1), db0b90d (v1.1 measured), 219a23f (v1.1 short plan), 0453a06 (chart labels),
fe9ca9d (test fix). From this prompt on, commits use codemask@codemask.invalid; earlier ones keep the old address.

### Decisions recorded
- The hero is Warden Snek, a retired orchard warden; every guardrail stays. v1.2's patch may come only from the game's
  own origin. v1.5 keeps its note that control share may go up. No "cinematic 30 fps" mode. UPDATES.md is frozen.
- Load time stays "first frame of a screen that accepts any key". The replay recorder is accepted. v1.0 stays at 240
  lines of JS.
- The rig's request check is now a named rule (tools/rig/stats.mjs `offOrigin`): any request whose origin (scheme,
  host, port) differs from the game's fails the version. Inline data: URLs pass; a blob: URL is judged by the origin
  inside it.

### v1.1, what was built
Exactly the UPDATES.md entry: three unskippable studio logos of 3000 ms each (publisher, studio, engine), a
photosensitivity warning that listens for a key only after 4000 ms, a title screen that listens only after its
2500 ms title animation, and a 3000 ms autosave notice before every game, including after a game over. The snake now
glides between cells (rules unchanged: one cell per 100 ms tick) and its eyes look the way it is about to go.
New file src/launch.js (159 lines); game.js grew from 144 to 233 lines.

Studio names were searched on the web before use. "Very Large Publisher", "Overbudget Interactive" and "Grid & Bones
Interactive" returned nothing. "Squarescale Studios" was dropped: the search found an indie jam game called
"Mr SquareScale". The engine logo says "GRID & BONES".

### v1.1, measured (`npm run measure v1.1`, medians of 5 runs, measurements/v1.1.json)
- Time to first apple: 18908.79999999702 ms (run 4), up from 320.6000000089407 ms. On the way: (page load)
  13.400000005960464 ms, publisher-logo 3029.199999988079 ms, studio-logo 3000.2000000029802 ms, engine-logo
  3016.7000000029802 ms, warning 4021.2999999970198 ms, title 2514.2999999970198 ms, autosave 3013.4000000059605 ms,
  ready 7.4000000059604645 ms, play 292.8999999910593 ms.
- Load time: 13089.39999999106 ms, up from 26 ms (the first frame where the warning listens).
- Control share: 0.8798588888888558, down from 0.9998805555555556.
- JS heap after GC: 1048108 bytes, up from 929680. Download: 19454 bytes, up from 9423.
- JS: 488 lines, 17929 bytes (v1.0: 240 lines, 8130 bytes). Assets: 0 bytes.
- Frame rate in a visible window: median 60 fps, 5th percentile 57.142857142857146 fps. Budget: pass.
- Checks: first apple on tick 3 in all 5 runs; 1005 of 1005 turns accepted; 0 external requests; 0 page errors.

### Shorts
- v1.0 re-recorded at 24 s: 19 apples, all the same as the recorded run; counter frozen at 0.321 s.
- v1.1, 25 s from the publisher logo: 5 apples, the same as the recorded run; the replay's first apple came at
  18900 ms against 18908.79999999702 ms recorded; the counter froze on the median.

### What broke
- **The load-time rule would have been wrong for v1.1.** The old rule took the first frame of any screen that ever
  offered a key, which would have counted the warning from its first frame, 4 s before it listens. Found while
  designing v1.1, before any measurement: the game now logs an `accepts` entry on the frame a screen starts listening,
  and load time uses that. v1.0's value does not change (its first listening frame is its first `ready` frame).
- **My screenshot script got skipped by the warning.** While checking the new screens I timed key presses by the
  clock; the script pressed Enter while the warning was still not listening, the game ignored it, and three of my
  screenshots in a row came out as the same warning. Working as designed.
- **The v1.1 short opened on a black frame.** It started on the publisher logo's first frame, which is at the start
  of its fade-in. Clip plans now take `afterMs`; v1.1 starts 500 ms in, when the logo is fully visible.
- **Chart labels under the line.** The rising lines ran through the value labels "18.91 s" and "19.5 KB". Each panel
  now shows its latest value under its title.
- **A test assumed v1.0's file list:** `✖ sizes: js, code and assets are split by file type` once launch.js existed.
- **I committed with a failing test.** Commit 219a23f went in while `✖ clip start: the first frame after the first
  key, or after a screen first appears` was failing: my command chain checked grep's exit code instead of npm test's.
  The test compared 31 × (1000 / 60) with 31000 / 60 bit for bit. Fixed in fe9ca9d; history not rewritten.
- **Email note:** the ping-vtuber repo's local git config still says codemask@users.noreply.github.com, but its
  commits are made as codemask@codemask.invalid. This repo now uses the address its commits show, as asked.

### Surprising, as it happened
- Every "3000 ms" logo lasted between 3000.2000000029802 and 3029.199999988079 ms in the median run: a screen ends on
  the first animation frame after its time is up.
- v1.1 doubled the JavaScript (240 to 488 lines) to add 18588.19999998808 ms (median minus median) of waiting before the same 3-cell walk to
  the same apple on tick 3.

🎬 Maybe: the counter climbing through three logos, a warning and an autosave notice, then the apple at 18.909 s.

## 2026-10-14 — Prompt 3: expectations for v1.2, written before measuring

v1.2 is built and tagged (998f1f7). Nothing has been measured yet. What each metric should do, and why
(direction only):
- **Time to first apple: up.** Four new screens come before the logos (the update notice, a download throttled to one
  piece per second, the install, "preparing"), and a loading screen comes after the title. The walk to the apple
  itself should not change: same seed, and the grass has its own generator, so the apple lands where it did.
- **Load time: up.** The first screen that accepts a key is still the warning, and it now comes after the update
  screens.
- **Control share: down.** More of the fixed 3-minute session passes before play. After a game over the way back is
  the same as in v1.1 (autosave only), so the extra loss is all at the start.
- **Download bytes: up.** The patch body, plus the headers of every one of its small range requests, plus the new
  script file.
- **JS bytes and lines: up.** update.js, the loading screen, and the patch file itself (it is a .js file in the build).
- **Asset bytes: unchanged (zero).** The grass is drawn in code, not loaded as an image.
- **JS heap: up a little.** The patch pieces stay in memory and there is more code; the grass canvas's pixels are not
  JS heap.
- **Frame rate: unchanged or slightly down, within the budget.** The field is drawn once and copied each frame; the
  shadows add blur work on a 480 × 512 canvas.

## 2026-10-14 — Prompt 3: one fixed plan for every short; v1.2 Day-one patch measured

Commits: 43d0cd3 (fixed short plan, v1.1 re-rendered), 998f1f7 (v1.2, tag v1.2), dc0a05f (expectations, before
measuring), 01230fb (v1.2 measured), 0fda333 (v1.2 short plan).

### The fixed short plan
Every short after v1.0 now opens on the result: 3 s of the previous version reaching its first apple (its counter
freezes on its median, then the new median appears next to it, labelled "v<prev> -> v<new>"), 3 s of the patch note,
the new version's launch sped up to fill 16 s of clip, then its first apple at real speed. The speed-up is the largest
multiple of 0.05 that keeps that part at 16 s or more (tools/short.mjs `compressSpeed`), shown in small type.
- v1.1 re-rendered: its launch (516.6666666666667 to 16908.79999999702 ms of the run) is shorter than 16 s at any
  speed above 1x, so it plays at 1x and the short is 25400 ms. It is not sped up 3x to 4x: at 3x the short would
  have been far below 25 s.
- v1.2: 2.4x; the short is 25233.333333333332 ms. Also below 3x, for the same reason: its launch is shorter than
  48 s.

### v1.2, what was built
As UPDATES.md says. On start, "A required update is available" (2000 ms). The game then downloads patch/day-one.js
from its own server in 256-byte range requests, one per 1000 ms (the throttle), showing the real bytes received, with
this file's patch notes scrolling in a box. "Installing" runs the downloaded bytes as a script from a blob: URL;
"Preparing your experience" draws the grass the patch adds (offscreen, once, from the seed, with its own generator)
and fades it in. After the title, a loading screen with tips listens for a key after 5000 ms. The patch also adds soft
shadows under the snake and the apple. tools/serve.mjs now answers byte ranges; its plain 200 responses keep exactly
the headers they had, so download bytes stay comparable.

### v1.2, measured (`npm run measure v1.2`, medians of 5 runs) against the expectations written before measuring
| Metric | Expected | v1.1 | v1.2 | Direction |
|---|---|---|---|---|
| Time to first apple | up | 18908.79999999702 ms | 40996.10000000894 ms | up, as expected |
| Load time | up | 13089.39999999106 ms | 30147.30000001192 ms | up, as expected |
| Control share | down | 0.8798588888888558 | 0.7572477777778275 | down, as expected |
| Download | up | 19454 bytes | 34115 bytes | up, as expected |
| JS lines / bytes | up | 488 / 17929 | 793 / 29965 | up, as expected |
| Assets | unchanged | 0 bytes | 0 bytes | unchanged, as expected |
| JS heap after GC | up a little | 1048108 bytes | 1282896 bytes | up, as expected |
| Frame rate median | unchanged or slightly down | 60 fps | 60 fps | unchanged |
| Frame rate 5th percentile | unchanged or slightly down | 57.142857142857146 fps | 56.49717514125223 fps | slightly down |

Checks: first apple on tick 3 in all 5 runs; 885 of 885 turns accepted; 0 requests outside the game's origin; 0 page
errors. Budget: pass. The patch is 2126 bytes; in the median run (run 5) its 9 range requests came to 4519 bytes on the
wire: the headers weigh more than the patch.

### What broke
- **The patch killed the game loop.** On the first frame of "Preparing your experience" the grass was not drawn yet
  (the work happens on the screen's frames, and the screen changes after the work of that frame). Drawing it threw
  `Failed to execute 'drawImage' on 'CanvasRenderingContext2D': The provided value is not of type '(CSSImageValue or
  HTMLCanvasElement or HTMLImageElement or HTMLVideoElement or ImageBitmap or OffscreenCanvas or SVGImageElement or
  VideoFrame)'.`, the exception stopped requestAnimationFrame, and the game froze on that screen. My first trial run of
  the bot never reached an apple and I stopped it after its 200-second command timeout. The screen now draws the
  field only once it exists.
- **One unexplained slow trial.** In the trial run right after that fix, the bot spent much longer in play than the
  usual three moves before its first apple. Three more trials and all 5 measured runs ate it on tick 3. The trial was
  not saved, and I could not find a cause (no Playwright processes were left over afterwards).
- **The comparison counter spilled out of its box**, past the right edge and into the safe margin, in the first
  render of the v1.1 short. The safe-area check passed, because it measured boxes, not the text inside them. The
  counter now has two rows in comparison mode, and every frame is checked for text spilling out of any box.
- **My own tests, again:** the size tests assumed src/ had no folders (it now has patch/); a plan test expected 3.75x
  where the rule gives 3.6x (3.625 rounded down to a multiple of 0.05); the recorder compared the fixture's apples up
  to the end of the plan instead of the last frame drawn.

### Found, not fixed (a question for the next prompt)
- The frame-rate runs in a visible window last 60 s from navigation start. In v1.2 the first apple comes at
  40996.10000000894 ms, so only the rest of those 60 s is play (1162 to 1167 frames per run). From the first version
  whose launch passes 60 s, they would measure no play at all.

🎬 Maybe: "1,280 of 2,126 bytes", one piece per second, while the headers of those pieces outweigh the patch.

## Prompt 4, part 1: frame rate over 60 s of play (method 2)

### Why the method changed
Method 1 took frame rate from the control screens inside the first 60 s after navigation start. The longer the
launch, the less play was left in that window: v1.0 had almost the whole 60 s, v1.2 only the part after its first
apple at about 41 s (1162 to 1167 frames per run), and any version whose launch passes 60 s would have had no play in
it at all. So the number measured a shrinking and different slice in every version. Method 2 takes the first 60 s of
play (control screens only, the same window the JS heap is read at), however long the launch is: every version gets
the same 60 s. The visible runs now go on until 61 s of control, not for a fixed time.

The headless runs were not changed, but all of v1.0, v1.1 and v1.2 were measured again (`npm run measure v1.0`,
`v1.1`, `v1.2`), so every number in the new files comes from the new runs, not only frame rate.

### The old numbers (method 1, measurements/old-method/, medians of 5 runs)
| Version | Time to first apple | Load time | Control share | JS heap after GC | Download | Frame rate median | Frame rate p5 |
|---|---|---|---|---|---|---|---|
| v1.0 | 320.6000000089407 ms | 26 ms | 0.9998805555555556 | 929680 bytes | 9423 bytes | 60 fps | 56.81818181818064 fps |
| v1.1 | 18908.79999999702 ms | 13089.39999999106 ms | 0.8798588888888558 | 1048108 bytes | 19454 bytes | 60 fps | 57.142857142857146 fps |
| v1.2 | 40996.10000000894 ms | 30147.30000001192 ms | 0.7572477777778275 | 1282896 bytes | 34115 bytes | 60 fps | 56.49717514125223 fps |

### The new numbers (method 2, measurements/, medians of 5 runs)
| Version | Time to first apple | Load time | Control share | JS heap after GC | Download | Frame rate median | Frame rate p5 |
|---|---|---|---|---|---|---|---|
| v1.0 | 320.09999999403954 ms | 28 ms | 0.9998761111111276 | 929680 bytes | 9423 bytes | 60 fps | 57.47126436781129 fps |
| v1.1 | 18928.20000000298 ms | 13089 ms | 0.879796666666617 | 1048112 bytes | 19454 bytes | 60 fps | 56.818181818163026 fps |
| v1.2 | 40993.90000000596 ms | 30135.90000000596 ms | 0.7572433333333995 | 1283040 bytes | 34115 bytes | 60 fps | 54.64480874316071 fps |

Every visible run now has 3594 to 3599 frames of play. The median stays 60 fps for all three. The 5th percentile now
falls a little from version to version (57.47126436781129, 56.818181818163026, 54.64480874316071 fps); with method 1
v1.1 was above v1.0, and v1.2's number came from about a third of the frames. Checks and budget pass for all three.
summary.csv and out/bloat.png are redrawn from the new files.

## Prompt 4, part 2: v1.3 Story mode, Warden Snek

### v1.3, what was built
As UPDATES.md says. Warden Snek is a retired orchard warden; src/story.js holds his 17 lines (9 in the opening, 8
reflections, one after each apple, in turn) and voice/LINES.md lists them with their scene and emotion
(`npm run voice` writes it from the game). No audio was generated: every line is a silent MP3 placeholder, no longer
than the line's slot (its words at 2.5 per second, rounded to 0.1 s, plus 0.8 s). The game holds each line for its
slot whether the sound plays or not, so recordings that fit their slots will not change any timing. The placeholders
are committed (src/voice/, dist/v1.3/voice/): the build and the rig need them, and they weigh about what the
recordings will, since they use the same format.
- The loading screen after the title now also downloads the 17 voice files and waits for all of them ("Voice lines:
  X of 17") as well as its 5000 ms.
- The opening cutscene: letterbox, close-up on the head, subtitles under "WARDEN SNEK", 9 lines. It cannot be
  skipped ("Skip available after your first playthrough"; there is no second playthrough).
- The finishing move: when the next move would reach the apple, the game stops, the camera pushes in for 800 ms,
  then "Press E to eat"; only E works. The bite lasts 1500 ms; the apple counts (and the rig logs it) when it ends.
- After every apple, a reflection cutscene with one line, then play goes on.
- Graphics: the field is dark, a soft light follows the head, the apple glows, the bars come in for every cutscene.
- The guardrails hold: no bandana, eyepatch, box, radio calls, stealth or code name; tests/v1.3.test.mjs checks the
  lines for a list of banned words and digits. The recording settings in voice/LINES.md ask for a voice designed from
  a description that names no actor or character.

### v1.3, expected direction of every metric (written before `npm run measure v1.3`)
| Metric | Expected | Why |
|---|---|---|
| Time to first apple | up, by much | the unskippable opening (9 lines) before play, then 800 ms of push-in, the E, and 1500 ms of bite before the apple counts |
| Load time | unchanged | the first screen that accepts a key is still the warning, and nothing before it changed |
| Control share | down, by much | the opening, and every apple now costs a finishing move and a reflection, none of which is control |
| Download | up, by much | 17 voice files and story.js |
| JS lines / bytes | up | story.js and the cutscene and finisher code in game.js |
| Assets | up, from 0 | the voice placeholders are the first asset files |
| JS heap after GC | up a little | the story's lines and state; the audio is in blobs, which are not on the JS heap |
| Frame rate median | unchanged | 60 fps; one more full-board draw per frame should still fit |
| Frame rate 5th percentile | slightly down | the darkness is a full-board offscreen canvas redrawn every frame with a gradient, and the apple's glow is a blur |

### v1.3, measured (`npm run measure v1.3`, medians of 5 runs) against the expectations written before measuring
| Metric | Expected | v1.2 | v1.3 | Direction |
|---|---|---|---|---|
| Time to first apple | up, by much | 40993.90000000596 ms | 87317.09999999404 ms | up, as expected |
| Load time | unchanged | 30135.90000000596 ms | 30136 ms | unchanged, as expected |
| Control share | down, by much | 0.7572433333333995 | 0.07952611111121045 | down, as expected |
| Download | up, by much | 34115 bytes | 676755 bytes | up, as expected |
| JS lines / bytes | up | 793 / 29965 | 999 / 39996 | up, as expected |
| Assets | up, from 0 | 0 bytes | 629368 bytes | up, as expected |
| JS heap after GC | up a little | 1283040 bytes | 1639292 bytes | up, by more than I expected (356252 bytes); I have not looked for the cause |
| Frame rate median | unchanged | 60 fps | 60 fps | unchanged, as expected |
| Frame rate 5th percentile | slightly down | 54.64480874316071 fps | 54.34782608688775 fps | slightly down, as expected |

Checks: first apple on tick 3 in all 5 runs; 425 of 425 turns accepted; 0 requests outside the game's origin; 0 failed
requests; 0 page errors. Budget: pass. In the median run the opening lasted 44012 ms against 44000 ms planned
(`cutsceneMs(OPENING)`), and the bot spent 806.5 ms on the push-in and 1510.4000000059605 ms on the bite.
- **87 requests per run, not 32.** 32 go to the server (the page, 6 scripts, 9 pieces of the patch, 17 voice files);
  the other 55 are the browser reading `blob:` URLs (the installed patch and the voice lines as they play), 0 bytes
  each. They count in the request total but add nothing to the download.
- **3552 to 3555 frames per 60 s of play, not 3594 to 3599.** Every apple now stops play for the finishing move and
  the reflection, so the 60 s of play is made of 48 pieces in v1.3 (2 in v1.2), and each extra piece loses the one
  frame that straddles the screen change: 3598 - 3552 = 46 = 48 - 2 in run 1.
- The short (`npm run short v1.3`): the launch at 4.1x, 29800 ms in all. The v1.0, v1.1 and v1.2 shorts were rendered
  again from the new measurement files, so their counters freeze on the new medians.

### What broke
- **A ghost apple.** In the screenshots of play after the first apple, a dark red dot stayed where the apple had
  been eaten. v1.2 drew the eaten apple in the snake's mouth until its next step and cleared it on the next move;
  v1.3 eats in the finishing move instead, never cleared it, and drew it on every move after. The bite animation
  already shows the apple going, so that code is gone.
- **The opening was not dark.** The light around the head is drawn under the close-up camera, so at 2.5x it grew to
  2.5 times its size and lit the whole frame. It is now divided by the zoom.
- **"Press E to eat" covered the head**: the message sits in the middle of the board, which in the close-up is where
  the head is. It is now at the bottom.
- **The placeholders were too long.** MP3 rounds up to whole frames, so silence of exactly a slot came out 26 to 49 ms
  longer than the slot and failed `npm run voice -- --check`. The tool now asks for 10 ms less until the file fits.
- **My own tests, again:** the v1.3 test pressed one arrow and waited for the apple "3 cells ahead", but with seed 1
  the apple is at (11,12), two rows down; it timed out after 90 s. It now checks the start and steers there. The
  size test assumed src/ had no assets; it now has the voice files.

## Prompt 5: v1.4 Always online

### v1.4, what was built
As UPDATES.md says, with SnakeNet as a stub in src/online.js that makes no request (tests/v1.4.test.mjs checks that no
request is made from "Connecting to SnakeNet..." to the end of the terms; the rig's own-origin check still runs on
every request).
- **Where it goes:** after the title, as in most online games: title -> "Connecting to SnakeNet..." (3000 ms) ->
  sign-in with a pre-filled guest account (seed 1: guest-23361; Enter only, after 1500 ms) -> "Signing in..." (2000 ms)
  -> the server queue -> the terms of service -> the loading screen of v1.2 -> the opening of v1.3.
- **The queue** starts at a position from the seed (seed 1: 42) and goes down by 1 to 3 every 200 to 800 ms (also from
  the seed) to 0; with seed 1 it lasts 7300 ms.
- **The terms of service:** 22 sections in a box; "Accept" stays dark until the box is scrolled to the bottom (Page
  Down, Space, the arrow keys or the mouse wheel; the box scrolls at 2000 px a second). Enter accepts.
- **Reconnects:** after 150 to 300 moves of play (from the seed), "Connection interrupted. Reconnecting..." pauses the
  game for 3000 to 6000 ms, then "Connection restored". Keys do nothing meanwhile. The screen is called `reconnecting`,
  so it is not control. With seed 1 the drops come at moves 194 (4300 ms), 375 (4200 ms) and 592 (5500 ms), then on.
- **UI chrome:** a top bar with the score, an online indicator (Online / Reconnecting), a currency counter (Scales:
  100 from a daily login bonus; nothing can be bought, and nothing buys them), and the version; toasts for connecting,
  signing in, the bonus, the terms and every reconnect; three-dot spinners. Canvas 2D only.
- SnakeNet has its own generator from the seed, so the apples are the same as in v1.3.
- **The voice lines** still come from src/voice/: v1.4's build copies them like v1.3's did, and `npm run voice` now
  copies src/voice/ into every build that has a voice/ folder, so a recording saved over a placeholder reaches v1.3 and
  v1.4 with no other change. tests/v1.4.test.mjs fails if any build's voice files differ from src/voice/, and
  tests/build.test.mjs no longer asks a build's voice/ folder to match its tag (CLAUDE.md, Voice).
- **A miss from v1.3, fixed in v1.4:** the patch notes that scroll by during the day-one patch are meant to be "every
  patch note so far", but v1.3 never added its own. v1.4's list has v1.0 to v1.4 (checked against UPDATES.md).

### Changes to the rig and the plan, before measuring
- **A logged change to UPDATES.md:** the bot needs a rule for terms that must be scrolled. The screen offers Page Down
  (probe `next`) until the bottom, then Enter, and the bot presses what is offered, as on every screen, at most every
  250 ms. The rule is written in UPDATES.md's v1.4 section.
- **Control share in play (new):** from the first control frame until 60 s of control, control time divided by the
  time that passed (tools/rig/stats.mjs playShare). The launch screens are not in it; everything that stops play once
  it has started is. `npm run measure` reports it from now on, and `npm run play-share` computes it for v1.0 to v1.3
  from their saved runs (measurements/play-share-output.txt): v1.0 1, v1.1 1, v1.2 1, v1.3 0.14181426803644825.
  In v1.3, run 1 has no value: its log ends with 59962.09999996424 ms of control, because a headless run stopped right
  after the heap read, which goes by the bot's own count of control, a few ms ahead of the game's log. v1.3's value is
  the median of runs 2 to 5.
- **So headless runs now go on until 61 s of control**, as the visible runs already did, so the game's log always has
  the whole window. Nothing that is measured changes with it: the heap is read at the same point, control share is over
  the first 180 s, and the run lasts longer than 180 s anyway.

### v1.4, expected direction of every metric (written before `npm run measure v1.4`)
| Metric | Expected | Why |
|---|---|---|
| Time to first apple | up | connecting, sign-in, signing in, the queue and the terms come before the loading screen |
| Load time | unchanged | the online screens come after the title, so the warning is still the first screen that accepts a key. UPDATES.md guessed "up"; that would need a screen before the warning, and the frozen plan does not place them |
| Control share (first 180 s) | down | play starts later, so less of the first 180 s is play |
| Control share in play | down, a little | with seed 1, two or three drops (8500 to 14000 ms) fall in the moves of the first 60 s of control; v1.3's finishing moves and reflections already take most of that time, so the drops add only a little to it |
| Download | up, a little | online.js and the longer game.js, launch.js and update.js |
| JS lines / bytes | up | online.js |
| Assets | unchanged | the same voice placeholders |
| JS heap after GC | up, a little | the terms text and SnakeNet's state |
| Frame rate median | unchanged | the top bar and toasts are a few rectangles and text |
| Frame rate 5th percentile | unchanged or slightly down | the same |
| Requests to another origin | zero | SnakeNet is a stub; the rig checks every request |

### v1.4, measured (`npm run measure v1.4`, medians of 5 runs) against the expectations written before measuring
| Metric | Expected | v1.3 | v1.4 | Direction |
|---|---|---|---|---|
| Time to first apple | up | 87317.09999999404 ms | 102958.79999999702 ms | up, as expected (15641.70000000298 ms; the five online screens took 15628.09999999404 ms in the median run) |
| Load time | unchanged | 30136 ms | 30145.70000000298 ms | unchanged, as expected (UPDATES.md had guessed up) |
| Control share (first 180 s) | down | 0.07952611111121045 | 0.06027444444456034 | down, as expected |
| Control share in play | down, a little | 0.14181426803644825 | 0.1390078500049561 | down a little, as expected |
| Download | up, a little | 676755 bytes | 695136 bytes | up a little, as expected (18381 bytes) |
| JS lines / bytes | up | 999 / 39996 | 1407 / 58144 | up, as expected |
| Assets | unchanged | 629368 bytes | 629368 bytes | unchanged, as expected |
| JS heap after GC | up, a little | 1639292 bytes | 1705008 bytes | up a little, as expected (65716 bytes) |
| Frame rate median | unchanged | 60 fps | 60 fps | unchanged, as expected |
| Frame rate 5th percentile | unchanged or slightly down | 54.34782608688775 fps | 54.64480874311725 fps | slightly up (0.2969826562295026 fps), which I did not expect; the five visible v1.4 runs alone range from 54.34782608688775 to 55.55555555555556 fps |
| Requests to another origin | zero | 0 | 0 | zero, as expected |

Checks: first apple on tick 3 in all 5 runs; 445 of 445 turns accepted; 0 requests outside the game's origin; 0 failed
requests; 0 page errors. Budget: pass.
- **Control share in play, measured apart from the launch:** in every run two drops fell in the first 60 s of control,
  at moves 194 (4300 ms) and 375 (4200 ms); the third, at move 592, comes after the window. My guess of "two or three
  (8500 to 14000 ms)" holds at its low end. In run 2 the window took 431630.3000000417 ms against 423217.90000005066 ms
  in v1.3's run 2, 8412.39999999106 ms longer for 8500 ms of drops; I have not split the other 87.6000000089407 ms. The
  launch screens are not in this number: before the first control frame the run had already lost 100325.79999999702 ms.
- **Run 3 was slower to load:** 31194.79999999702 ms, because its patch download took 10049.79999999702 ms instead of
  about 9016 ms. One run of five; I have not looked into it. The median is not from it.
- **90 requests per run, not 87:** one more script (online.js), and two more `blob:` reads because the run is longer
  (it goes on to 61 s of control now), so it reached 47 apples, not 45, and two more reflection lines played.
- **3550 or 3551 frames per 60 s of play, not 3552 to 3555:** the two reconnect pauses cut play into two more pieces,
  and each piece loses the frame that straddles the screen change (see v1.3).
- The short (`npm run short v1.4`): the launch at 4.85x, 29800 ms in all. `npm run play-share` was run again and now
  lists v1.4 too.

### What broke
- **The short cut the patch note:** "...even when you'd rather" with no "play." The card holds two lines of the note
  and hid the rest, and the layout check looked at the card, not at the text inside it, so it passed. The card now
  makes the note's font smaller, 1px at a time, until the whole note fits (v1.4's lands at 32px; the v1.0 to
  v1.3 notes fit at 34px as before, so their shorts are unchanged), and the check now covers the note's own text.
  tests/short.test.mjs puts every patch note in UPDATES.md through the layout; it failed without the fix.
- **My own v1.4 test, three times:** it compared values from the game's sandbox with deepEqual, which also compares
  their prototypes; it passed the screen name to the page as an undefined variable; and its own-origin check failed on
  a `blob:` URL until it used the rig's own `offOrigin`.
- **v1.3 run 1 had no control share in play** (its log stopped 37.90000003576279 ms short of the window); see the
  rig changes above. Headless runs now go on to 61 s of control, and each v1.4 run is about 9 minutes long.
- **The full `npm test` now takes about 11 minutes,** longer than one tool call can wait, so it runs in the background.

## Prompt 6: v1.5 Open world

### v1.5, the plan for the world and its culling (written before building)
**World size: 256 x 256 cells** (6144 x 6144 px at 24 px a cell). The view stays 20 x 20 cells, as in every version
so far, so the world is 12.8 screens wide and 163.84 screens in all.
- **Why this size: the walk.** UPDATES.md says time to first apple goes up "by the travel distance". The apple is
  placed by the seed at least 128 cells from the head (counted along the grid, as the snake moves), half the world's
  width. At one cell per tick (100 ms), that is at least 12.8 s of walking and at most 25.6 s from the middle (a
  corner is 256 cells away). Long enough to show in the numbers and in the short; short enough that every measured
  run still reaches several apples in its 60 s of control.
- **Why not bigger:** with culling the cost of a frame does not depend on the world's size, so a bigger world would
  only make each walk longer, and the rig's runs with it. The size is chosen for the walk, not for the frame rate.
- **Memory:** the ground and the props are one byte per cell each (65536 bytes each). The markers are objects:
  hundreds of them, 600 in all: 120 question marks, 24 viewpoints, 40 camps, 160 chests (all empty) and 256 acorns
  (the collectibles, with a running total). That is about one marker every 109 cells, about 4 on a screen, and on the
  world map, 480 px across for 256 cells, the world is covered in icons.
- **Rules unchanged:** one cell per tick; the walls are the edges of the world. Trees, rocks and markers are scenery,
  never obstacles, so the snake and the bot move exactly as before; the bot gets the bigger grid from the probe.

**How culling keeps the frame rate inside the budget** (median at least 50 fps, 5th percentile at least 30 fps):
- **Ground:** each frame works out the rectangle of cells the camera sees (20 x 20 at normal zoom, fewer in a
  close-up) and draws only those, plus one cell at the edges: at most 21 x 21 = 441 small images, from an atlas of
  ground tiles made once on the "Preparing your experience" screen. Anywhere in the world, a frame draws the same
  amount of ground; the other 65095 cells are never touched.
- **Trees, rocks and markers:** looked up by cell inside the same rectangle (two cells wider, for the canopies and
  shadows that hang over the edge), never by going through the whole world. Their sprites, shadows included, are
  drawn once at "Preparing" and then copied: no blur and no shadow is computed per frame.
- **Cloud shadows:** a few dozen soft shapes drifting over the whole world; each frame checks their rectangles and
  draws only the ones that overlap the view (one to three).
- **Minimap:** one image of the whole world at one pixel per cell (256 x 256), made once; each frame copies the
  part around the snake into the corner. A marker that changes (a chest opened, an acorn taken) changes one pixel.
- **The world map** is its own screen, not play, so it is not in the frame-rate window; it is drawn from the same
  256 x 256 image, scaled up, with the markers on top.
- What I cannot know before measuring: whether 441 tile copies a frame, plus the sprites, keep the 5th percentile
  above 30 fps in the visible window on the M1. If it does not, I stop and report, and do not make the world smaller.

### v1.5, what was built
As planned above: a world of 256 x 256 cells, made from the seed on "Preparing your experience" (src/world.js), with
its own generator, so the apples are the game's own.
- **Ground:** four kinds (grass, forest floor, meadow, dry grass) from smooth noise, eight tiles of each in an atlas;
  blades of grass that cross a tile's edge are drawn again on the other side, so tiles join without a seam.
- **Trees and rocks:** sprites with their shadows drawn once; forests are dense, rocks are sparse. They are scenery:
  the snake goes over them.
- **600 markers:** 120 question marks ("Location discovered: a rock."), 24 viewpoints ("The view: more markers."),
  40 camps ("Nobody was there."), 160 chests ("It was empty."), 256 acorns with a running total ("Acorn collected:
  1 / 256"). The head finds a marker by reaching its cell; a toast says what was in it.
- **The apple:** the rules take a board size and a distance: `newGame(random, 256, 128)` puts the apple on a free
  cell at least 128 moves from the head, and so does every apple after it. With no size and no distance the rules
  are v1.0's (tests/rules.test.mjs is unchanged and passes). With seed 1 the first apple is at (228, 191), 163 moves
  from the start (128, 128).
- **The quest:** a tracker (top left) with the distance in moves ("a cell is a metre"), an arrow circling the head
  that points to the apple while it is out of view, a marker over it once it is in view; the minimap and the world
  map show it too. Since the quest marker always shows where the apple is, the probe reports it, and the bot walks to
  it by its usual rule (the shortest path to the apple it can see), now on a 256-cell grid. The bot did not change.
- **The world map** is a new screen, `world-map`, after the autosave notice before every game: the whole world with
  every marker, "You", "The last apple", a legend, and "Fast travel: coming in a future update". Enter works after
  3000 ms; the screen offers Enter (probe `next`) and the bot presses it, as on every screen. During play, M opens it
  (the bot never presses M) and F says "Fast travel is coming in a future update."
- **The camera** follows the head and stops at the edges of the world; the close-ups of v1.3 centre on the head.
- **Night and day (a decision):** the opening is still at night, with v1.3's darkness and the light around the head.
  After it the world is in daylight: in v1.3 and v1.4 the darkness covered play too, but over a world of trees and
  cloud shadows it would hide this update's graphics step. The darkness is now drawn in the opening only.
- **UI:** the top bar of v1.4, the quest tracker with the acorn count, the minimap (72 x 72 cells around the head in
  112 px, bottom right), toasts.
- A trial visible run before tagging (a scratch script, not `npm run measure`, not kept) stayed inside the budget;
  the numbers that count are the measured ones below.

### What broke while building
- **world.js did not load at all:** I declared `lx` twice in the world map's drawing (a label and the legend), a
  SyntaxError that takes the whole file down. tests/v1.5.test.mjs caught it before the tag; my first trial frame-rate
  run had started on that file and was stopped.
- **The quest arrow hid under the minimap** in the first screenshots (it sat on the edge of the view, where the minimap
  is), and "Press an arrow key" covered the head (the camera now keeps the head in the middle, where the message was).
  The arrow now circles the head; the message sits below it.
- **The full `npm test` failed once, 74 of 75:** v1.0's bot test saw 87 of 88 turns accepted. The 88th was sent on the
  run's last look at the game, so nothing ever checked it, and it counted as refused. Three more v1.0 runs gave 87 of
  87. The rig now counts such a turn as unchecked, like one sent just before a death (commit 21037e1). This only
  showed up now because since prompt 5 a headless run, v1.0's test too, goes on to 61 s of control. Then I broke
  tools/measure.mjs with an apostrophe inside a quoted string ("run's"), which the rig test caught.

### v1.5, expected direction of every metric (written before `npm run measure v1.5`)
| Metric | Expected | Why |
|---|---|---|
| Time to first apple | up | the world map (3000 ms before Enter works) comes before play, then 163 moves to seed 1's apple (16300 ms at one move a tick); no reconnect on the way, since the first comes at move 194 |
| Load time | unchanged | the world map comes long after the warning, and the world is made inside "Preparing", a screen of fixed length (3000 ms of frames) |
| Control share (first 180 s) | up, by much | play starts a few seconds later than in v1.4, but what follows is mostly walking, which is control: in v1.4 the rest of the 180 s went to finishing moves and reflections, one set every few moves |
| Control share in play | up, by much | the apples are now at least 128 moves apart: each costs a walk of 12800 ms or more against one finishing move (2300 ms before the bot's key presses) and one reflection (4000 to 6800 ms by story.js); the reconnects (3000 to 6000 ms every 150 to 300 moves) stay |
| Download | up | world.js |
| JS lines / bytes | up | world.js and the camera and HUD in game.js |
| Assets | unchanged | everything in the world is made in code from the seed; no image files |
| JS heap after GC | up | the world: ground, props and the marker index (65536 cells each) and 600 marker objects; the canvases (atlas, sprites, minimap) are not on the JS heap |
| Frame rate median | unchanged (60 fps) | a frame draws one screen of tiles and sprites wherever the snake is |
| Frame rate 5th percentile | down a little | about 450 to 550 small images a frame (441 tiles, props, markers, clouds) against v1.4's one copy of the field; inside the budget |
| Requests to another origin | zero | nothing in the world is loaded from anywhere |

**Does control share go up, as UPDATES.md predicted? Yes, I still expect both numbers to go up, and by much.** The
walk is control: the arrow keys steer the snake the whole way. What took control away in v1.3 and v1.4 came with
every apple (the finishing move, the bite, the reflection), and the open world makes apples rare: one every 128 moves
or more instead of one every few. The reconnects still take their 3000 to 6000 ms every 150 to 300 moves, and the
world map adds a screen before play, but neither is close to what the walk adds. If this holds, our proxy says v1.5 is
"more of a game" than v1.3 or v1.4, and the video says so.

### v1.5, measured (`npm run measure v1.5`, medians of 5 runs) against the expectations written before measuring
| Metric | Expected | v1.4 | v1.5 | Direction |
|---|---|---|---|---|
| Time to first apple | up | 102958.79999999702 ms | 122037.29999999702 ms | up, as expected (19078.5 ms; in the median run the world map took 3018.699999988079 ms and the walk, `play`, 16315.09999999404 ms) |
| Load time | unchanged | 30145.70000000298 ms | 30122.90000000596 ms | unchanged, as expected |
| Control share (first 180 s) | up, by much | 0.06027444444456034 | 0.2858988888889551 | up by much, as expected |
| Control share in play | up, by much | 0.1390078500049561 | 0.6613049530638593 | up by much, as expected |
| Download | up | 695136 bytes | 723428 bytes | up, as expected (28292 bytes) |
| JS lines / bytes | up | 1407 / 58144 | 2093 / 86204 | up, as expected |
| Assets | unchanged | 629368 bytes | 629368 bytes | unchanged, as expected |
| JS heap after GC | up | 1705008 bytes | 1717284 bytes | up, but only by 12276 bytes, much less than I thought: the ground, the props and the marker index are typed arrays of 196608 bytes in all; I have not looked into why they barely show in this number |
| Frame rate median | unchanged | 60 fps | 60 fps | unchanged, as expected |
| Frame rate 5th percentile | down a little | 54.64480874311725 fps | 54.64480874311725 fps | unchanged (the same value), not down as I expected; the five visible v1.5 runs range from 54.34782608697371 to 58.13953488368158 fps |
| Requests to another origin | zero | 0 | 0 | zero, as expected |

Checks: first apple on tick 163 in all 5 runs; 25 of 25 turns accepted; 0 requests outside the game's origin; 0 failed
requests; 0 page errors. **Budget: pass** (median 60 fps, 5th percentile 54.64480874311725 fps, against 50 and 30).
- **Control share went up, as UPDATES.md predicted and as I expected.** In play: 0.6613049530638593, against
  0.14181426803644825 in v1.3 and 0.1390078500049561 in v1.4. In the first 180 s: 0.2858988888889551, against
  0.07952611111121045 and 0.06027444444456034. By our proxy v1.5 is more of a game than v1.3 and v1.4; it is still
  below v1.2 (0.7572433333333995 in the first 180 s, 1 in play).
- **What the 60 s of control cost in play (run 3):** 90729.70000000298 ms in all, with two apples (each a finishing
  move, a bite and a reflection) and three reconnects (4300, 4200 and 5500 ms, at moves 194, 375 and 592). In v1.4 the
  same 60 s of control took 431964.7999999821 ms (run 3), with 45 apples and two reconnects.
- **5 turns a run:** the walk to each apple is two straight lines, and the bot keeps its heading when that is as
  short. 25 turns in 5 runs, all accepted.
- **46 requests, not 90:** the server's 34 (the page, 7 scripts, 9 pieces of the patch, 17 voice files), plus 12
  `blob:` reads instead of 57: the run ends at 60 s of control (193526 ms in run 3, against 547658 ms in v1.4), so it
  has two apples and two reflection lines, not 47.
- **3593 or 3594 frames per 60 s of play, not 3550 or 3551:** play is cut into fewer pieces (two apples and three
  reconnects), and each piece loses the frame that straddles the screen change (see v1.3).
- The short (`npm run short v1.5`): the launch and the walk at 5.75x, 29866.666666666668 ms in all.
- **Noticed in the short, not fixed:** the recorder's speed label ("5.75x") sits over the left end of the game's top
  bar, so during the walk it covers "Score". v1.5's is the first short whose sped-up part shows play (the walk), so the
  first where it covers something that matters; moving it changes the fixed short layout, so I leave that for later.
- Nothing broke while measuring. The full `npm test` after it: 75 of 75, exit 0.

## Prompt 7: the short's speed label; v1.6 Progression

### The speed label moved
The label with the playback speed ("5.75x") sat at the top left of the game, over the game's top bar; in v1.5's short
it covered "Score" during the walk. It now sits at the top right of the patch-note card, where it never covers the
game. tests/short.test.mjs checks that it stays off the game and off the card's "Patch notes" (it failed with the old
place). All six shorts were rendered again (`npm run short v1.0` to `v1.5`, each exit 0): 720, 762, 757, 894, 894
and 896 frames. (I first wrote "as before" here; I had only checked that for v1.4 and v1.5, so it is gone.)

### v1.6, what was built
As UPDATES.md describes (src/progress.js):
- **XP:** 1 for every move in play, 25 for every apple. Levels at 50, 150, 300, 500, 750 XP (25 x L x (L - 1) for
  level L). Every level gives one skill point. XP, levels and skills carry over a game over.
- **Right turns only:** a turn is a left turn when it goes a quarter counter-clockwise from where the snake will be
  heading (right to up, up to left, left to down, down to right). Until "Turn left" is learned such a key does
  nothing but show "Skill locked: Turn left (requires level 5)" (from level 5 on, if not learned: "... (learn it in
  the skill tree)"). Straight back was never allowed. The rules in rules.js did not change; the lock is in the keys.
- **Every level-up stops the game:** "LEVEL UP!" over everything (a burst of 140 particles from a seeded generator,
  a glow; Enter after 2000 ms), then the skill tree (its links draw in for 1000 ms, then Up/Down move the cursor and
  Enter learns). Play goes on only once a skill is learned. Two level-ups at once (an apple's 25 XP can do it) give two
  in a row. A connection drop that comes at the same move waits until after the skill tree.
- **The skill tree sells back what the game used to do:** Smooth movement (v1.1: until learned, the snake jumps from
  cell to cell), Eye contact (v1.1: until learned, the eyes stare at you), Shadow (v1.2), Turn left (needs level 5),
  Tongue (does nothing), Turn right (Deluxe) (turns right, as before). In that order in the list.
- **The bot,** as UPDATES.md says, with the keys written down there before measuring (a logged change): it moves the
  cursor to "Turn left" if it can be learned, otherwise to the first skill in the list that can, then presses Enter.
  So it learns Smooth movement, Eye contact and Shadow at levels 2, 3 and 4, and Turn left at level 5. Its path search
  uses only the turns in the probe's new `allowedTurns` (a cell and a heading per state, since with right turns only
  the way the snake faces decides where it can go next).
- **Graphics:** the particles, a glowing XP bar (bottom left of the view, with the level and the XP to the next one),
  the skill tree with links that draw in and then flow (moving dashes), learned links in gold. 2D canvas.

### What broke while building
- **The bot's new path search was too slow:** 31 to 64 ms a move on the 256-cell world (a move is 100 ms), written with
  objects and a Map. Rewritten with flat number arrays: 4 to 7 ms (timed in Node on the same world).
- **Two levels at once would have offered "Turn left" too early:** the skill tree checked the level Snek had reached,
  not the level being chosen for, so XP for levels 3 to 5 at once would have let level 3's tree buy Turn left. Seen
  while writing the tests, before they ran; the tree now uses the level it is for.
- **My own tests, again:** two cross-realm deepEqual failures (values from a vm sandbox), and the first speed-label test
  measured the "Patch notes" block, which spans the whole card, instead of its words.

### v1.6, expected direction of every metric (written before `npm run measure v1.6`)
| Metric | Expected | Why |
|---|---|---|
| First apple's tick | unchanged: 163 | seed 1's first apple is 100 cells right and 63 down; the snake starts heading right, and right to down is a right turn, so the right-turns-only path is the same 163 moves. Right-turn-only paths are longer only when the shortest path needs a left turn, which this one does not; later apples, before level 5, can |
| Time to first apple | up | two level-ups on the way (at moves 50 and 150), each a LEVEL UP! (2000 ms before Enter works) and a skill tree (1000 ms, then the bot's key presses, 250 ms apart when it moves the cursor) |
| Load time | unchanged | nothing before the warning changed |
| Control share (first 180 s) | down | the same launch, then level-ups taking time out of the walk; the first 180 s end before many apples |
| Control share in play | down | in 60 s of control (about 600 moves and two or three apples) Snek reaches level 5 or 6: four or five LEVEL UP! screens and skill trees, about 3000 to 4000 ms each. Longer right-turn-only walks before level 5 add control too, but less than the level-ups take |
| Download | up | progress.js |
| JS lines / bytes | up | progress.js and the game's new screens |
| Assets | unchanged | no files added; the particles and the tree are drawn in code |
| JS heap after GC | up, a little | the skill list, the particles and the progression state |
| Frame rate median | unchanged | play draws the same world, plus one glowing bar |
| Frame rate 5th percentile | unchanged or slightly down | the XP bar's glow (a shadow blur) every frame of play; the particles and the tree are not play, so not in the window |
| Requests to another origin | zero | nothing new is loaded from anywhere |

### v1.6, measured (`npm run measure v1.6`, medians of 5 runs) against the expectations written before measuring
| Metric | Expected | v1.5 | v1.6 | Direction |
|---|---|---|---|---|
| First apple's tick | unchanged: 163 | 163 | 163 (all 5 runs) | unchanged, as expected |
| Time to first apple | up | 122037.29999999702 ms | 128380.70000000298 ms | up, as expected (6343.4000000059605 ms; the two level-ups and skill trees on the way took 6340.0999999940395 ms in the median run) |
| Load time | unchanged | 30122.90000000596 ms | 30141.60000000894 ms | unchanged, as expected |
| Control share (first 180 s) | down | 0.2858988888889551 | 0.2537455555555721 | down, as expected |
| Control share in play | down | 0.6613049530638593 | 0.5746840195698081 | down, as expected |
| Download | up | 723428 bytes | 738812 bytes | up, as expected (15384 bytes) |
| JS lines / bytes | up | 2093 / 86204 | 2445 / 101353 | up, as expected |
| Assets | unchanged | 629368 bytes | 629368 bytes | unchanged, as expected |
| JS heap after GC | up, a little | 1717284 bytes | 1811332 bytes | up (94048 bytes), more than v1.5's world added (12276 bytes); I have not looked into why |
| Frame rate median | unchanged | 60 fps | 60 fps | unchanged, as expected |
| Frame rate 5th percentile | unchanged or slightly down | 54.64480874311725 fps | 56.818181818163026 fps | up (2.173373075045774 fps), which I did not expect; the five visible v1.6 runs range from 54.054054054054056 to 57.142857142857146 fps |
| Requests to another origin | zero | 0 | 0 | zero, as expected |

Checks: first apple on tick 163 in all 5 runs; 25 of 25 turns accepted; 0 requests outside the game's origin; 0 failed
requests; 0 page errors. **Budget: pass** (median 60 fps, 5th percentile 56.818181818163026 fps).
- **What 60 s of control cost in play (run 2, the median):** 104405.20000001788 ms, with four level-ups (levels 2 to 5,
  each LEVEL UP! and a skill tree), two apples and three reconnects. The bot learned Smooth movement, Eye contact,
  Shadow, and at level 5, Turn left, as the rule says.
- **Run 1 died; the others did not.** Its in-play share is 0.505244862712289 (the other four: 0.5743770402351117 to
  0.5747231031982711). The second apple (tick 456) is at (126, 0), on the top edge of the world, and the snake reaches
  it heading up. After the bite come the reflection, LEVEL UP! (level 5) and the skill tree; when the bot's Enter on
  the tree resumed play, the snake was facing the edge with one move to go. In run 2 the bot's first look at play came
  in time and it turned left 44 ms after play resumed. In run 1 the next move came 69 ms after play resumed, before the
  bot's first look at play (its next key was Enter on the game-over screen): the snake hit the edge, a new game
  started (autosave, world map, a third apple), and the window took 118754.30000001192 ms. It died at
  187950.90000000893 ms, after the 180 s session, so the output says "deaths 0" for run 1: the rig counts deaths in the
  first 180 s only. v1.5 had the same apple and the same short moment after its reflection, and the bot was in time in
  all five runs. I changed nothing after the tag. Run 1 is one of the five values in every median, but no median is
  run 1's own value.
- **47 requests a run, 48 in run 1:** one more script (progress.js) than v1.5's 46; run 1's new game had one more
  reflection line.
- **3592 or 3593 frames per 60 s of play,** against 3593 or 3594 in v1.5. The level-ups cut play into four more pieces,
  which by v1.3's explanation should cost about four frames, not one; I have not looked into it.
- The short (`npm run short v1.6`): the launch and the walk at 6.05x, 29900 ms in all; the first LEVEL UP! shows in
  the sped-up part.
- Nothing broke while measuring, apart from run 1's death above. The full `npm test` after it: 84 of 84, exit 0.

## Prompt 8: v1.7 Season 1

### v1.7, the vision radius and the search (written before building)
**Vision radius: 6 cells** (the apple shows when its centre is within 6 cells of the head's, as the crow flies). The
view is 20 x 20 cells, so the circle Snek can see is 13 cells across, smaller than the screen: the apple can be on
the screen and still not be there for you, which is the joke. Why 6 and not smaller:
- **The search takes most of the world.** Before choosing, I ran the bot's search offline on the real rules
  (rules.js, the 256-cell world, the apple 128 moves away) with the real bot code (tools/rig/bot.mjs: the nearest
  unseen cell, right turns only until move 500, when Turn left would be learned) for seed 1, counting moves only, no
  screens. The bot does not find seed 1's apple at (228, 191) until it has seen most of the world:

  | Radius | Moves to seed 1's first apple | Cells seen when it came into view | Reconnects on the way |
  |---|---|---|---|
  | 3 | 13685 | 54245 | 65 (298100 ms) |
  | 4 | 13183 | 63751 | 62 (287400 ms) |
  | 5 | 10949 | 63225 | 52 (239200 ms) |
  | 6 | 7595 | 52228 | 36 (163700 ms) |
  | 7 | 7155 | 56121 | 34 (153000 ms) |
  | 8 | 6555 | 58442 | 31 (140800 ms) |

- **Run length:** with radius 5 one headless run would take about 26 minutes by the estimate below; with 6, about 18.
  Radius 7 or 8 would save little (7155 and 6555 moves) and is no longer "small" (15 and 17 cells across, most of the
  screen). So 6: the smallest radius that keeps a run under the 20 minutes you set.
- **Other seeds** with radius 6 (offline, for the record): seed 2 6618 moves, 3 6760, 4 6915, 5 5885.

### How long one headless run may take (estimate, written before any measurement)
From the offline search for seed 1, radius 6, and the screen lengths fixed in the code:
- the launch up to the first control frame, as in v1.6: about 103300 ms;
- 7595 moves at 100 ms: 759500 ms;
- 36 reconnects: 163700 ms (their lengths come from the seed);
- level-ups: 7595 XP reaches level 17 (6800 XP; 18 needs 7650), so 16 LEVEL UP! screens and skill trees, about 3300
  ms each as measured in v1.6 (3036 and 3304 ms): about 52800 ms;
- battle-pass tiers, one every 500 XP: 15 tier screens of 1500 ms plus the bot's Enter: about 22800 ms;
- the finishing move and the bite: about 2300 ms.

**About 1104400 ms, 18.4 minutes a headless run.** The run stops soon after the first apple (by then it has had far
more than 61 s of control). Five headless runs: about 92 minutes; five visible frame-rate runs stop after 61 s of
control, about 3 minutes each. That is under 20 minutes a run, but not by much: after building I will time one
headless run first, and if it takes more than 20 minutes I stop and tell you before running all five.

### Prompt 9 (the same v1.7, with skins), before building
Prompt 9 came while prompt 8 was under way; the vision radius, the offline search and the run-time estimate above were
already written and committed (ed0991d) and stand. What follows is prompt 9's clarification of "cosmetics only",
written before building.

**Skins: 10 in the loot boxes, plus the one Snek starts with.** All drawn in code (src/skins.js), no image files.

| Skin | Rarity | How it looks |
|---|---|---|
| Moss | Common | dark green body, pale head |
| Sand | Common | tan body, cream head |
| Slate | Common | blue-grey body, light grey head |
| Plum | Common | purple body, pink head |
| Tiger | Rare | orange body with dark stripes (a pattern) |
| Frost | Rare | ice-blue body with a cold glow |
| Ember | Rare | red body that leaves a fading trail of embers |
| Neon | Epic | cyan body with a strong glow |
| Galaxy | Epic | dark blue body with stars (a pattern) |
| Classic Green | Legendary | the v1.0 snake: square cells, #3b3 with a #8f8 head, no eyes |

- **Warden** is the look Snek starts with (v1.6's: round, light green, eyes). It is not in the boxes.
- **Odds per box:** Common 60 %, Rare 25 %, Epic 12 %, Legendary 3 %; within a rarity every skin is equally likely.
  They are shown on the loot-box screen and written in UPDATES.md (a logged change, before building).
- **Drops come from the seed:** the loot boxes have their own generator made from the seed (not the apples'), so the
  same seed gives the same boxes in the same order, and the apples do not move. A skin already owned is a "Duplicate".
- **A skin changes only how the snake is drawn.** The skin is read only by the drawing code; the rules, the tick, the
  speed and the collisions never see it. tests/v1.7.test.mjs plays the same game under every skin, on a virtual clock
  with the same keys, and checks that the game's log and final state are identical.
- **Flow after a game over:** "Game over" (Enter) -> the loot box (it shakes, opens with light rays and sparkles,
  shows the skin and its rarity; the odds are on screen; Enter after the animation) -> the wardrobe (the new skin, now
  worn, and the whole collection; Enter to leave) -> the autosave notice and the world map, as before. The bot
  presses what each screen offers, as on every screen; it never chooses a skin (the newest is worn automatically).

## Prompt 10: Warden Snek's voice

v1.7 was being built when prompt 10 came. Its unfinished work (src/season.js, src/skins.js, changes to src/ and the
rig) went into `git stash` ("v1.7 in progress (prompt 9), paused for the voice recording (prompt 10)") so that this
prompt changes no game code; it is still there, untouched.

- **What was recorded:** the 17 lines of src/story.js, on 2026-10-14 (UTC), with `npm run voice -- --record` (new in
  tools/voice.mjs): the ElevenLabs text-to-speech API (v1), model eleven_v3, voice S44KQ3oLFckbxgyKfold (the author's
  own Voice Design voice, not a library voice, not a clone), stability 0.5, output mp3_44100_64; each line sent as its
  emotion tag and its text, e.g. "[weary] There was an orchard here once." **One take a line, 17 takes in all.** The
  only network calls were those 17 requests. The API key came from the environment (ELEVENLABS_API_KEY) and is
  written nowhere. voice/RECORDING.json has every request's text and every take's bytes and length; voice/LINES.md
  has the disclosure line.
- **Two lines do not fit their slots** (`npm run voice -- --check`, exit 1): 14 ("I am getting longer. That is either
  growth or regret.") is 5520 ms in a 4800 ms slot, 720 ms over; 16 ("Another one. The orchard remembers.") is 3600 ms
  in a 2800 ms slot, 800 ms over. As asked, I did not change a slot or speed up a take. tests/v1.3.test.mjs ("every
  line has its audio file, and it fits in the line's slot") fails on those two, as it should, until this is decided.
- The recordings replace the placeholders in src/voice/ and, by `npm run voice`, in dist/v1.3/ to dist/v1.6/ (68
  files). No .js or .html in src/ changed.
- **The shorts have no sound.** The recorder makes each short from screenshots, with no audio track, so the voice is
  not in them. The shorts of v1.3 to v1.6 were rendered again, as asked.
- The shorts, rendered again (`npm run short v1.3` to `v1.6`, each exit 0): 894, 894, 896 and 897 frames, video only.
  The mp4 files of v1.3, v1.4 and v1.5 came out different from the ones before; v1.6's is byte for byte the same. I
  have not looked into why.
- Tests after the recording: tests/v1.3.test.mjs, v1.4, build, size and determinism, 18 of 19; the one that fails is
  the slot test, on 14.mp3 (it stops at the first). I did not run the full `npm test` for this prompt.

## Prompt 11: retakes for lines 14 and 16; voice in the shorts

### Lines 14 and 16
Same settings as prompt 10 (`npm run voice -- --retake 14,16`, new in tools/voice.mjs: up to three new takes, the
first that fits is kept, the others deleted; every take's length is in voice/RECORDING.json under `history`).
- **Line 14** ("[dry] I am getting longer. That is either growth or regret.", slot 4800 ms): take 1 (prompt 10) 5520
  ms; take 2 4880 ms, deleted; **take 3 4640 ms, kept**. 3 takes in all.
- **Line 16** ("[solemn] Another one. The orchard remembers.", slot 2800 ms): take 1 (prompt 10) 3600 ms; takes 2, 3
  and 4 3520 ms each, deleted. No take fitted after three, so, as asked, the line is now said shorter, same meaning,
  same tag: "[solemn] Another. The orchard remembers." Take 5 2960 ms, deleted; **take 6 2640 ms, kept**. 6 takes in
  all.
- **What changed and what did not:** only the words sent to the voice changed (SPOKEN in tools/voice.mjs). I did not
  change the line in src/story.js: the slot is computed from that text's words (5 words: 2000 ms + 800 ms), so
  shortening it there would shorten the slot, and every build from v1.3 on has its own story.js anyway. So the
  subtitle still reads "Another one. The orchard remembers." while the voice says "Another. The orchard remembers."
  voice/LINES.md has both, in "Said shorter than the subtitle". No slot changed; no take was sped up or cut.
- `npm run voice -- --check`: exit 0, all 17 fit. `npm run voice` copied 14 and 16 into dist/v1.3 to v1.6 (8 files).
- The Voice Design description in voice/LINES.md is now marked "proposed, not confirmed".
- **Why the v1.3 to v1.5 shorts changed in prompt 10 and v1.6's did not: unexplained** within the 15 minutes. What I
  found: rendering v1.3's short twice in a row gives the same file byte for byte, so the recorder is repeatable; one
  lead, not checked: the loading screen's "Voice lines: N of 17" depends on when the real downloads of the voice files
  finish during the replay (the first loading frame of v1.3's short shows "0 of 17", the next "17 of 17"), and those
  files changed.

### Voice in the shorts
`npm run short` now gives every short a sound track (AAC, mono, 44.1 kHz): silence, except Warden Snek's lines in the
segments played at 1x. The recorder's virtual clock (tools/short/vclock.js) notes each sound the game starts, and when,
instead of playing it; the recorder puts the line's file there on the track, at its recorded length. A line stops
where a segment faster than 1x begins or where the short ends; no line is sped up. tests/short.test.mjs checks the
placing and that the fixture's short has a silent AAC track; the text-not-box checks are unchanged. All seven shorts
were rendered again (each exit 0); every file now has one H.264 and one AAC stream.

| Short | Lines heard (second of the short, from the replay) | Heard of the take |
|---|---|---|
| v1.0 | none (silent track) | |
| v1.1 | none (silent track) | |
| v1.2 | none (silent track) | |
| v1.3 | line 10, "One apple. Not the orchard. But it is a start.", v1.3 in D, at 29.3838186991915 s | 416.1813008084973 of 3840 ms (the short ends) |
| v1.4 | line 10, v1.3 in A, at 2.5829000000059605 s; line 10, v1.4 in D, at 29.387344329899282 s | 3417.0999999940395 of 3840 ms (C starts at 6 s); 412.65567010071754 of 3840 ms (the short ends) |
| v1.5 | line 10, v1.4 in A, at 2.574533333336323 s; line 10, v1.5 in D, at 29.4496217391329 s | 3425.4666666636767 of 3840 ms; 417.0449275337669 of 3840 ms |
| v1.6 | line 10, v1.5 in A, at 2.5793666666696518 s; line 10, v1.6 in D, at 29.453162258950695 s | 3420.6333333303483 of 3840 ms; 446.8377410493049 of 3840 ms |

- Line 10 is the first reflection: it starts 600 ms after the apple (the letterbox), and segment D ends 1000 ms after
  the apple, so in D only its first 0.4 s or so is heard. In A it runs over the patch-note card until C begins.
- Where a line is cut at the start of C, the AAC encoding leaves a trace in the first 50 ms after it (max -33.6 dB in
  v1.4's short between 6.00 and 6.05 s; -91.0 dB, silence, from 6.05 s on).
- The full `npm test` after this prompt: 85 of 85, exit 0.

## Prompt 12: segment D until the line ends; v1.7 continued

### The short plan, one change
Segment D now runs from 2 s before the first apple until Warden Snek's line after it has been said in full (the line
starts 600 ms after the apple, story.js's letterbox, and lasts as long as its recording), instead of 1 s after the
apple; without voice lines (v1.0 to v1.2) D is unchanged. A carries no voice any more. If the short would pass 30 s,
C goes faster in steps of 0.05x until it fits, with 100 ms kept for the line starting a little later in the replay
than in the recorded run. The recorder ends D on the first video frame after the line has ended, as the replay plays
it. README.md has the plan; tests/short.test.mjs checks D's length, the steps of C, and that A is silent.

| Short | Length | C | Line 10 starts | ends | Heard |
|---|---|---|---|---|---|
| v1.3 | 29833.333333333332 ms (895 frames) | 4.9x | 25.9877503401408 s | 29.8277503401408 s | 3840 of 3840 ms, in full |
| v1.4 | 29833.333333333332 ms (895 frames) | 5.8x | 25.97834942528983 s | 29.81834942528983 s | 3840 of 3840 ms, in full |
| v1.5 | 29833.333333333332 ms (895 frames) | 6.9x | 25.97124589372236 s | 29.81124589372236 s | 3840 of 3840 ms, in full |
| v1.6 | 29866.666666666668 ms (896 frames) | 7.25x | 25.996522988503195 s | 29.836522988503194 s | 3840 of 3840 ms, in full |

`npm run short v1.3` to `v1.6`, each exit 0. C had been 4.1x, 4.85x, 5.75x and 6.05x. v1.0 to v1.2 were not rendered
again: they have no voice, so their plan did not change.

### v1.7, what was built
The plan of prompts 8 and 9 above (ed0991d, 846fa33): radius 6, the battle pass, the PARODY shop, the loot box, the
wardrobe, the skins, the bot's search. The work was in `git stash` during prompts 10 and 11 and came back unchanged
(`git stash pop`); what follows was added after.
- **The apple shows only within 6 cells** of the head (src/season.js, `appleVisible`): in the world, on the minimap,
  on the world map and in the probe. Out of sight, the quest tracker says "Location unknown"; a dashed circle shows how
  far Snek can see.
- **The battle pass** (src/season.js): one tier every 500 XP (the XP of v1.6), 100 tiers; the top reward, at tier 100,
  is "Apple Vision: the ability to see the apple" (50000 XP, out of reach in a measured run). Every new tier stops play
  for the battle-pass screen: a track of tier cards that slides to the new tier, the free row and a locked premium
  row, the top reward pinned below it, "Golden Scales: 0". It offers Enter (Continue) after 1500 ms. Its "B: Buy tiers
  with Golden Scales" button opens the PARODY screen: "Nothing is for sale." Both screens carry a PARODY label. No
  payment code, no network, no prices (tests/v1.7.test.mjs checks the code for them).
- **After every game over:** the loot box (it shakes, bursts open with light rays and sparkles, shows the skin, its
  rarity and the drop odds; Enter after 3200 ms), then the wardrobe (the new skin, worn, and all 11; Enter after
  1000 ms), then the autosave notice and the world map as before.
- **Skins** (src/skins.js), as written before building: 10 in the boxes plus Warden, the look Snek starts with; odds
  Common 60 %, Rare 25 %, Epic 12 %, Legendary 3 %; Classic Green, the Legendary, draws the v1.0 snake (square cells,
  #3b3 and #8f8, no eyes). Drops come from the seed. **Bytes added: src/skins.js 5197, src/season.js 15835** (season.js
  also holds the vision, the battle pass and the screens). tests/v1.7.test.mjs plays 20 s of the same game under each
  of the 11 skins, on the short recorder's virtual clock with the same keys, and finds the log and the final state
  identical; and draws 20000 boxes from seed 1 to check the odds (each rarity within 1.5 points).
- **Line 16 (prompt 12):** in v1.7's story.js its subtitle is "Another. The orchard remembers.", as it is said, and its
  slot is pinned at 2800 ms (`slot: 2800`; slotMs uses a pinned slot before counting words), the slot the old text had.
  v1.3 to v1.6 keep "Another one. The orchard remembers." in their own story.js. voice/LINES.md shows both.
- **The camera may now look 3 cells past the edge of the world** (dark ground there). Without it, in the first
  screenshots of the search, the snake ran along the bottom edge hidden under the XP bar, as the camera stopped at the
  edge and the head sat at the bottom of the view. And the acorn count moved right in the quest tracker, where "Location
  unknown" ran into it.
- **The rig** (tools/rig/run.mjs) keeps the bot's memory of seen cells for the search and reports, per run, how many
  cells the bot had seen when the apple first came into view (`search`), in the measure output too.

### What broke while building
- In prompt 9's work, before the stash: `memory` in tools/rig/run.mjs was already the heap reading, so the bot's
  memory of seen cells needed another name (a SyntaxError, caught by `node --check`).
- My own v1.7 tests: "stripe" (a payment company) matched "stripes" (Tiger's pattern); a cross-realm deepEqual, again.
- tests/v1.4.test.mjs compared v1.4's story.js with src/story.js, as its way of checking that v1.4 plays the voice
  from the same place; with line 16 changed for v1.7 they differ, so it now checks that the build plays its own
  voice/ files (which `npm run voice` keeps the same as src/voice/).

### One headless run, timed before measuring
As promised above, before running all five: one headless run of src/ with the rig's settings (a scratch script calling
tools/rig/run.mjs's runOnce, as `npm run measure` does; not a measurement, not kept): **1105656 ms of wall time, 18.4
minutes**, against the estimate of 1104400 ms. Under the 20 minutes, so the measurement goes ahead. The run found the
apple on tick 7595 after seeing 52228 cells, the numbers of the offline search; no death, no error, 66 of 66 turns
accepted.

### v1.7, expected direction of every metric (written before `npm run measure v1.7`)
| Metric | Expected | Why |
|---|---|---|
| First apple's tick | 7595 (163 in v1.6) | the bot's search reaches seed 1's apple on move 7595 in the offline search and in the timed run; the game and the bot are deterministic, so I expect the same in all five runs |
| Time to first apple | up, sharply (about 1100 s) | 7595 moves at 100 ms, plus 36 reconnects, 16 level-ups and 15 battle-pass tiers on the way |
| Load time | unchanged | nothing before the warning changed |
| Control share (first 180 s) | up, a little | UPDATES.md says down; I do not expect that here. In v1.6 the first 180 s held two level-ups and the first apple (finishing move, bite, reflection); in v1.7 they hold only the walk (the search), the same level-ups and one battle-pass tier at move 500. The loot box comes only after a game over, and I expect none |
| Control share in play | up | UPDATES.md says down; I expect up for the same reason: v1.6's first 60 s of control held two apples, each about 8300 ms of finishing move, bite and reflection; v1.7's hold no apple at all, but four level-ups, one tier screen (about 1500 ms) and the reconnects, as v1.6 |
| Download | up | season.js and skins.js |
| JS lines / bytes | up | the same |
| Assets | unchanged | skins are drawn in code; the voice files are new recordings since prompt 10, but download counts only what a version fetches, and assets are counted from the build: they changed in size for v1.3 to v1.6 too (not measured again) |
| JS heap after GC | up, a little | the skins, the season's state |
| Frame rate median | unchanged | play draws as in v1.6, plus a dashed circle |
| Frame rate 5th percentile | unchanged or slightly down | the same |
| Requests to another origin | zero | nothing is loaded from anywhere; the shop is a screen |
| Deaths | none expected | the timed run had none; a death would mean a loot box, a wardrobe and a new search |
