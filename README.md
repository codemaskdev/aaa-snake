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
npm run measure <version>   # 5 measured runs -> measurements/<version>.json, summary.csv
npm run fps-check           # headless vs visible window frame rate, on test loads
npm run chart               # measurements/summary.csv -> out/bloat.png
npm run short <version>     # 30-second vertical short -> out/shorts/<version>/
```

`npm run measure` opens visible Chromium windows for its frame-rate runs.

## Files

- `src/` the game being worked on; `dist/` every released version.
- `tools/` the build, the measuring rig (`tools/rig/`), the chart and the short recorder.
- `measurements/` every measurement, raw runs included.
- `UPDATES.md` the plan for the updates. `PROMPTS.md` every prompt, verbatim. `DEVLOG.md` what happened.

Purchases, currencies and loot boxes in later versions are parody: nothing is sold and nothing goes over the network.
