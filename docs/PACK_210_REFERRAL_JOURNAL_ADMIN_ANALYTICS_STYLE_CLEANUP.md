# PACK 210 — Referral / Journal / Admin analytics-style cleanup

## Scope

Frontend-only package.

## Changed

- Referral page now uses the same spacing, cards, KPI rhythm and surfaces as Analytics.
- Journal page styles were split into shell, filters and list fragments.
- Admin page now uses an Admin CSS aggregator and structured shell styles.
- Admin overview, monitoring, events, training, tools and user panels were moved away from ad-hoc utility styling to semantic classes.
- Removed the duplicate `dashboard-device-safety.css` import from `index.css`; it is still loaded through `dashboard.css`.
- Cleaned `analytics-foldouts.css` so it only owns the Fina hint card, not tabs, period controls or chart cards.

## CSS structure

No temporary override files were added.

New logical fragments:

- `frontend/src/app/styles/pages/journal/journal/journal-shell.css`
- `frontend/src/app/styles/pages/journal/journal/journal-filters.css`
- `frontend/src/app/styles/pages/journal/journal/journal-list.css`
- `frontend/src/app/styles/pages/admin/admin.css`
- `frontend/src/app/styles/pages/admin/admin-shell.css`

## Checks run in sandbox

```text
npm run audit:css
Problems: 0

npm run audit:predeploy:strict
CSS structure findings: 0
Technical word candidates: 0
Env leaks: 0
```

Full `npm run build` was not run in the sandbox because the uploaded clean archive has no `node_modules`.
