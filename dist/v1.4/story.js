// AAA Snake v1.3: story mode. Warden Snek, a retired orchard warden.
// An opening cutscene, a finishing move for every apple, and a short cutscene after it.
// Every line is voiced (voice/LINES.md lists them; until they are recorded, each file
// is silence of the line's length). Times are in ms of animation frames, never the clock.

// Each line gets a slot: its words at SPEAKING_RATE, rounded to 100 ms, plus LINE_PAUSE.
// The silent placeholders are exactly one slot long; a recording must fit inside its slot.
const SPEAKING_RATE = 2.5; // words per second
const LINE_PAUSE = 800;    // ms after each line
const LETTERBOX_MS = 600;  // bars slide in, and out, around every cutscene

const LINES = [
  { id: 1, scene: 'Opening: the dark field', emotion: 'weary', text: 'There was an orchard here once.' },
  { id: 2, scene: 'Opening: the dark field', emotion: 'wistful', text: 'Rows and rows of trees, every one of them heavy with apples.' },
  { id: 3, scene: 'Opening: the dark field', emotion: 'proud', text: 'I was its warden. I knew every tree by name.' },
  { id: 4, scene: 'Opening: the dark field', emotion: 'bitter', text: 'Then they came. They took the apples. All of them.' },
  { id: 5, scene: 'Opening: the dark field', emotion: 'grim', text: 'They took the trees. They took the fence.' },
  { id: 6, scene: 'Opening: the dark field', emotion: 'deadpan', text: 'They even took the little sign that said Orchard.' },
  { id: 7, scene: 'Opening: the dark field', emotion: 'hollow', text: 'Now there is only this field. And it is very dark.' },
  { id: 8, scene: 'Opening: the dark field', emotion: 'hopeful', text: 'But somewhere out there, there is one apple left.' },
  { id: 9, scene: 'Opening: the dark field', emotion: 'resolute', text: 'I am retired. I am three squares long. I am going to get it.' },
  { id: 10, scene: 'After an apple', emotion: 'quiet', text: 'One apple. Not the orchard. But it is a start.' },
  { id: 11, scene: 'After an apple', emotion: 'nostalgic', text: 'It tastes like the old days. Crisp. A little sour.' },
  { id: 12, scene: 'After an apple', emotion: 'rueful', text: 'I used to count them. Now I just eat them.' },
  { id: 13, scene: 'After an apple', emotion: 'defiant', text: 'They can take the trees. They cannot take the taste.' },
  { id: 14, scene: 'After an apple', emotion: 'dry', text: 'I am getting longer. That is either growth or regret.' },
  { id: 15, scene: 'After an apple', emotion: 'tender', text: 'Somewhere, a tree is proud of me.' },
  { id: 16, scene: 'After an apple', emotion: 'solemn', text: 'Another one. The orchard remembers.' },
  { id: 17, scene: 'After an apple', emotion: 'tired', text: 'My back hurts. I do not have a back. It still hurts.' },
];
const OPENING = LINES.filter(line => line.scene.startsWith('Opening'));
const REFLECTIONS = LINES.filter(line => line.scene.startsWith('After'));

// The finishing move: the game slows down, asks for E, then the bite.
const FINISHER = { slowMs: 800, biteMs: 1500, key: 'KeyE' };

function slotMs(line) {
  const words = line.text.split(/\s+/).length;
  return Math.round((words / SPEAKING_RATE) * 10) * 100 + LINE_PAUSE;
}

function cutsceneMs(lines) {
  return lines.reduce((sum, line) => sum + slotMs(line), 2 * LETTERBOX_MS);
}

// The line on screen at `time` into a cutscene of these lines, or null between them.
function lineAt(lines, time) {
  let start = LETTERBOX_MS;
  for (const line of lines) {
    if (time >= start && time < start + slotMs(line)) return line;
    start += slotMs(line);
  }
  return null;
}

// How far the letterbox bars are in, 0 to 1.
function letterbox(lines, time) {
  const total = cutsceneMs(lines);
  return Math.max(0, Math.min(1, time / LETTERBOX_MS, (total - time) / LETTERBOX_MS));
}

// The voice pack: every line, downloaded once on the loading screen.
const voice = { urls: {}, loaded: 0, bytes: 0, started: false, spoken: null };

function loadVoice() {
  voice.started = true;
  for (const line of LINES) {
    fetch(`voice/${String(line.id).padStart(2, '0')}.mp3`, { cache: 'no-store' })
      .then(response => response.blob())
      .then(blob => {
        voice.urls[line.id] = URL.createObjectURL(blob);
        voice.bytes += blob.size;
        voice.loaded++;
      });
  }
}

function voiceLoaded() {
  return voice.loaded === LINES.length;
}

// Play a line once, when it comes on. The game never waits for the sound: each line has
// its slot, whether the browser lets the audio play or not.
function speak(line) {
  if (!line || voice.spoken === line || !voice.urls[line.id]) return;
  voice.spoken = line;
  new Audio(voice.urls[line.id]).play().catch(() => {});
}

function drawLetterbox(ctx, amount, width, height) {
  const bar = 70 * amount;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, bar);
  ctx.fillRect(0, height - bar, width, bar);
}

function drawSubtitle(ctx, line, width, height) {
  if (!line) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 12px Helvetica, Arial, sans-serif';
  ctx.fillText('WARDEN SNEK', width / 2, height - 52);
  ctx.fillStyle = '#fff';
  ctx.font = '15px Helvetica, Arial, sans-serif';
  wrapText(ctx, line.text, width / 2, height - 32, width - 60, 18);
  ctx.restore();
}
