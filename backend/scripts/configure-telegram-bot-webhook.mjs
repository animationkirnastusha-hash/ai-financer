#!/usr/bin/env node
import { loadBackendEnv } from './lib/load-backend-env.mjs';

loadBackendEnv({ backendRoot: process.cwd() });

const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const explicitUrl = (process.env.TELEGRAM_BOT_WEBHOOK_URL || '').trim();
const publicBackendUrl = (process.env.PUBLIC_BACKEND_URL || process.env.BACKEND_PUBLIC_URL || '').trim().replace(/\/+$/, '');
const secret = (process.env.TELEGRAM_BOT_WEBHOOK_SECRET || process.env.TELEGRAM_FALLBACK_WEBHOOK_SECRET || '').trim();
const webhookUrl = explicitUrl || (publicBackendUrl ? `${publicBackendUrl}/api/telegram-bot/webhook` : '');

function fail(message) {
  console.error(`Telegram bot webhook setup failed: ${message}`);
  process.exit(1);
}

if (!token) fail('TELEGRAM_BOT_TOKEN is missing.');
if (!webhookUrl) fail('Set TELEGRAM_BOT_WEBHOOK_URL or PUBLIC_BACKEND_URL.');
if (!/^https:\/\//.test(webhookUrl)) fail(`Webhook URL must start with https://, got ${webhookUrl}`);
if (!secret) fail('TELEGRAM_BOT_WEBHOOK_SECRET is missing.');

const form = new FormData();
form.set('url', webhookUrl);
form.set('secret_token', secret);
form.set('allowed_updates', JSON.stringify(['message', 'callback_query']));
form.set('drop_pending_updates', process.env.TELEGRAM_BOT_DROP_PENDING_UPDATES === '1' ? 'true' : 'false');

const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  body: form,
});

const payload = await response.json().catch(() => null);
if (!response.ok || !payload?.ok) {
  fail(payload?.description || `Telegram returned HTTP ${response.status}`);
}

console.log('Telegram bot webhook configured.');
console.log(`URL: ${webhookUrl}`);
console.log('Allowed updates: message, callback_query');
