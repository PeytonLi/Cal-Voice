// Pre-renders all narration and sound effects to public/audio/ via ElevenLabs.
// Run once at build time; the shipped app is static and never touches the API.
//
//   ELEVENLABS_API_KEY=... node scripts/gen-audio.mjs [--force]
//
// Existing files are skipped so re-runs cost no credits. Pass --force to redo.

import { writeFile, mkdir, access } from 'node:fs/promises';
import { POIS } from '../src/pois.js';

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) {
  console.error('ELEVENLABS_API_KEY is not set.');
  process.exit(1);
}
const FORCE = process.argv.includes('--force');
const OUT = new URL('../public/audio/', import.meta.url);
await mkdir(OUT, { recursive: true });

const exists = (f) => access(new URL(f, OUT)).then(() => true, () => false);

let made = 0, skipped = 0, chars = 0;

async function save(file, res, label) {
  if (!res.ok) {
    console.error(`  FAIL ${file} — ${res.status} ${(await res.text()).slice(0, 180)}`);
    return false;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(new URL(file, OUT), buf);
  console.log(`  ${file}  ${(buf.length / 1024).toFixed(0)} KB  ${label}`);
  made++;
  return true;
}

async function speak(file, text, voice) {
  if (!FORCE && await exists(file)) { skipped++; return; }
  chars += text.length;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true },
    }),
  });
  await save(file, res, text.slice(0, 46) + '…');
}

async function sfx(file, prompt, seconds) {
  if (!FORCE && await exists(file)) { skipped++; return; }
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: prompt, duration_seconds: seconds, prompt_influence: 0.55 }),
  });
  await save(file, res, prompt.slice(0, 46) + '…');
}

console.log('narration');
for (const poi of POIS) {
  for (let i = 0; i < poi.lines.length; i++) {
    await speak(`${poi.id}-${i}.mp3`, poi.lines[i], poi.voice);
  }
}

console.log('sound effects');
await sfx('bells.mp3',
  'A large bronze carillon bell tower chiming the hour, deep resonant church bells ringing out across an open university campus, long natural decay, outdoor reverb', 10);
await sfx('ambience.mp3',
  'Quiet outdoor university campus ambience, gentle wind through trees, distant indistinct student chatter, occasional birdsong, no music', 22);
await sfx('step.mp3',
  'A single footstep on a concrete pavement, dry, close-miked, short', 1);

console.log(`\n${made} written, ${skipped} skipped, ~${chars} characters billed`);
