$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbW8wZXNua2swMDAwMTNqd2N3cTNyaThnIiwiaWF0IjoxNzc2MjgwMDUyLCJleHAiOjE3Nzg4NzIwNTJ9.uz70f-CWb4Qm3msG2HbegFn6z5yk9T35taKLlU0Uotc"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "       TEST TRANSACTIONS" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get accounts
Write-Host "[1] Getting accounts..." -ForegroundColor Cyan
$accounts = Invoke-RestMethod -Uri http://localhost:3000/api/accounts -Headers @{ "Authorization" = "Bearer $token" }
$accounts.accounts | ForEach-Object { Write-Host "    $($_.name): $($_.balance) RUB" }
$accountId = $accounts.accounts[0].id
Write-Host ""

# Create income
Write-Host "[2] Creating INCOME: +50000 RUB (Salary)" -ForegroundColor Green
$body = @{
    accountId = $accountId
    amount = 50000
    type = "income"
    description = "Salary"
} | ConvertTo-Json

$income = Invoke-RestMethod -Uri http://localhost:3000/api/transactions -Method POST -Headers @{ 
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
} -Body $body
Write-Host "    Created! ID: $($income.transaction.id)" -ForegroundColor Green
Write-Host ""

# Create expense
Write-Host "[3] Creating EXPENSE: -350 RUB (Coffee)" -ForegroundColor Yellow
$body = @{
    accountId = $accountId
    amount = 350
    type = "expense"
    description = "Coffee"
} | ConvertTo-Json

$expense = Invoke-RestMethod -Uri http://localhost:3000/api/transactions -Method POST -Headers @{ 
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
} -Body $body
Write-Host "    Created! ID: $($expense.transaction.id)" -ForegroundColor Yellow
Write-Host ""

# Create second account
Write-Host "[4] Creating account 'Cash'..." -ForegroundColor Cyan
$body = @{
    name = "Cash"
    type = "cash"
    balance = 0
} | ConvertTo-Json

$cashAccount = Invoke-RestMethod -Uri http://localhost:3000/api/accounts -Method POST -Headers @{ 
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
} -Body $body
Write-Host "    Created! ID: $($cashAccount.account.id)" -ForegroundColor Green
Write-Host ""

# Create transfer
Write-Host "[5] Creating TRANSFER: 10000 RUB -> Cash" -ForegroundColor Magenta
$body = @{
    accountId = $accountId
    toAccountId = $cashAccount.account.id
    amount = 10000
    type = "transfer"
    description = "Withdraw cash"
} | ConvertTo-Json

$transfer = Invoke-RestMethod -Uri http://localhost:3000/api/transactions -Method POST -Headers @{ 
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
} -Body $body
Write-Host "    Transfer complete! ID: $($transfer.transaction.id)" -ForegroundColor Green
Write-Host ""

# Check balances
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "         BALANCES AFTER OPERATIONS" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
$accounts = Invoke-RestMethod -Uri http://localhost:3000/api/accounts -Headers @{ "Authorization" = "Bearer $token" }
$accounts.accounts | ForEach-Object { 
    $color = if ($_.balance -ge 0) { "Green" } else { "Red" }
    Write-Host "  $($_.name): " -NoNewline
    Write-Host "$($_.balance) RUB" -ForegroundColor $color
}
Write-Host ""

# Show transactions
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "         LAST TRANSACTIONS" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
$transactions = Invoke-RestMethod -Uri "http://localhost:3000/api/transactions?limit=10" -Headers @{ "Authorization" = "Bearer $token" }
$transactions.transactions | ForEach-Object { 
    $date = $_.date.Substring(0,10)
    
    if ($_.type -eq "income") {
        Write-Host "  $date | " -NoNewline
        Write-Host "+$($_.amount) RUB" -ForegroundColor Green -NoNewline
        Write-Host " | $($_.description)"
    }
    elseif ($_.type -eq "expense") {
        Write-Host "  $date | " -NoNewline
        Write-Host "-$($_.amount) RUB" -ForegroundColor Yellow -NoNewline
        Write-Host " | $($_.description)"
    }
    elseif ($_.type -eq "transfer") {
        Write-Host "  $date | " -NoNewline
        Write-Host ">$($_.amount) RUB" -ForegroundColor Magenta -NoNewline
        Write-Host " | $($_.description) | $($_.account.name) -> $($_.toAccount.name)"
    }
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "             DONE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan