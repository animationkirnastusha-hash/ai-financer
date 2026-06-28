# PACK 205B — remove Telegram bot voice remains

This patch finishes the active voice removal in the Telegram bot backend module.

## Files

- `backend/src/modules/telegram-bot/service.ts`
- `backend/src/modules/telegram-bot/types.ts`
- `backend/src/modules/telegram-bot/bot-locale.ts`

## Changes

- Removed `voiceService` import from Telegram bot service.
- Removed Telegram voice/audio transcription flow.
- Removed voice usage counting from bot AI commands.
- Telegram bot now handles only text commands and shows a text-only unsupported message for non-text messages.
- Removed voice/audio fields from Telegram message type.
- Removed voice-specific bot locale keys and text references.
- Replaced the removed `limitEnded` key usage with the existing `unavailable` key.

## Check

```bash
cd /root/ai-financer/backend
npm run build
npm run audit:final
```
