# Warden Snek: voice lines (v1.3)

Generated from src/story.js by `npm run voice`; edit the lines there, not here.

Warden Snek is a retired orchard warden. The lines imitate no known character: no stealth, no radio calls, no code
names, no catchphrases from any game; the voice is not modelled on any actor (UPDATES.md, v1.3 guardrails).

**Status: not recorded.** Every file in src/voice/ is a silent placeholder as long as its slot as MP3 frames allow
(never longer), so the build and the rig work. A slot is the line's words at 2.5 words per second, rounded to 0.1 s, plus 0.8 s;
the game shows each line for its slot whether or not the sound plays, so a recording that fits its slot does not
change any timing. Check with `npm run voice -- --check`.

## Recording settings

- Tool: ElevenLabs (web app), Text to Speech
- Model: Eleven v3 (eleven_v3)
- Voice: one voice made with Voice Design from the description below; not a library voice and not a clone of anyone
- Voice Design description: "An old man in his seventies, a retired orchard warden. Low, warm, slightly gravelly voice. Slow and tired, with a gentle, dry sense of humour. Neutral English accent. Quiet, as if remembering. Not theatrical, not military, not an impression of any actor or character."
- Stability: Natural (0.5)
- Language: English
- Output format: MP3, 44.1 kHz, 64 kbps (mp3_44100_64)
- Text: the line exactly as written below, with its emotion as an audio tag in front, e.g. "[weary] There was an orchard here once."
- Save each take as the file in the last column, replacing the placeholder.

## Disclosure (fill in when recording)

| Date | Tool and version as shown in its UI | Exact prompt (Voice Design description, and each line's text) |
|---|---|---|
| | | |

## Lines

| # | Scene | Emotion | Line | Slot (s) | File |
|---|---|---|---|---|---|
| 1 | Opening: the dark field | weary | There was an orchard here once. | 3.2 | src/voice/01.mp3 |
| 2 | Opening: the dark field | wistful | Rows and rows of trees, every one of them heavy with apples. | 5.6 | src/voice/02.mp3 |
| 3 | Opening: the dark field | proud | I was its warden. I knew every tree by name. | 4.8 | src/voice/03.mp3 |
| 4 | Opening: the dark field | bitter | Then they came. They took the apples. All of them. | 4.8 | src/voice/04.mp3 |
| 5 | Opening: the dark field | grim | They took the trees. They took the fence. | 4.0 | src/voice/05.mp3 |
| 6 | Opening: the dark field | deadpan | They even took the little sign that said Orchard. | 4.4 | src/voice/06.mp3 |
| 7 | Opening: the dark field | hollow | Now there is only this field. And it is very dark. | 5.2 | src/voice/07.mp3 |
| 8 | Opening: the dark field | hopeful | But somewhere out there, there is one apple left. | 4.4 | src/voice/08.mp3 |
| 9 | Opening: the dark field | resolute | I am retired. I am three squares long. I am going to get it. | 6.4 | src/voice/09.mp3 |
| 10 | After an apple | quiet | One apple. Not the orchard. But it is a start. | 4.8 | src/voice/10.mp3 |
| 11 | After an apple | nostalgic | It tastes like the old days. Crisp. A little sour. | 4.8 | src/voice/11.mp3 |
| 12 | After an apple | rueful | I used to count them. Now I just eat them. | 4.8 | src/voice/12.mp3 |
| 13 | After an apple | defiant | They can take the trees. They cannot take the taste. | 4.8 | src/voice/13.mp3 |
| 14 | After an apple | dry | I am getting longer. That is either growth or regret. | 4.8 | src/voice/14.mp3 |
| 15 | After an apple | tender | Somewhere, a tree is proud of me. | 3.6 | src/voice/15.mp3 |
| 16 | After an apple | solemn | Another one. The orchard remembers. | 2.8 | src/voice/16.mp3 |
| 17 | After an apple | tired | My back hurts. I do not have a back. It still hurts. | 5.6 | src/voice/17.mp3 |
