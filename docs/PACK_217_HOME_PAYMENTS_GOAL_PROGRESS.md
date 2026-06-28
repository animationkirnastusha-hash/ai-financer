# Pack 217 — Home payments and goal progress

## Scope

Base-version UX polish for the dashboard only. No Premium changes.

## Changes

- Rebuilt the home nearest-payment widget into a compact dashboard block with a header, `All` action, payment row, amount, account and debt progress.
- Removed the heavy expanded/hidden home-payment controls from the dashboard widget.
- Added a compact goal progress widget on the dashboard.
- The home goal widget opens the Goals page when tapped.
- Added a goal display preference on the Goals page: a goal row can be marked as the goal shown on the dashboard.
- The goal selection is stored as a UI preference in localStorage and the dashboard falls back to the closest/highest-progress active goal if the selected goal is missing or archived.
- Added dashboard and goals i18n keys for Russian and English.
- Added logical dashboard CSS for the planning row and kept the obligations widget CSS in the obligations style folder.

## Files

- frontend/src/pages/dashboard/DashboardPage.tsx
- frontend/src/features/obligations/ui/HomeObligationsWidget.tsx
- frontend/src/features/goals/ui/HomeGoalProgressWidget.tsx
- frontend/src/features/goals/lib/homeGoalSelection.ts
- frontend/src/pages/goals-limits/GoalsLimitsPage.tsx
- frontend/src/app/styles/pages/obligations/home-obligations-widget.css
- frontend/src/app/styles/pages/dashboard/dashboard.css
- frontend/src/app/styles/pages/dashboard/home-planning-widgets.css
- frontend/src/app/styles/pages/goals-limits/goals-limits/goals-limits-list.css
- frontend/src/shared/lib/i18n/locales/ru/dashboard.ts
- frontend/src/shared/lib/i18n/locales/en/dashboard.ts
- frontend/src/shared/lib/i18n/locales/ru/misc.ts
- frontend/src/shared/lib/i18n/locales/en/misc.ts

## Manual deletion

None.

## Checks

- npm run audit:css — passed, Problems: 0
- npm run audit:predeploy:strict — passed, CSS structure findings: 0
- npm run audit:product-readiness — passed

Full frontend build was not valid in the sandbox because node_modules are not present.
