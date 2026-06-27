# Pack 194 — auth fallback, voice reset, account delete, AI entrypoints

## Scope

This pack fixes the current tester blockers:

- account deletion no longer gets blocked by linked transactions or recurring payments;
- AI account deletion uses the same cleanup path;
- Telegram clients without initData can enter through a temporary per-device fallback without changing the official initData login path;
- chat and floating voice permission flow now requests the browser/system microphone prompt from the user gesture instead of getting stuck on an internal prompt;
- floating voice hold starts faster;
- existing pending actions no longer auto-open chat on first application load;
- goals/limits and payments add/edit buttons open Fina as a guided prompt instead of auto-sending a hidden user command;
- visible “add with Fina / through Fina” copy is removed from the touched screens and dictionaries;
- extra Fina promo blocks on Goals/Limits and Payments are removed.

## Notes

Deleting an account now also removes transactions directly linked to that account. Transfer balance effects on other accounts are reverted before deletion.

The no-initData auth path is temporary and uses a local per-device id. Official Telegram initData login still wins whenever initData is present.
