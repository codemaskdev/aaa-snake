# AAA Snake

Snake, turned into a AAA game one industry habit per patch. A tiny, honest Snake (v1.0) gets ten patches of big-game
clichés (logos, a day-one patch, a story, always online, an open world, a skill tree, a season pass, a remaster, a Game
of the Year Edition), and every patch is measured: how long until the first apple, and how much of that time you
actually control the snake. Built with Claude Code for the CodeMask channel.

- **A parody.** Nothing is for sale: every shop, currency and loot box is fake, there is no payment code, and the game
  makes no request outside its own site. The publisher, studio and engine are invented.
- **Synthetic voices.** Warden Snek and the host of the shorts are generated with ElevenLabs text-to-speech (see
  Disclosure below).
- **Play it:** https://codemaskdev.github.io/aaa-snake/ adds one patch a day, at 19:00 UTC+3. Locally: `npm run serve`,
  then http://localhost:8080/, or open any `dist/<version>/index.html`.
- **Measure it:** `npm install`, `npx playwright install chromium`, then `npm run measure <version>`. The numbers in
  the series are single runs, in `measurements/`.
- **Site:** `npm run publish:day` runs the Pages workflow by hand, if a scheduled run was missed. It needs `gh`, logged
  in with access to the repository.

## Commands (Node 22+)

```
npm install                 # playwright 1.63.0, the only dependency (dev)
npx playwright install chromium
npm test                    # game rules, determinism, the rig, the chart, the recorder
npm run build <version>     # copy src/ to dist/<version>/ (never overwrites)
npm run measure <version>   # one headless and one visible run -> measurements/<version>.json, summary.csv ("single run")
npm run measure:final <version>  # 5 + 5 runs and their medians (not used: the series uses the single runs)
npm run reevaluate <version>  # the frame rate again from the saved runs, with the current rules
npm run fps-check           # headless vs visible window frame rate, on test loads
npm run chart               # measurements/summary.csv -> out/bloat.png
npm run short <version>     # 30-second vertical short -> out/shorts/<version>/
npm run short -- trailer v1.0 v2.0  # the trailer -> out/shorts/trailer/
npm run build-site          # the GitHub Pages site for today (UTC+3) -> site/; RELEASE_TODAY=YYYY-MM-DD to test
npm run publish:day         # gh workflow run pages.yml: publish today's patch if a scheduled run was missed
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

`npm run short -- trailer v1.0 v2.0` (tools/trailer.mjs, design "A" since prompt 21): one full-width panel,
1080 x 1920. The premise line is in a 90 px band at the top. Under it is the game at 1080 x 1152 (its 480 x 512 canvas at
2.25x), then the time-to-first-apple counter in a band, with nothing below y = 1440. Every piece of text stays in the
safe area and inside its box, every frame. Each version replays its median measured run from the same seed, on its
own virtual clock. The host's lines are voice/HOST.md's "trailer": 1a, 1b, 2 to 5.

1. v1.0 from its first drawn frame, line 1a at 0 s. Once v1.0 eats, the frame holds, with the counter stopped on
   v1.0's median (0.320 s). "Done." comes 0.3 s after 1a, and the hold lasts until it ends plus 400 ms.
2. A hard cut to black with a 500 ms sting of our own: ffmpeg makes it from a formula (`STING` in tools/trailer.mjs),
   with no other tool or sample. Then the card "Patch 2.0", with line 1b over it, until 1b ends plus 0.3 s.
3. v2.0 from its first drawn frame, sped up for the length of line 3. The factor is the largest step of 0.05x that
   keeps the part at least as long as the line, and it shows in the corner. The counter runs.
4. Real time from 4 s before the cabinet is reached (its door shows): line 4, Enter, the inner apple, Warden Snek's
   line and THE END, until 1 s after THE END. Line 4 must end 0.3 s before Snek starts.
5. A freeze on THE END with line 5, as long as line 5 plus 300 ms (prompt 22). Then the file ends.

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
The trailer's 500 ms sting is not generated by any AI tool: ffmpeg makes it from a sine formula (tools/trailer.mjs,
`STING`).
