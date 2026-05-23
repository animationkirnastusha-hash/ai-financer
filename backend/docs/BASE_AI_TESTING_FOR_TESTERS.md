# Backend base testing guide for testers

Use this after installing the latest backend build and before testing Premium.

## 1. Generate token

```bash
cd /root/ai-financer/backend
TEST_TELEGRAM_ID=516730814 TEST_ADMIN=1 npm run test:token
```

The token is saved automatically to `.test-auth-token`.

## 2. Run full base regression

```bash
cd /root/ai-financer/backend
TEST_BASE_URL="http://localhost:3000/api" \
TEST_HEALTH_URL="http://localhost:3000/health" \
TEST_ADMIN="1" \
npm run test:base-ai
```

## 3. Reports

Reports are saved to:

```text
backend/test-results/base-ai-regression-*.md
backend/test-results/base-ai-regression-*.json
```

## 4. What is tested

- auth
- read endpoints
- accounts
- transactions
- sections
- categories
- goals
- budgets
- recurring payments
- settings
- onboarding
- progression
- referral
- notifications
- admin endpoints
- base AI account actions
- base AI transaction actions
- base AI safe edit of the last income without duplicate
- base AI transfer
- base AI goals
- base AI taxonomy
- base AI cancel
- base limit for 4+ actions

## 5. Important

The suite is a black-box tester. It does not parse financial commands locally. It sends natural-language commands to the backend and verifies API state after the backend handles them.
