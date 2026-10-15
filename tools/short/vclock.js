// A virtual clock for the game inside the short's layout (the iframe only).
// The game's clock (performance.now, Date.now, requestAnimationFrame, timers)
// stands still until the recorder moves it, so every video frame shows the game
// exactly at its time, however long a screenshot takes.
// Animation frames come on a fixed 60 Hz grid of virtual time. The recorded key
// presses of a measured run are replayed at their recorded times, each on the screen
// and tick where it was pressed.
(() => {
  if (window.top === window) return;
  const FRAME = 1000 / 60;
  const EPOCH = Date.UTC(2026, 0, 1);
  let now = 0;
  let frameIndex = 0;
  let nextId = 1;
  let rafs = [];
  let timers = [];
  let keys = [];
  let keyIndex = 0;

  performance.now = () => now;
  Date.now = () => EPOCH + now;
  window.requestAnimationFrame = cb => {
    const id = nextId++;
    rafs.push({ id, cb });
    return id;
  };
  window.cancelAnimationFrame = id => { rafs = rafs.filter(r => r.id !== id); };
  const addTimer = (cb, ms, args, every) => {
    const id = nextId++;
    timers.push({ id, at: now + Math.max(0, Number(ms) || 0), cb, args, every });
    return id;
  };
  window.setTimeout = (cb, ms, ...args) => addTimer(cb, ms, args, null);
  window.setInterval = (cb, ms, ...args) => addTimer(cb, ms, args, Math.max(1, Number(ms) || 0));
  window.clearTimeout = window.clearInterval = id => { timers = timers.filter(t => t.id !== id); };

  // Sound: when the game starts a sound (Warden Snek's lines, since v1.3), the recorder notes what and
  // when, in virtual time, and puts it on the short's audio track itself. Nothing plays in the page.
  const plays = [];
  HTMLMediaElement.prototype.play = function play() {
    plays.push({ src: this.src, t: now });
    return Promise.resolve();
  };

  function runTimersUntil(t) {
    for (;;) {
      const due = timers.filter(x => x.at <= t).sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!due) return;
      now = Math.max(now, due.at);
      if (due.every) due.at += due.every;
      else timers = timers.filter(x => x !== due);
      if (typeof due.cb === 'function') due.cb(...due.args);
    }
  }

  // A recorded key is pressed at its recorded time, but never before the game is on the
  // screen (and, in play, at the tick) where the bot pressed it. Frame timing in the
  // replay can differ by a few ms from the run, and a key on the wrong screen is lost.
  // A key pressed in play is replayed by its tick alone (since prompt 13): a run whose game
  // lost time to a long frame (the game counts at most 250 ms a frame) has its later keys
  // recorded late against the game's ticks, and replayed by time they would land a tick late.
  function byTick(k) {
    return k.screen === 'play' && k.tick != null;
  }
  function ready(k) {
    const game = window.snakeGame && window.snakeGame.probe();
    if (!game || k.screen == null) return true;
    return game.screen === k.screen && (k.tick == null || game.tick >= k.tick);
  }

  function pressKeysUntil(t) {
    while (keyIndex < keys.length && (keys[keyIndex].t <= t || byTick(keys[keyIndex])) && ready(keys[keyIndex])) {
      const k = keys[keyIndex++];
      runTimersUntil(Math.max(now, Math.min(k.t, t)));
      now = Math.max(now, Math.min(k.t, t));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: k.code, key: k.code, bubbles: true, cancelable: true }));
    }
  }

  window.__vclock = {
    now: () => now,
    plays: () => plays.slice(),
    replay(list) {
      keys = list.slice().sort((a, b) => a.t - b.t);
      keyIndex = 0;
    },
    // Move virtual time forward to t, one 60 Hz animation frame at a time.
    advanceTo(t) {
      while ((frameIndex + 1) * FRAME <= t) {
        const frameTime = ++frameIndex * FRAME;
        pressKeysUntil(frameTime);
        runTimersUntil(frameTime);
        now = frameTime;
        const due = rafs;
        rafs = [];
        for (const r of due) r.cb(now);
      }
      pressKeysUntil(t);
      runTimersUntil(t);
      now = Math.max(now, t);
    },
  };
})();
