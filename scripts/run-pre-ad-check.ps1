$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

Write-Host "=== Backend build ==="
Set-Location $backend
npm run build

Write-Host "=== Backend AI finance commands ==="
npm run test:ai-commands

Write-Host "=== Backend AI regression soft ==="
$env:AI_REGRESSION_SOFT = "1"
$env:AI_RATE_LIMIT_PARSE_PER_MINUTE = "200"
$env:AI_RATE_LIMIT_COOLDOWN_MS = "100"
npm run test:ai-regression

Write-Host "=== Frontend CSS audit ==="
Set-Location $frontend
npm run audit:css

Write-Host "=== Frontend predeploy strict audit ==="
npm run audit:predeploy:strict

Write-Host "=== Frontend build ==="
npm run build

Write-Host "=== Pre-ad check finished ==="
