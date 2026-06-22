#!/usr/bin/env node
import { loadBackendEnv } from './lib/load-backend-env.mjs';

loadBackendEnv({ backendRoot: process.cwd() });

const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const expectedSecret = (process.env.TELEGRAM_BOT_WEBHOOK_SECRET || process.env.TELEGRAM_FALLBACK_WEBHOOK_SECRET || '').trim();

function fail(message) {
  console.error(`Telegram bot webhook check failed: ${message}`);
  process.exit(1);
}

if (!token) fail('TELEGRAM_BOT_TOKEN is missing.');
if (!expectedSecret) fail('TELEGRAM_BOT_WEBHOOK_SECRET is missing.');

const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
const payload = await response.json().catch(() => null);
if (!response.ok || !payload?.ok) fail(payload?.description || `Telegram returned HTTP ${response.status}`);

const info = payload.result || {};
console.log('Telegram bot webhook info');
console.log(JSON.stringify({
  url: info.url || '',
  hasCustomCertificate: Boolean(info.has_custom_certificate),
  pendingUpdateCount: Number(info.pending_update_count || 0),
  lastErrorDate: info.last_error_date || null,
  lastErrorMessage: info.last_error_message || null,
  allowedUpdates: info.allowed_updates || [],
}, null, 2));

if (!String(info.url || '').includes('/api/telegram-bot/webhook')) {
  fail('Webhook URL does not point to /api/telegram-bot/webhook. Run npm run bot:webhook:set.');
}

if (info.last_error_message) {
  fail(`Telegram reports webhook error: ${info.last_error_message}`);
}

console.log('Telegram bot webhook check passed.');
