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
npm run fps-check           # headless vs visible window frame rate, on test loads
npm run chart               # measurements/summary.csv -> out/bloat.png
npm run short <version>     # 30-second vertical short -> out/shorts/<version>/
npm run voice               # voice/LINES.md, placeholders, and src/voice/ copied into every build
npm run voice -- --check    # every voice line against its slot, and every build against src/voice/
npm run voice -- --record   # record the 17 lines with the ElevenLabs API (needs ELEVENLABS_API_KEY in the environment)
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
- Numbers are written as measured, never rounded; every run's raw data is kept under measurements/<version>/.

## Shorts

`npm run short <version>` replays the version's median measured run on a virtual clock into a 1080 x 1920 video,
25 to 30 s. v1.0 has its own plan; every later version follows one fixed plan:

- **A** (3 s): the previous version reaches its first apple at real speed. No voice.
- **B** (3 s): the new version's patch note.
- **C**: the new version from launch to 2 s before its first apple, sped up: 16 s of clip at the largest step of
  0.05x that does not make it shorter, 4x while that fits in 21 s, faster only beyond; and faster again, in steps of
  0.05x, if the whole short would otherwise pass 30 s. The speed shows in the patch-note card.
- **D**: the first apple at real speed, from 2 s before it until Warden Snek's line after it has been said in full
  (it starts 600 ms after the apple); for a version without voice lines, until 1 s after the apple.

The sound track is silence except that line in D, from the moment the replay starts it, at its recorded length.

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
