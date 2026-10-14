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
