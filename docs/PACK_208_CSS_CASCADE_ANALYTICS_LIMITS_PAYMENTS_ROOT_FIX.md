# Pack 208 — CSS cascade, analytics, limits and payments root fix

## Scope
- Removed the conflicting analytics spacing patch rules from the late CSS fragment.
- Moved analytics spacing and chart/list behavior into the logical source files.
- Removed mobile rules that forced goals/limits and payments KPI cards into a vertical stack.
- Moved active goals/limits and active payments lists above secondary focus/reminder blocks.
- Rebuilt category legend rows so names are not cut with ellipsis and rows are not clickable.

## Files
- frontend/src/pages/analytics/AnalyticsPage.tsx
- frontend/src/pages/goals-limits/GoalsLimitsPage.tsx
- frontend/src/pages/payments/PaymentsPage.tsx
- frontend/src/app/styles/layout/compact-density.css
- frontend/src/app/styles/pages/analytics/analytics-shell.css
- frontend/src/app/styles/pages/analytics/analytics-layout.css
- frontend/src/app/styles/pages/analytics/analytics-charts.css
- frontend/src/app/styles/pages/analytics/analytics-lists.css
- frontend/src/app/styles/pages/analytics/analytics-foldouts.css
- frontend/src/app/styles/pages/analytics/analytics-clarity-spacing.css
- frontend/src/app/styles/pages/goals-limits/goals-limits/goals-limits-polish.css
- frontend/src/app/styles/pages/goals-limits/goals-limits/goals-limits-responsive.css
- frontend/src/app/styles/pages/payments/payments/payments-polish.css

## Checks
Run frontend build and audits after replacing files.
