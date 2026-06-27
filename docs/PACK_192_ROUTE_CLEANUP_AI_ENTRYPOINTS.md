# Pack 192 — route cleanup and AI entrypoints

## Scope

This pack finishes the safe cleanup after the Goals/Limits and Payments restructuring.

## Changes

- Legacy pages `goals`, `spending-limits` and `obligations` are now compatibility wrappers over the new pages.
- Navigation normalizes old internal screen names:
  - `goals` -> `goals-limits`
  - `spending-limits` -> `goals-limits`
  - `obligations` -> `payments`
- Chat navigation labels now cover journal, profile and sections instead of falling back to a generic label.
- The `sections` screen is wired back into `AppRouter` to avoid a blank page when Fina opens categories/sections.
- Home nearest-payment widget no longer opens the old obligation form for editing. It opens Fina with the payment-edit context.
- Notifications no longer open the old obligation form. Related payment notifications open the Payments page.
- Old page files are not deleted yet; they are thin wrappers for compatibility.
- Goals/Limits CSS is split into smaller logical files.
- Store CSS is moved out of Goals/Limits CSS into its own file.
- Missing `reports.css` placeholder is restored so CSS audit passes.

## Checks performed in sandbox

- `node scripts/audit-css.mjs` — Problems: 0
- `node scripts/predeploy-audit.mjs --strict` — blocking findings: 0

Full frontend build was not run in the sandbox because `node_modules` are not present in the uploaded clean archive.
