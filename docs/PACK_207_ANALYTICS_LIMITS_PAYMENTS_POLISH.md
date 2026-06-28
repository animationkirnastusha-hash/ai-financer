# Pack 207 — Analytics, limits and payments polish

## Scope

This pack updates the current frontend after the analytics category breakdown work.

## Changes

- Removed the Analytics overview block with the short summary section.
- Analytics category rows are no longer clickable and no longer navigate to Journal.
- The "More" category action still opens a full category sheet with a larger donut and full category list.
- Increased vertical spacing on Analytics to match the rest of the app better.
- Added a dedicated Analytics spacing fragment instead of growing existing CSS files.
- Added dedicated polish fragments for Limits and Payments to keep their cards, tabs, KPI blocks and lists visually consistent.
- No backend logic changed.
- No image generation, no apply scripts.

## Files

- frontend/src/pages/analytics/AnalyticsPage.tsx
- frontend/src/app/styles/index.css
- frontend/src/app/styles/pages/analytics/analytics-clarity-spacing.css
- frontend/src/app/styles/pages/goals-limits/goals-limits.css
- frontend/src/app/styles/pages/goals-limits/goals-limits/goals-limits-polish.css
- frontend/src/app/styles/pages/payments/payments.css
- frontend/src/app/styles/pages/payments/payments/payments-polish.css
