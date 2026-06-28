# Pack 200c — voice core exports build fix

Сборочный фикс поверх pack-200/200b.

## Что исправлено

1. `VoiceCue` снова экспортируется из `@/features/voice/core`.
2. `usePressToTalkVoice` снова принимает старое поле `sessionMs`, чтобы старые thin-wrapper файлы не ломали build.
3. `sessionMs` используется как alias для `maxDurationMs`.
4. Single-recorder подход из pack-200/200b сохранён.

## Файлы

- `frontend/src/features/voice/core/index.ts`
- `frontend/src/features/voice/core/usePressToTalkVoice.ts`
- `frontend/src/features/voice/model/useVoiceRecorder.ts`

## Проверка

```bash
cd /root/ai-financer/frontend
rm -rf dist
npm run build
npm run audit:css
npm run audit:predeploy:strict
```
