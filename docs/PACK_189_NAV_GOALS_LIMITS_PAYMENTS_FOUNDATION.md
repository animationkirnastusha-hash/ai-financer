# PACK 189 — navigation, goals limits and payments foundation

## Scope

This package starts the product restructure without touching backend contracts.

## Included

- New `goals-limits` screen.
- New `payments` screen.
- New lightweight `store` screen so the menu item has a real destination.
- Side menu order:
  - Goals and limits
  - Payments
  - separator
  - Referrals
  - Store
  - separator
  - Admin only for admin users
- Old `goals`, `spending-limits` and `obligations` screens remain routable for compatibility.
- Dashboard obligation widget now opens Payments.
- Companion quick action now opens Goals and limits.
- Chat navigation intent understands Goals and limits, Payments, Store.
- Payment page groups Mortgage under Credit.
- Add buttons on the new pages open Fina chat instead of opening manual creation forms.

## Not included

- Full removal of legacy modal forms.
- Backend changes.
- Full Premium Store rebuild.
- Automatic dedicated goal account creation in backend. The new flow asks Fina to create it.

## Checks

Run from frontend:

```bash
rm -rf dist
npm run build
npm run audit:css
npm run audit:predeploy:strict
```
