import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const envFiles = [
  path.resolve(process.cwd(), '.env'),
  '/root/ai-financer-secrets/backend.env',
].filter((file) => fs.existsSync(file));

for (const file of envFiles) {
  dotenv.config({ path: file, override: false });
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const token = required('TELEGRAM_BOT_TOKEN');
const miniAppUrl = (
  process.env.TELEGRAM_MINI_APP_URL?.trim()
  || process.env.TELEGRAM_WEB_APP_URL?.trim()
  || process.env.FRONTEND_URL?.trim()
  || ''
);

if (!miniAppUrl) {
  throw new Error('TELEGRAM_MINI_APP_URL or TELEGRAM_WEB_APP_URL or FRONTEND_URL is required');
}

async function telegram(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) {
    throw new Error(`${method} failed: ${payload.description || response.status}`);
  }

  return payload.result;
}

await telegram('setMyCommands', {
  commands: [
    { command: 'start', description: 'Открыть меню Фины' },
    { command: 'plans', description: 'Premium и будущая Бизнес Фина' },
    { command: 'terms', description: 'Пользовательское соглашение' },
    { command: 'support', description: 'Поддержка' },
    { command: 'language', description: 'Выбрать язык' },
    { command: 'login', description: 'Получить код входа' },
  ],
});

await telegram('setChatMenuButton', {
  menu_button: {
    type: 'web_app',
    text: 'Открыть Фину',
    web_app: { url: miniAppUrl },
  },
});

await telegram('setMyShortDescription', {
  short_description: 'Фина помогает вести личные финансы в Telegram.',
});

await telegram('setMyDescription', {
  description: [
    'Фина помогает вести личные финансы в Telegram.',
    '',
    'Premium: 399 рублей в месяц.',
    'Бизнес Фина: скоро как отдельное Mini App.',
    'Разовые пакеты: 99 и 199 рублей.',
    '',
    'Нажмите Start, чтобы открыть меню, тарифы, поддержку и пользовательское соглашение.',
  ].join('\n'),
});

console.log('Telegram bot storefront configured');
console.log(`Mini App URL: ${miniAppUrl}`);
