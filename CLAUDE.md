# AAA Snake: rules for this project

## What it is
The project for the CodeMask episode "How I Turned Snake Into a AAA Game with Claude Code". It starts from a tiny,
honest Snake (v1.0) and ships a series of updates. Each update adds one cliché of big-budget games, and after each one
we measure how much heavier and slower the game got and how long it now takes to reach the first apple. Every update
becomes a 30-second vertical short; the long video comes last. The git history, PROMPTS.md, DEVLOG.md and
measurements/ are the raw material for the video.

## Tech
- Browser game. v1.0 is plain HTML, JS and canvas: classic scripts (they also open from file://), no build step, no
  dependencies. Later updates may add tooling only when the update needs it.
- Every dependency is pinned to an exact version in package.json and logged in DEVLOG.md with the reason it was added.
  Today: playwright 1.63.0 (dev only: the measuring rig, the chart and the short recorder). ffmpeg is a system tool
  (not pinned by npm); the recorder writes its version into each clip.json.
- Node 22 or newer for the tools (`npm test`, `npm run measure`, ...).

## Performance budget
- The target machine is my MacBook with an Apple M1 chip.
- Graphics may get fancier from update to update, but stay 2D canvas plus at most one lightweight WebGL
  post-processing pass. No 3D engines, no heavy asset packs.
- Every version must stay playable on the M1: in `npm run measure`, median frame rate at least 50 fps and 5th
  percentile at least 30 fps. The only exception is an update explicitly approved as a "this one is slow on purpose"
  joke, and even then never below 30 fps median.

## Versions
- Every update is one git tag (v1.0, v1.1, ...) and one build in dist/<version>/ (`npm run build <version>` copies
  src/ there; it refuses to overwrite an existing build). Every version stays playable side by side (`npm run serve`).
- Never rewrite an old tag. tests/build.test.mjs checks that each tagged build in dist/ still matches its tag.
- The VERSION constant in src/game.js names the version being built.
- UPDATES.md is the plan. Once approved it is frozen; changes to it after that are new, logged decisions.

## Determinism
- No Math.random and no wall-clock time in game state. One seeded generator (makeRandom in src/rules.js); the seed
  comes from `?seed=N` (default 1). Same seed and same inputs give the same game.
- The snake moves on a fixed tick (TICK_MS). The clock only decides when a tick happens, never what happens in it.
- The only clock reads in the game are in report() in src/game.js, which logs events for the measuring bot. The game
  never reads that log. tests/determinism.test.mjs checks all of this.

## The probe (what the measuring bot sees)
Every version exposes `window.snakeGame = { version, log, probe() }`:
- `log`: events the game pushes, each with `t` = performance.now() (ms since navigation start):
  `{type: 'screen', name}` when the screen changes, `{type: 'frame', name}` on the first drawn frame of a screen,
  `{type: 'apple', score, tick}` when an apple is eaten.
- `probe()`: `{screen, shown, next, tick, heading, snake, apple, score, grid}`. `next` is the key that leaves the current
  screen (skip, continue, restart), or null. `apple` is only what the player can see (null if hidden).
- Screen names `ready` and `play` mean "arrow keys steer the snake right now" and are the only control screens
  (tools/rig/stats.mjs, pre-registered). Never use them for a screen where input does not steer the snake. Every other
  screen gets its own honest name.
- The bot (tools/rig/bot.mjs) acts only on drawn screens, presses `next` as soon as it is offered, and on control
  screens takes a shortest path to the apple it can see. It acts only through real key presses.

## Numbers
- Only measured numbers, produced by `npm run measure <version>`, with the command and the raw output saved under
  measurements/. Never estimate. Never round in the logs (measurements, DEVLOG).
- The rig: 5 runs in Chromium's new headless mode (real GPU) for every metric but frame rate, and 5 runs in a visible
  window for frame rate (`npm run fps-check` showed why). Definitions are written into every measurements/<version>.json.
- measurements/summary.csv has one row per version; `npm run chart` draws out/bloat.png from it.
- `npm run short <version>` replays the median run into the fixed short layout; its counter shows the run's clock and
  freezes on the measured median. Clip plans live in tools/short/plans.json.

## Parody only
- Purchase buttons, loot boxes and "premium currency" are fake. No payment SDKs, no network requests for them, no real
  prices charged. Every purchase screen carries a visible "parody" label. The rig fails a version that makes an
  external request (checks.externalRequests).
- No real game, studio, brand or character names, logos or art, and no hero that imitates a known game character.

## Disclosure
- Any generated image or voice line records, next to the file (and in DEVLOG.md), the tool name and version as shown
  in its UI, the date and the exact prompt.

## Logs
- PROMPTS.md: every prompt I send, verbatim and numbered. Never edit earlier entries.
- DEVLOG.md: what was done, what broke, the real numbers, and anything surprising or funny that actually happened in
  the session, quoted as it happened. Never invent or polish it. If nothing broke, say so.

## Commits and anonymity
- Commits are authored as CodeMask (user.name CodeMask, user.email codemask@users.noreply.github.com, set in this repo's
  local git config, copied from the bug-driver repo; never the global git config). Every commit and tag with TZ=UTC:
  `TZ=UTC git commit ...`.
- No local paths, no usernames, no .DS_Store, no personal data in the repo, including measurement files (they record
  machine model, chip, RAM, OS and browser only; never serial numbers or hardware IDs).
- Never commit generated media: out/ (shorts, frames, the chart) is ignored and can be re-made.
- No remote, no push unless I ask.

## Language
- All repository text in English.
