// `npm run voice`: the voice lines of the story, from src/story.js.
//   npm run voice            writes voice/LINES.md, a silent placeholder for every line that has no
//                            recording yet (src/voice/NN.mp3, as close to one slot as MP3 frames allow),
//                            and copies src/voice/ into every build that has voice lines (dist/v*/voice/)
//   npm run voice -- --check lists every file's length against its slot (a recording must fit) and
//                            every build whose voice lines differ from src/voice/
//   npm run voice -- --record records every line with the ElevenLabs text-to-speech API (RECORDING
//                            below) into src/voice/NN.mp3, over the placeholders, and writes
//                            voice/RECORDING.json (what was asked for, when, and how long each take is).
//                            The API key comes only from the environment variable ELEVENLABS_API_KEY;
//                            it is never written anywhere. The only network calls are the 17 requests.
//   npm run voice -- --retake 14,16  up to three new takes of each listed line, same settings; the first
//                            take that fits its slot is kept, the others are deleted; every take's length
//                            goes into voice/RECORDING.json. Slots never change; audio is never sped up or cut.
// src/voice/ is the only place the lines live: every version from v1.3 on plays them from there,
// through its build. Old builds are never rebuilt, but their voice files are kept in step with it.
// Placeholders are silence, MP3 44.1 kHz mono at 64 kbps constant bitrate, the format the
// recordings will be delivered in, so the bytes the game downloads stay about the same.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const VOICE_DIR = path.join(ROOT, 'src/voice');
const DIST = path.join(ROOT, 'dist');

// Every build with a voice/ folder, and which of its files differ from src/voice/.
export function buildsOutOfStep(distDir = DIST, voiceDir = VOICE_DIR) {
  const names = fs.readdirSync(voiceDir).filter(name => name.endsWith('.mp3')).sort();
  const builds = fs.existsSync(distDir) ? fs.readdirSync(distDir).filter(v => /^v\d+\.\d+$/.test(v) && fs.existsSync(path.join(distDir, v, 'voice'))) : [];
  return builds.map(version => ({
    version,
    differ: names.filter(name => {
      const copy = path.join(distDir, version, 'voice', name);
      return !fs.existsSync(copy) || !fs.readFileSync(copy).equals(fs.readFileSync(path.join(voiceDir, name)));
    }),
  }));
}

export function syncBuilds(distDir = DIST, voiceDir = VOICE_DIR) {
  const copied = [];
  for (const { version, differ } of buildsOutOfStep(distDir, voiceDir)) {
    for (const name of differ) {
      fs.copyFileSync(path.join(voiceDir, name), path.join(distDir, version, 'voice', name));
      copied.push(`${version}/voice/${name}`);
    }
  }
  return copied;
}

export function loadStory(file = path.join(ROOT, 'src/story.js')) {
  const code = fs.readFileSync(file, 'utf8');
  return vm.runInContext(`${code}\n;({ LINES, SPEAKING_RATE, LINE_PAUSE, slotMs })`, vm.createContext({}));
}

export const fileFor = line => `${String(line.id).padStart(2, '0')}.mp3`;

export function durationMs(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  return Number(out.trim()) * 1000;
}

// How the lines are recorded (prompt 10): the author's own Voice Design voice, not a library voice, not a clone.
export const RECORDING = {
  service: 'ElevenLabs text-to-speech API (v1)',
  endpoint: 'https://api.elevenlabs.io/v1/text-to-speech',
  voiceId: 'S44KQ3oLFckbxgyKfold',
  model: 'eleven_v3',
  stability: 0.5,
  output: 'mp3_44100_64',
};
const RECORDING_FILE = path.join(ROOT, 'voice/RECORDING.json');

export function readRecording(file = RECORDING_FILE) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

// Spoken words that differ from the subtitle (src/story.js): a line whose takes would not fit its
// slot is said shorter, with the same meaning and emotion (prompt 11). The subtitle, and so the
// slot, stay as they are.
export const SPOKEN = {
  16: 'Another. The orchard remembers.', // subtitle: "Another one. The orchard remembers."; 4 takes of it ran 3520 to 3600 ms in its 2800 ms slot
};

// The text sent for a line: its emotion as an audio tag, then the words.
export const promptFor = line => `[${line.emotion}] ${SPOKEN[line.id] || line.text}`;

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

export function linesMarkdown(story, recording = readRecording()) {
  const { LINES, SPEAKING_RATE, LINE_PAUSE, slotMs } = story;
  const take = line => recording && recording.lines.find(t => t.id === line.id);
  const rows = LINES.map(line => `| ${line.id} | ${line.scene} | ${line.emotion} | ${line.text} | ${(slotMs(line) / 1000).toFixed(1)} | src/voice/${fileFor(line)} |${recording ? ` ${take(line) ? take(line).durationMs : ''} |` : ''}`);
  const status = recording
    ? `**Status: recorded on ${recording.date}** with ${recording.service}, model ${recording.model}, voice ${recording.voiceId}
(the author's own Voice Design voice, made for this project: not a library voice, not a clone of anyone), stability
${recording.stability}, output ${recording.output}, one take a line (\`npm run voice -- --record\`; voice/RECORDING.json
has every request and its result). A slot is the line's words at ${SPEAKING_RATE} words per second, rounded to 0.1 s, plus ${LINE_PAUSE / 1000} s; the game
shows each line for its slot whether or not the sound plays. Check with \`npm run voice -- --check\`.`
    : `**Status: not recorded.** Every file in src/voice/ is a silent placeholder as long as its slot as MP3 frames allow
(never longer), so the build and the rig work. A slot is the line's words at ${SPEAKING_RATE} words per second, rounded to 0.1 s, plus ${LINE_PAUSE / 1000} s;
the game shows each line for its slot whether or not the sound plays, so a recording that fits its slot does not
change any timing. Check with \`npm run voice -- --check\`.`;
  const changed = LINES.filter(line => SPOKEN[line.id]);
  const spokenSection = changed.length
    ? `## Said shorter than the subtitle

A take must fit its slot, and slots never change (they set the length of every cutscene, and so every measured number
since v1.3). When no take of a line fits, the line is said shorter, with the same meaning and emotion; the subtitle in
the game, and so the slot, stay as they are (prompt 11).

| # | Subtitle (src/story.js) | Said |
|---|---|---|
${changed.map(line => `| ${line.id} | ${line.text} | ${SPOKEN[line.id]} |`).join('\n')}

`
    : '';
  const disclosure = recording
    ? `| ${recording.date} | ${recording.service}, model ${recording.model}, voice ${recording.voiceId} (Voice Design, the author's own); no UI was used | each line's text as in the table below, with its emotion as an audio tag in front, e.g. "${promptFor(LINES[0])}"; the voice's own Voice Design prompt is the author's |`
    : '| | | |';
  return `# Warden Snek: voice lines (since v1.3)

Generated from src/story.js by \`npm run voice\`; edit the lines there, not here.

Warden Snek is a retired orchard warden. The lines imitate no known character: no stealth, no radio calls, no code
names, no catchphrases from any game; the voice is not modelled on any actor (UPDATES.md, v1.3 guardrails).

${status}

## Recording settings (written in prompt 4, before recording; prompt 10 recorded through the API instead, above)

- Tool: ${ELEVENLABS.tool}
- Model: ${ELEVENLABS.model}
- Voice: ${ELEVENLABS.voice}
- Voice Design description (proposed, not confirmed: the voice in use is the author's own, and its prompt is not recorded here yet): "${ELEVENLABS.voiceDesign}"
- Stability: ${ELEVENLABS.stability}
- Language: ${ELEVENLABS.language}
- Output format: ${ELEVENLABS.output}
- Text: ${ELEVENLABS.text}
- Save each take as the file in the last column, replacing the placeholder, then run \`npm run voice\`: it copies
  src/voice/ into every build that has voice lines (dist/v1.3/voice/, dist/v1.4/voice/ and on), so nothing else changes.

## Disclosure${recording ? '' : ' (fill in when recording)'}

| Date | Tool and version as shown in its UI | Exact prompt (Voice Design description, and each line's text) |
|---|---|---|
${disclosure}

${spokenSection}## Lines

| # | Scene | Emotion | Line | Slot (s) | File |${recording ? ' Take (ms) |' : ''}
|---|---|---|---|---|---|${recording ? '---|' : ''}
${rows.join('\n')}
`;
}

// One request to the API for one line; returns the MP3's bytes. Nothing else goes out.
async function speakLine(text) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('set ELEVENLABS_API_KEY in the environment (it is never read from or written to a file)');
  const response = await fetch(`${RECORDING.endpoint}/${RECORDING.voiceId}?output_format=${RECORDING.output}`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: RECORDING.model, voice_settings: { stability: RECORDING.stability } }),
  });
  if (!response.ok) throw new Error(`the API answered ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return Buffer.from(await response.arrayBuffer());
}

// Record every line through the API, over the placeholders. One request a line.
async function record(story) {
  const date = new Date().toISOString().slice(0, 10);
  const lines = [];
  for (const line of story.LINES) {
    const text = promptFor(line);
    const bytes = await speakLine(text);
    const file = path.join(VOICE_DIR, fileFor(line));
    fs.writeFileSync(file, bytes);
    const take = { id: line.id, file: `src/voice/${fileFor(line)}`, text, takes: 1, bytes: bytes.length, durationMs: durationMs(file), slotMs: story.slotMs(line) };
    lines.push(take);
    console.log(`${fileFor(line)}  "${text}"  ${take.durationMs} ms of a ${take.slotMs} ms slot`);
  }
  const { endpoint, ...settings } = RECORDING;
  fs.writeFileSync(RECORDING_FILE, JSON.stringify({ date, ...settings, endpoint, lines }, null, 2) + '\n');
  fs.writeFileSync(path.join(ROOT, 'voice/LINES.md'), linesMarkdown(story));
  console.log('wrote src/voice/*.mp3, voice/RECORDING.json and voice/LINES.md; now run npm run voice -- --check');
}

// New takes of some lines, up to `most` each: the first that fits its slot replaces the file;
// the others are deleted. voice/RECORDING.json keeps every take's length.
async function retake(story, ids, most = 3) {
  const recording = readRecording();
  if (!recording) throw new Error('nothing recorded yet: run npm run voice -- --record first');
  const date = new Date().toISOString().slice(0, 10);
  for (const id of ids) {
    const line = story.LINES.find(l => l.id === id);
    const entry = recording.lines.find(t => t.id === id);
    const slot = story.slotMs(line);
    entry.history = entry.history || [{ take: 1, date: recording.date, text: entry.text, durationMs: entry.durationMs, bytes: entry.bytes, kept: false }];
    entry.text = promptFor(line);
    let kept = null;
    for (let n = 1; n <= most && !kept; n++) {
      const bytes = await speakLine(promptFor(line));
      const trial = path.join(VOICE_DIR, `take-${fileFor(line)}`);
      fs.writeFileSync(trial, bytes);
      const ms = durationMs(trial);
      const take = { take: entry.history.length + 1, date, text: promptFor(line), durationMs: ms, bytes: bytes.length, kept: ms <= slot };
      entry.history.push(take);
      console.log(`${fileFor(line)}  take ${take.take}: ${ms} ms of a ${slot} ms slot  ${take.kept ? 'fits, kept' : 'does not fit, deleted'}`);
      if (take.kept) {
        fs.renameSync(trial, path.join(VOICE_DIR, fileFor(line)));
        kept = take;
      } else {
        fs.unlinkSync(trial);
      }
    }
    entry.takes = entry.history.length;
    if (kept) Object.assign(entry, { durationMs: kept.durationMs, bytes: kept.bytes, keptTake: kept.take });
    else console.log(`${fileFor(line)}: no take fits after ${most} more; the text has to be shortened (prompt 11)`);
  }
  fs.writeFileSync(RECORDING_FILE, JSON.stringify(recording, null, 2) + '\n');
  fs.writeFileSync(path.join(ROOT, 'voice/LINES.md'), linesMarkdown(story));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const story = loadStory();
  const retakeAt = process.argv.indexOf('--retake');
  if (retakeAt !== -1) {
    await retake(story, process.argv[retakeAt + 1].split(',').map(Number));
  } else if (process.argv.includes('--record')) {
    await record(story);
  } else if (process.argv.includes('--check')) {
    let bad = 0;
    for (const line of story.LINES) {
      const file = path.join(VOICE_DIR, fileFor(line));
      const ms = fs.existsSync(file) ? durationMs(file) : null;
      const fits = ms !== null && ms <= story.slotMs(line);
      if (!fits) bad++;
      console.log(`${fileFor(line)}  slot ${story.slotMs(line)} ms  file ${ms === null ? 'missing' : `${ms} ms`}  ${fits ? 'fits' : 'DOES NOT FIT'}`);
    }
    for (const { version, differ } of buildsOutOfStep()) {
      if (differ.length) bad++;
      console.log(`dist/${version}/voice/: ${differ.length ? `${differ.length} file(s) differ from src/voice/ (run npm run voice)` : 'same as src/voice/'}`);
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
    const copied = syncBuilds();
    console.log(`wrote voice/LINES.md; ${made} silent placeholder(s) in src/voice/; ${copied.length} file(s) copied into builds${copied.length ? `: ${copied.join(', ')}` : ''}`);
  }
}
