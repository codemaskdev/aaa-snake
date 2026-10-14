// `npm run voice`: the voice lines of the story, from src/story.js.
//   npm run voice            writes voice/LINES.md and a silent placeholder for every line
//                            that has no recording yet (src/voice/NN.mp3, as close to one slot as MP3 frames allow)
//   npm run voice -- --check lists every file's length against its slot (a recording must fit)
// Placeholders are silence, MP3 44.1 kHz mono at 64 kbps constant bitrate, the format the
// recordings will be delivered in, so the bytes the game downloads stay about the same.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const VOICE_DIR = path.join(ROOT, 'src/voice');

export function loadStory(file = path.join(ROOT, 'src/story.js')) {
  const code = fs.readFileSync(file, 'utf8');
  return vm.runInContext(`${code}\n;({ LINES, SPEAKING_RATE, LINE_PAUSE, slotMs })`, vm.createContext({}));
}

export const fileFor = line => `${String(line.id).padStart(2, '0')}.mp3`;

export function durationMs(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  return Number(out.trim()) * 1000;
}

export const ELEVENLABS = {
  tool: 'ElevenLabs (web app), Text to Speech',
  model: 'Eleven v3 (eleven_v3)',
  voice: 'one voice made with Voice Design from the description below; not a library voice and not a clone of anyone',
  voiceDesign: 'An old man in his seventies, a retired orchard warden. Low, warm, slightly gravelly voice. Slow and tired, with a gentle, dry sense of humour. Neutral English accent. Quiet, as if remembering. Not theatrical, not military, not an impression of any actor or character.',
  stability: 'Natural (0.5)',
  language: 'English',
  output: 'MP3, 44.1 kHz, 64 kbps (mp3_44100_64)',
  text: 'the line exactly as written below, with its emotion as an audio tag in front, e.g. "[weary] There was an orchard here once."',
};

export function linesMarkdown(story) {
  const { LINES, SPEAKING_RATE, LINE_PAUSE, slotMs } = story;
  const rows = LINES.map(line => `| ${line.id} | ${line.scene} | ${line.emotion} | ${line.text} | ${(slotMs(line) / 1000).toFixed(1)} | src/voice/${fileFor(line)} |`);
  return `# Warden Snek: voice lines (v1.3)

Generated from src/story.js by \`npm run voice\`; edit the lines there, not here.

Warden Snek is a retired orchard warden. The lines imitate no known character: no stealth, no radio calls, no code
names, no catchphrases from any game; the voice is not modelled on any actor (UPDATES.md, v1.3 guardrails).

**Status: not recorded.** Every file in src/voice/ is a silent placeholder as long as its slot as MP3 frames allow
(never longer), so the build and the rig work. A slot is the line's words at ${SPEAKING_RATE} words per second, rounded to 0.1 s, plus ${LINE_PAUSE / 1000} s;
the game shows each line for its slot whether or not the sound plays, so a recording that fits its slot does not
change any timing. Check with \`npm run voice -- --check\`.

## Recording settings

- Tool: ${ELEVENLABS.tool}
- Model: ${ELEVENLABS.model}
- Voice: ${ELEVENLABS.voice}
- Voice Design description: "${ELEVENLABS.voiceDesign}"
- Stability: ${ELEVENLABS.stability}
- Language: ${ELEVENLABS.language}
- Output format: ${ELEVENLABS.output}
- Text: ${ELEVENLABS.text}
- Save each take as the file in the last column, replacing the placeholder.

## Disclosure (fill in when recording)

| Date | Tool and version as shown in its UI | Exact prompt (Voice Design description, and each line's text) |
|---|---|---|
| | | |

## Lines

| # | Scene | Emotion | Line | Slot (s) | File |
|---|---|---|---|---|---|
${rows.join('\n')}
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const story = loadStory();
  if (process.argv.includes('--check')) {
    let bad = 0;
    for (const line of story.LINES) {
      const file = path.join(VOICE_DIR, fileFor(line));
      const ms = fs.existsSync(file) ? durationMs(file) : null;
      const fits = ms !== null && ms <= story.slotMs(line);
      if (!fits) bad++;
      console.log(`${fileFor(line)}  slot ${story.slotMs(line)} ms  file ${ms === null ? 'missing' : `${ms} ms`}  ${fits ? 'fits' : 'DOES NOT FIT'}`);
    }
    process.exitCode = bad ? 1 : 0;
  } else {
    fs.mkdirSync(VOICE_DIR, { recursive: true });
    fs.mkdirSync(path.join(ROOT, 'voice'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'voice/LINES.md'), linesMarkdown(story));
    let made = 0;
    for (const line of story.LINES) {
      const file = path.join(VOICE_DIR, fileFor(line));
      if (fs.existsSync(file)) continue; // never overwrite a recording
      // MP3 pads the end to whole frames, so ask for a little less until the file fits its slot.
      for (let ask = story.slotMs(line); ; ask -= 10) {
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', String(ask / 1000),
          '-c:a', 'libmp3lame', '-b:a', '64k', '-write_xing', '0', file]);
        if (durationMs(file) <= story.slotMs(line)) break;
      }
      made++;
    }
    console.log(`wrote voice/LINES.md; ${made} silent placeholder(s) in src/voice/`);
  }
}
