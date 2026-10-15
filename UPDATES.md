# AAA Snake: the update plan

**Status: approved and frozen on 2026-10-14** (PROMPTS.md #2), with three changes to the proposal: the hero is
Warden Snek, not Commander Snek; v1.2's patch comes only from the game's own origin; v1.5 keeps its note that control
share may go up. Any later change to this file is a new, logged decision.

Logged changes since the freeze: a bot rule for v1.4's terms of service (2026-10-14, PROMPTS.md #5); the keys of
v1.6's skill-tree rule (2026-10-15, PROMPTS.md #7); what "seen" and "nearest" mean in v1.7's search rule (2026-10-15,
PROMPTS.md #8); v1.7's skins and their drop odds (2026-10-15, PROMPTS.md #9); v2.0's cabinet, its bot rule and the
ending (2026-10-15, PROMPTS.md #14 and #15).

Every update keeps everything before it (v1.4 still has the logos of v1.1), so the costs pile up the way they do in
real games. Each one becomes a 30-second short; the long video comes last.

## The order at a glance

| Version | Cliché | Graphics step | Generated art / voice | If time runs out |
|---|---|---|---|---|
| v1.0 | (the honest original) | plain squares | none | — |
| v1.1 | Studio logos and an unskippable intro | smooth movement, a snake with eyes | none | keep |
| v1.2 | Day-one patch and a loading screen | textured grass field, soft shadows | none | can skip (merge into v1.1) |
| v1.3 | Story mode: Warden Snek, voiced cutscenes, a finishing move | lighting: a light around the head, letterbox | voice | keep |
| v1.4 | Always online (local stub) | UI chrome: toasts, spinners, currency bar | none | can skip |
| v1.5 | Open world: hundreds of map markers, one apple | big world with culling, cloud shadows, minimap | none | keep |
| v1.6 | Progression: XP, levels, "Turn left" is a skill | particles and glow | none | keep |
| v1.7 | Season 1 battle pass and loot boxes (parody) | loot box opening: light rays, particles | none | keep |
| v1.8 | **Viewers' choice (open slot)** | decided with the feature | decided with the feature | optional by nature |
| v1.9 | Remastered edition | the one WebGL post-processing pass | optional key art (image) | can merge into v2.0 |
| v2.0 | Game of the Year Edition: an arcade cabinet that runs v1.0 | the cabinet screen through the same pass | none | keep (it is the ending) |

## What changed from the starting ideas, and why

- **All nine starting ideas are kept.** Two additions are folded into existing updates, not new slots: a quick-time
  event to eat the apple (in v1.3, the story update, where "cinematic" belongs) and a loading screen with tips (in v1.2).
- **The order follows a player's day one.** Launch (logos), then the patch you must download before playing, then the
  story, then the servers, then the world and its systems, then the money, then the re-release. Each step reuses the
  one before: the XP of v1.6 feeds the battle pass of v1.7; the remaster of v1.9 makes the arcade cabinet of v2.0 glow.
- **The day-one patch is real.** v1.2 really downloads a file from its own server (the code of its own new features)
  and the progress bar shows the real bytes. Only the speed is fake: the download is throttled on purpose, and the
  throttle is in the code for anyone to read. No invented "48 GB".
- **The battle pass hides the apple only beyond a short vision radius**, not completely. In a large open world a fully
  invisible apple would take hours to find; the rig could not measure it in 5 runs. A small radius keeps the joke
  ("the ability to see the apple" is the top reward) and keeps the number measurable.
- **The arcade cabinet is the ending because it can bend the chart.** In v2.0 the quickest apple in the whole game is
  the one inside the cabinet, in v1.0. If the rig agrees, time to first apple goes down for the first time in the
  series. That is a result, not a promise: we report what it measures.
- **Not repeated from "Triple-A Minesweeper":** no paint marking where to climb, no hero who keeps repeating his task.
  Warden Snek speaks in cutscenes, never as a nagging reminder during play.

## Rules every update follows

- **The bot's rules do not change to suit an update.** It acts only on drawn screens, presses the key a screen offers
  to leave it (skip, continue, close, accept) as soon as it is offered, takes a shortest path to an apple it can see,
  never buys anything, and acts only through key presses. Where an update needs a new rule (searching for an apple it
  cannot see, in v1.7), the rule is written down here before that update is measured.
- **Screen names are honest.** Only `ready` and `play` count as control, and only while arrow keys really steer the
  snake. A cutscene, popup, menu, loading screen or level-up screen gets its own name.
- **The probe shows only what the player can see.** If the apple is hidden on screen, it is hidden from the bot.
- **Parody:** every purchase screen carries a visible "PARODY" label; nothing can be bought; no payment code, no
  network requests for them. The game may load files only from its own origin (the same host as the game); the rig
  fails a version with any request to another host. Invented studio names only, checked against a web search before
  use.
- **Patch notes carry no numbers** unless the number comes from the game itself.
- **Metrics below are expected directions, not numbers.** The numbers come from `npm run measure` after each build.

---

## v1.0 — Snake

The honest original: a 20 × 20 grid, arrow keys or WASD, apples, growing, game over, score, restart. Plain squares.

- **Patch note:** "Snake. Eat apples, grow, don't hit anything."

## v1.1 — Launch experience

- **Cliché:** studio logos you cannot skip, a health and safety warning, "Press any key", an autosave notice.
- **What changes:** before the board, three invented studio logos, each animated and unskippable; a photosensitivity
  warning that can be dismissed only after a few seconds; a title screen that says "Press any key" but only starts
  listening once its title animation has finished; an "autosave: do not turn off your computer"
  notice before every game, including after a game over.
- **Metrics:** time to first apple up by the length of the logos and warning; load time (first frame that accepts
  input) jumps, because the logos accept nothing; control share down, and down again at every restart because of the
  autosave notice; code and bytes up a little; frame rate unchanged.
- **Patch note:** "We've added a premium launch experience so every session starts with the right expectations."
- **Generated art / voice:** none. The logos are drawn in code.
- **Graphics (budget):** smooth movement (the snake glides between cells instead of jumping; the rules still move it
  one cell per tick), and a head with eyes that look where it is going. 2D canvas only.

## v1.2 — Day-one patch

- **Cliché:** the patch you must download before you can play the thing you just got, then a loading screen with tips.
- **What changes:** on start, "A required update is available". The game downloads its patch from its own origin, the
  same host that served the game, and from nowhere else (a real file: the code of this update's new features), with a
  progress bar showing the real bytes, throttled on purpose. The rig fails the version if any request goes to another
  host.
  Then "Installing", then "Preparing your experience", then a loading screen with gameplay tips ("Tip: apples are food")
  that ends with "Press any key to continue". Patch notes scroll by on the side, and they are this file's patch notes.
- **Metrics:** download bytes up (the patch is real); load time and time to first apple up by the throttled download
  and the loading screen; control share down; frame rate unchanged.
- **Patch note:** "A day-one patch is now required to enjoy the day-one experience."
- **Generated art / voice:** none.
- **Graphics (budget):** a textured grass field (generated in code from the seed, drawn once into an offscreen canvas)
  and soft shadows under the snake and the apple.
- **If time runs out:** can be skipped by moving the patch screen into v1.1.

## v1.3 — Story mode: Warden Snek

- **Cliché:** the gritty hero with a tragic backstory, voiced cutscenes, and the cinematic quick-time event.
- **What changes:** the snake becomes Warden Snek, a retired orchard warden: the apples were taken,
  the orchard is gone, and only Snek remembers. An opening cutscene, voiced, skippable only "after your first
  playthrough" (every run is a first playthrough). After each apple, a short cutscene where Snek reflects on what that
  apple meant. Eating an apple becomes a finishing move: when the head reaches the apple, the game slows down and asks
  for a key press ("Press E to eat"); the apple counts once the animation ends. On screen, Snek is still a few squares,
  shot in close-up.
  Guardrails so Snek imitates no known character: no bandana, no eyepatch, no cardboard box, no radio calls, no stealth,
  no military code name; his voice is not modelled on any actor's.
- **Metrics:** time to first apple up by the opening cutscene and the finishing move; control share down sharply (a
  cutscene after every apple); asset bytes and download bytes up for the first time (the voice lines are the first
  real asset files); JS heap up (decoded audio is outside the JS heap, so the JS heap may move less than the download).
- **Patch note:** "Warden Snek's story is now fully voiced, and every apple is now a cinematic moment."
- **Generated art / voice:** voice: yes (every line logged with tool name and version as shown in its UI, date and
  exact prompt). Art: none; the cutscenes are staged with the game's own squares.
- **Graphics (budget):** lighting: the field goes dark, a soft light follows Snek's head, the apple glows; cutscenes
  get letterbox bars. Still 2D canvas.

## v1.4 — Always online

- **Cliché:** a single-player game that needs a connection, an account and a fresh terms-of-service agreement.
- **What changes:** "Connecting to SnakeNet..." (a local stub: no network request is made, and the rig checks it); a
  sign-in screen with a pre-filled guest account; a server queue that counts down your position (the count is the
  game's own, from the seed); an updated terms-of-service window you must scroll to the bottom before "Accept" lights
  up; during play, at times set by the seed, "Connection interrupted. Reconnecting..." pauses the game.
- **Metrics:** time to first apple and load time up; control share down, also during play (the reconnect pauses);
  external requests stay at zero, checked.
- **Bot rule (logged change, 2026-10-14, PROMPTS.md #5, written before v1.4 was measured):** the terms of service
  must be scrolled to the bottom before "Accept" can be pressed. Until then the screen offers its scroll key (Page
  Down), then Enter. The bot presses the key a screen offers, as on every screen, at most once every 250 ms on the same
  screen; it does not use the mouse wheel. Nothing else in the bot changes.
- **Patch note:** "Always-online connectivity keeps you close to the Snake community, even when you'd rather play."
- **Generated art / voice:** none.
- **Graphics (budget):** UI chrome: a top bar with an online indicator and a currency counter, toast notifications,
  animated spinners. Canvas or DOM, no new rendering tech.
- **If time runs out:** can be skipped; its reconnect popup could move into v1.2.

## v1.5 — Open world

- **Cliché:** the huge map covered in icons, with nothing in it that matters.
- **What changes:** the board becomes a large world (the camera follows Snek), with hundreds of map markers: question
  marks, viewpoints, camps, chests that contain nothing, collectibles that count up to a total. A minimap and a full
  world map (its own screen). Still exactly one apple, placed far away by the seed; a quest marker points to it. Fast
  travel "coming in a future update". The rules stay: one cell per tick.
- **Metrics:** time to first apple up by the travel distance; control share likely **up** (walking across an empty
  world is control), which is the honest twist: by our proxy it is "more of a game" than v1.3. If it happens, the video
  says so: it is what our pre-registered proxy measures. Memory up (world
  tiles); frame rate is the risk (a big world must be culled to what is on screen).
- **Patch note:** "The world is now bigger than ever. The apple is the same size as before."
- **Generated art / voice:** none; terrain, markers and props are generated in code from the seed.
- **Graphics (budget):** a big textured world drawn in tiles, only the visible ones each frame; shadows from trees and
  rocks; slow cloud shadows drifting over the ground; a minimap. 2D canvas.

## v1.6 — Progression

- **Cliché:** XP, level-ups, and a skill tree that sells you back things the game used to do.
- **What changes:** Snek earns XP for moving and eating. "Turn left" (turning counter-clockwise) is a skill unlocked at
  level 5; until then only right turns work, so going left means three rights, and a locked turn shows "Skill locked:
  Turn left (requires level 5)". Every level-up stops the game for a full-screen "LEVEL UP!" and a skill tree screen
  where the next skill must be chosen before play resumes. The bot spends points on "Turn left" first (the fastest path),
  then on whatever comes first in the list.
- **Metrics:** time to first apple up (right-turn-only paths are longer); control share down (level-up screens and the
  skill tree); code up. The bot's path search respects the turns the probe says are allowed.
- **Bot rule, keys (logged change, 2026-10-15, PROMPTS.md #7, written before v1.6 was measured):** the rule above,
  in key presses. The skill tree lists the skills top to bottom; Up and Down move a cursor, Enter learns the skill
  under it (the screen offers Enter, probe `next`, when that skill can be learned). The bot presses Down or Up toward
  "Turn left" if it can be learned, otherwise toward the first skill in the list that can, then Enter; if none can,
  it presses what the screen offers to go on. At most one key every 250 ms on the same screen, as on every screen.
  Its path search uses only the turns in the probe's `allowedTurns`.
- **Patch note:** "Turning left is now a skill. Progression is now a feature."
- **Generated art / voice:** none.
- **Graphics (budget):** particles on level-up, a glowing XP bar, a skill tree with animated links. 2D canvas.

## v1.7 — Season 1 (parody battle pass and loot boxes)

- **Cliché:** the battle pass, the premium currency, the loot box, the "free" tier.
- **What changes:** the apple is visible only within a small vision radius around Snek. The top reward of the Season 1
  battle pass is "Apple Vision: the ability to see the apple". Tiers fill from XP, or "can be bought" with a premium
  currency that cannot be bought: the purchase button opens a screen labelled PARODY that says nothing is for sale. A
  loot box after every game over, with an opening animation; it only ever contains cosmetics. No payment code, no
  network, no prices.
  New bot rule, fixed now, before measuring: when no apple is visible, the bot goes to the nearest cell it has not yet
  seen (ties broken by a fixed order), until an apple comes into view.
- **Search rule, details (logged change, 2026-10-15, PROMPTS.md #8, written before v1.7 was measured):** the probe
  gives the vision radius (`vision`, in cells) and reports the apple only inside it. A cell counts as seen once it has
  been within that radius of a cell the head has been on (every cell of the body, each time the bot looks), since the
  apple it is looking for appeared: a new apple (the score changes) or a new game starts the memory again. "Nearest"
  is in moves, using only the turns the probe allows; of equally near cells the bot takes the first its search
  reaches, trying straight, then right, then left from each state. Nothing else in the bot changes; it never buys.
- **Skins and odds (logged change, 2026-10-15, PROMPTS.md #9, written before building):** the loot boxes hold 10
  skins, drawn in code, that change only how the snake is drawn. Odds per box: Common 60 %, Rare 25 %, Epic 12 %,
  Legendary 3 %; within a rarity every skin is equally likely. Common: Moss, Sand, Slate, Plum. Rare: Tiger, Frost,
  Ember. Epic: Neon, Galaxy. Legendary: Classic Green, the v1.0 snake. Drops come from the seed (their own generator).
  After every loot box a wardrobe screen shows the new skin and the collection; it waits for a key (Enter).
- **Metrics:** time to first apple up sharply (search instead of a straight line); control share down (battle pass
  screen at every tier, loot box at every game over); code and bytes up.
- **Patch note:** "Season 1 is here! Unlock exclusive rewards, including the ability to see the apple."
- **Generated art / voice:** none.
- **Graphics (budget):** the loot box opening: light rays, sparkles, a glow; the battle pass track with tier cards.
  2D canvas.

## v1.8 — Viewers' choice (open slot)

- **Open slot for a feature chosen by viewers in the comments.** Nothing is decided here on purpose.
- **Where it goes:** v1.8 is proposed so the question can be asked in the shorts for v1.5 to v1.7 and the answers are
  in before it is built. It could also go anywhere after v1.3; earlier than that, there is too little game to bloat.
- **How it is chosen:** the most-liked suggestion that fits the rules (parody only, within the performance budget, no
  real game or studio names, and no repeat of an earlier update). If the comments need a nudge, a short list to offer:
  a crafting system (craft the apple from seeds, water and a workbench), stamina, photo mode, a talking companion,
  item durability (Snek's teeth wear out).
- **Metrics, patch note, art, graphics:** written here once the feature is chosen, before it is built.

## v1.9 — Remastered

- **Cliché:** the remaster: the same game, with cinematic effects, sold again.
- **What changes:** an "Upgrade to Remastered" screen (PARODY, nothing to pay), then the same game through the one
  allowed WebGL post-processing pass: bloom, vignette, film grain, chromatic aberration at the edges, a color grade, and
  motion blur on a snake that moves one cell at a time. A graphics settings menu where every preset is called "Ultra".
  Gameplay unchanged.
- **Metrics:** frame rate is the one to watch (the pass runs at full Retina resolution unless it has to drop to a lower
  internal resolution to stay in budget); download and asset bytes up if key art is added; control share and time to
  first apple barely move (the remaster changes the look, not the game).
- **Patch note:** "Remastered from the ground up with cinematic visuals. Gameplay faithfully preserved."
- **Generated art / voice:** optional: one key-art image for the title screen (logged with tool, version, date, prompt).
- **Graphics (budget):** the peak: 2D canvas plus the single WebGL post-processing pass, no more. No "slow on purpose"
  mode: it must pass the normal budget (median at least 50 fps, 5th percentile at least 30 fps).
- **If time runs out:** can merge into v2.0.

## v2.0 — Game of the Year Edition

- **Cliché:** the complete edition: everything bundled, plus a museum piece.
- **What changes:** all previous content, plus an arcade cabinet in the world near the start. Its screen runs dist/v1.0
  unmodified. Walking up to it and pressing a key enters it; inside, the arrow keys steer v1.0's snake (a control
  screen), and an apple eaten inside counts as an apple. Fixed now, before measuring: the cabinet's apple is visible to
  the bot (it is on screen), so the bot will go for whichever apple it can reach sooner.
- **Cabinet, ending and bot rule (logged change, 2026-10-15, PROMPTS.md #14 and #15, written before v2.0 was
  measured):** the cabinet stands on cell (134, 128), six cells ahead of the start. The probe reports it (`cabinet`)
  while it is on screen. The bot goes for whichever apple it can reach in fewer moves: the world apple by its shortest
  path (allowed turns), or the cabinet, by the shortest path to its cell plus 3 moves inside (v1.0's first apple, seed
  1). Reaching the cabinet's cell opens the `cabinet-door` screen, which offers Enter at once; the bot presses it.
  Inside, the screen is `cabinet`, a control screen (arrow keys steer v1.0's snake), and the probe is v1.0's own; the
  bot plays it with the v1.0 rule (no turn limits). The cabinet runs dist/v1.0's files, taken from the v1.0 tag at
  build time. After the inner apple the game ends: the reflection after an apple, THE END, then the credits (the
  disclosure: who did what), and nothing after them.
- **Metrics:** time to first apple may go **down** for the first time, if the cabinet's apple is quicker to reach than
  the world's; everything else stays at its peak (it is the heaviest build).
- **Patch note:** "Game of the Year Edition: includes all content, plus the original game, which some players prefer."
- **Generated art / voice:** none.
- **Graphics (budget):** no new technique: the cabinet screen goes through the same post-processing pass, which makes
  it look like a CRT.
