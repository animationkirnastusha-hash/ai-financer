# PACK 212 — Accounts Fina flow and analytics-style cleanup

## Scope

- Accounts page visual rebuild in the same direction as Analytics.
- Account details and edit sheets restyled as structured bottom sheets.
- Add account flow moved from form fields to Fina chat.
- Account transfer flow moved from form fields to Fina chat.
- Account delete keeps the inline confirmation and backend unlink cleanup from the previous account fix.
- Account-specific CSS is split into page fragments and no longer lives in shared product-screen overrides.

## Manual cleanup after installing

Delete obsolete form files. They are no longer imported and should not stay in the repository:

```powershell
Set-Location "D:\AI-financer v.3"

Remove-Item -Force -ErrorAction SilentlyContinue "frontend\src\features\accounts\ui\CreateAccountSheet.tsx"
Remove-Item -Force -ErrorAction SilentlyContinue "frontend\src\features\accounts\ui\AccountTransferSheet.tsx"
Remove-Item -Force -ErrorAction SilentlyContinue "frontend\src\features\accounts\model\accountFlow.store.ts"
Remove-Item -Force -ErrorAction SilentlyContinue "frontend\src\features\accounts\model\accountFlow.types.ts"
```

## Checks

```powershell
Set-Location "D:\AI-financer v.3\frontend"
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue "dist"
npm run build
npm run audit:css
npm run audit:predeploy:strict
```

Backend is touched:

```bash
cd /root/ai-financer/backend
npm run build
pm2 restart ai-financer --update-env
pm2 save
```
