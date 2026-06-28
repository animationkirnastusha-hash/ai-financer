# PACK 213 — archive audit and navigation cleanup

Root cleanup after pack 212 archive check.

## Changed

- Removed stale frontend product-readiness requirement for `voice-permission-compact.css` after the voice layer was removed.
- Removed active `store` and `sections` routes from frontend navigation/router.
- Split drawer planning links into real menu entries for goals, spending limits, payments and referrals.
- Removed store CSS import from the central style manifest.
- Removed removed-route aliases from Fina pull/navigation intent code so removed screens are not returned as active `AppScreen` values.
- Removed removed-route labels from chat navigation messages.

## Must delete from project root

```powershell
Remove-Item -Force -ErrorAction SilentlyContinue "package-lock.json"
Remove-Item -Force -ErrorAction SilentlyContinue "frontend\tsconfig.node.tsbuildinfo"
Remove-Item -Force -ErrorAction SilentlyContinue "frontend\src\pages\store\StorePage.tsx"
Remove-Item -Force -ErrorAction SilentlyContinue "frontend\src\app\styles\pages\store\store.css"
Remove-Item -Force -ErrorAction SilentlyContinue "frontend\src\pages\sections\SectionsPage.tsx"
```

## Checked in sandbox

```text
frontend audit:css: passed, Problems 0
frontend audit:predeploy:strict: passed, CSS structure findings 0
frontend audit:product-readiness: passed
backend audit:final: passed, Problems 0
```
