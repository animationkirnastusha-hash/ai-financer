import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { config as loadEnv } from 'dotenv';

loadEnv();

const baseUrl = (process.env.TEST_BASE_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
const tokenPath = path.resolve(process.cwd(), '.test-auth-token');

async function readToken() {
  if (process.env.TEST_AUTH_TOKEN) return process.env.TEST_AUTH_TOKEN.trim();
  try {
    return (await fs.readFile(tokenPath, 'utf8')).trim();
  } catch {
    return '';
  }
}

async function request(pathname, options = {}) {
  const token = await readToken();
  if (!token) {
    throw new Error('No TEST_AUTH_TOKEN and no backend/.test-auth-token. Run: TEST_TELEGRAM_ID=... npm run test:token');
  }

  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.message || `HTTP ${response.status}`);
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function main() {
  console.log('AI-Financer voice STT smoke');
  console.log(`Base URL: ${baseUrl}`);

  const status = await request('/voice/status');
  console.log('Status:', JSON.stringify(status, null, 2));

  if (!process.env.TEST_VOICE_AUDIO) {
    console.log('No TEST_VOICE_AUDIO passed. Status check only.');
    return;
  }

  const audioPath = path.resolve(process.env.TEST_VOICE_AUDIO);
  const buffer = await fs.readFile(audioPath);
  const form = new FormData();
  const ext = path.extname(audioPath).replace(/^\./, '') || 'webm';
  const type = ext === 'mp4' ? 'audio/mp4' : ext === 'mp3' ? 'audio/mpeg' : ext === 'wav' ? 'audio/wav' : 'audio/webm';
  form.append('audio', new Blob([buffer], { type }), `voice.${ext}`);
  form.append('language', process.env.TEST_VOICE_LANGUAGE || 'ru');

  const token = await readToken();
  const response = await fetch(`${baseUrl}/voice/transcribe`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const payload = await response.json().catch(() => ({}));

  console.log('Transcribe:', JSON.stringify(payload, null, 2));

  if (!response.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error?.payload ? JSON.stringify(error.payload, null, 2) : error);
  process.exit(1);
});
