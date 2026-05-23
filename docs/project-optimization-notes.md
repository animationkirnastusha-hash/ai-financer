# Ai-financer: optimization notes

## Current stabilization principle

Do not keep adding global CSS patches to `frontend/src/index.css`. The frontend now has separated style layers:

- `base.css` — reset, Telegram shell, typography, global tap behavior.
- `layout.css` — page layout, cards, top bars, dashboard money blocks.
- `components.css` — reusable action/list/toggle/companion component contracts.
- `modals.css` — bottom sheets, modal fields, modal actions.
- `voice.css` — floating Fina, voice intro, bubbles, microphone controls.
- `swipe.css` — swipe drag and transition animation.

## Next optimization steps

1. Move repeated component markup to shared UI components instead of relying on class names in pages.
2. Keep AI command processing backend-only through planner → tool contract → validator → executor. No financial command parser.
3. Add visual regression screenshots for main mobile widths: 360, 390, 430.
4. Add frontend smoke test pages for Dashboard, Settings, Transactions, Goals, Admin.
5. Split premium UI after base stability: premium should be a visible product layer, not mixed into reset/voice patches.
