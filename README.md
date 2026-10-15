# AAA Snake

A tiny, honest Snake that receives a series of "AAA updates": each one adds a cliché of big-budget games, and each one
is measured: how much heavier and slower the game got, and how long it now takes to reach the first apple. Made for the
CodeMask video "How I Turned Snake Into a AAA Game with Claude Code".

Every version stays playable side by side in `dist/<version>/`. The original is `dist/v1.0/`: open its `index.html`,
or run `npm run serve` and visit http://localhost:8080/.

## Commands (Node 22+)

```
npm install                 # playwright 1.63.0, the only dependency (dev)
npx playwright install chromium
npm test                    # game rules, determinism, the rig, the chart, the recorder
npm run build <version>     # copy src/ to dist/<version>/ (never overwrites)
npm run measure <version>   # one headless and one visible run -> measurements/<version>.json, summary.csv ("single run")
npm run measure:final <version>  # 5 + 5 runs and their medians; once, overnight, before release
npm run reevaluate <version>  # the frame rate again from the saved runs, with the current rules
npm run fps-check           # headless vs visible window frame rate, on test loads
npm run chart               # measurements/summary.csv -> out/bloat.png
npm run short <version>     # 30-second vertical short -> out/shorts/<version>/
npm run short -- trailer v1.0 v2.0  # the trailer: both side by side on one clock -> out/shorts/trailer/
npm run voice               # voice/LINES.md, placeholders, and src/voice/ copied into every build
npm run voice -- --check    # every voice line against its slot, and every build against src/voice/
npm run voice -- --record   # record the 17 lines with the ElevenLabs API (needs ELEVENLABS_API_KEY in the environment)
npm run voice -- --record host  # record the host's lines for the shorts (voice/HOST.md) into voice/host/
npm run play-share          # control share in play, from the saved runs of every version
```

`npm run measure` opens visible Chromium windows for its frame-rate runs.

## Methods

- **During the build** (since prompt 13), `npm run measure <version>` does one headless run (every metric but frame
  rate) and one run in a visible window (frame rate); measurements/summary.csv marks such a row "single run" and the
  chart puts a * after its version. The game and the bot are deterministic (v1.7's headless runs 1 and 2 both reached
  the first apple on tick 7595), so more runs would only measure timer noise.
- **Before release**, `npm run measure:final <version>` measures every version again with 5 headless and 5 visible
  runs and takes medians ("median of 5 runs"). v1.0 to v1.6 were measured that way during the build already.
- **A game that ends before 60 s of control** (v2.0, prompt 15): both control-share metrics are computed over the
  actual window up to THE END (control time / time until the end screen), and the summary.csv row and the chart mark
  it "game ended at N s". Time to first apple is unaffected. The JS heap is then read when the game has ended, and the
  frame rate is taken over the control frames the run had.
- **Frame rate with under one whole second of control** (v2.0, prompt 16): the median is taken over individual frames
  (1000 / frame ms) instead of per-second counts, the summary.csv `fps_window` cell says "median over N frames", and
  the budget check uses it. `npm run reevaluate <version>` applies the rules to a version's saved runs without
  measuring again.
- Numbers are written as measured, never rounded; every run's raw data is kept under measurements/<version>/.

## Shorts

`npm run short <version>` replays the version's median measured run on a virtual clock into a 1080 x 1920 video,
25 to 30 s. v1.0 has its own plan (its file is kept; it is not published on its own); every later version follows one
fixed plan. From frame 0 every short shows the same premise line at the top, "I turned Snake into a AAA game.", and
under it the patch line, "Patch 1.4: online only." (the version and its short name from UPDATES.md), then the patch
note. All three shrink to fit their box, and the recorder fails if any text spills out of it.

- **A** (3 s): the previous version reaches its first apple at real speed. No voice.
- **B** (3 s): the new version's patch note.
- **C**: the new version from launch to 2 s before its first apple, sped up: 16 s of clip at the largest step of
  0.05x that does not make it shorter, 4x while that fits in 21 s, faster only beyond; and faster again, in steps of
  0.05x, if the whole short would otherwise pass 30 s. The speed shows next to the premise line.
- **D**: the first apple at real speed, from 2 s before it until Warden Snek's line after it has been said in full
  (apple + 600 ms + the line's recorded length); for a version without voice lines, until 1 s after the apple. v2.0's
  D runs to the first frame of the credits (tools/short/plans.json), so it may end under 25 s.

The sound track is silence except that line in D, from the moment the replay starts it, at its recorded length.

**The host** (since prompt 17; voice/HOST.md): four lines per short. Line 1 starts at 0 s over A; line 2 over the
patch card; line 3 over C; nothing from the host during D, where Warden Snek's line plays alone; line 4 0.3 s after D ends,
over a freeze of D's last frame, and the short ends when line 4 ends. A, B and C each last at least their line plus
0.3 s (A starts earlier in the previous run, so its apple stays 1 s before A ends). C lasts as long as line 3 needs:
its factor is the largest step of 0.05x that keeps C at least that long, never slower than real time. Host and Snek
never speak at once (the recorder fails if they would); no line is cut or sped up. The 25 to 30 s target no longer
applies.

### The trailer

`npm run short -- trailer v1.0 v2.0` puts both versions on screen at once, each replaying its median measured run
from the same seed, on one shared virtual clock, 1080 x 1920. Since prompt 20 they are stacked: v1.0 on top, v2.0
below, each panel the full 1080 width and 600 tall (the game keeps its own 480 x 512 shape: 562.5 x 600 in the
middle of a black strip), each with its counter under it and the premise line in the divider between them. Every
piece of text stays in the safe area (nothing below y = 1440 or right of x = 918); the panels only need to be inside
the frame. Two counters, "Snake: first
apple in", which stops on v1.0's measured median once v1.0 eats, and "AAA Snake: first apple in", which runs until
v2.0's own first apple. Timing (tools/trailer.mjs, `TRAILER`): the first 15 s at real time; the last 10 s at real
time, ending 1 s after THE END, so they hold the inner apple, the line, THE END and the counter's real value; the
middle sped up at the smallest step of 0.05x that keeps the whole within 30 s, the factor on screen. Prompt 16 asked
for 20 s at the start; 20 + 10 s at real time leave no room for the middle within 30 s, so the start is 15 s. The sound
is Warden Snek's lines that start in a real-time part.

With the host (five lines): line 1 at 0 s and line 2 ("Done.") right after it, when v1.0 has already eaten; the
first part then ends 1 s after "Done." (prompt 20, instead of at 15 s); line 3 over the middle, which lasts at least line 3 (its factor the largest step of 0.05x that allows it); line 4 starts the
last real-time part, timed to end 0.3 s before Warden Snek's line, so it plays over the walk to the cabinet; line 5
when THE END shows, over a freeze of the last frame until it ends. The 30 s limit does not apply.

## Files

- `src/` the game being worked on; `dist/` every released version.
- `tools/` the build, the measuring rig (`tools/rig/`), the chart and the short recorder.
- `measurements/` every measurement, raw runs included.
- `UPDATES.md` the plan for the updates. `PROMPTS.md` every prompt, verbatim. `DEVLOG.md` what happened.

Purchases, currencies and loot boxes in later versions are parody: nothing is sold and nothing goes over the network.

## Disclosure

Warden Snek's 17 voice lines (`src/voice/`, since v1.3) are a synthetic voice: generated with the ElevenLabs
text-to-speech API (model eleven_v3) in a voice designed for this project with ElevenLabs Voice Design. It is not a
library voice, not a clone, and not modelled on any actor or character. Date, settings and the exact text of every
line: `voice/LINES.md` and `voice/RECORDING.json`.

The host of the shorts and the trailer (`voice/host/`, since prompt 17) is a synthetic voice too: Justin, the CodeMask
voice of earlier episodes, ElevenLabs voice library voice "Justin Time - Elearning Narration" (uFIXVu9mmnDZ7dTKCBTX),
generated with the ElevenLabs text-to-speech API, model eleven_v3, stability 0, similarity 0.75, style 0.2, speed 1,
mp3_44100_64, one take a line, on 2026-10-15. The exact text of every line: `voice/HOST.md`; every request, its date
and the length of each take: `voice/RECORDING.json` ("host").
