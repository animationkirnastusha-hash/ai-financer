import { runSmoke } from '../smoke/lib/test-context.mjs';
import {
  createAccount,
  createCategory,
  createSection,
  createTransaction,
  requestJson,
  requireId,
  safeRequest,
} from './lib/scenario-helpers.mjs';

function nextDateIso(days = 7) {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  date.setUTCHours(9, 0, 0, 0);
  return date.toISOString();
}

await runSmoke('scenario-04-limits-obligations-reports', async (context) => {
  const account = await createAccount(context, `План карта ${context.suffix}`, 60000, 'card');
  const section = await createSection(context, `Кафе лимит ${context.suffix}`, '☕', '#f59e0b');
  const category = await createCategory(context, `Кофе лимит ${context.suffix}`, section.id, '☕', '#f59e0b');

  const limitResponse = await requestJson(context, '/spending-limits', {
    method: 'POST',
    expected: [201],
    body: { targetType: 'category', categoryId: category.id, amount: 5000, period: 'month', notifyAt: 80, isActive: true },
  });
  const limit = limitResponse.payload?.limit;
  requireId(limit?.id, 'spending limit');

  const expense = await createTransaction(context, {
    accountId: account.id,
    categoryId: category.id,
    sectionId: section.id,
    type: 'expense',
    amount: 1250,
    title: 'Кофе и обед',
    description: 'Проверка лимита',
  }, 'limit expense');

  const loanResponse = await requestJson(context, '/obligations/loans', {
    method: 'POST',
    expected: [201],
    body: {
      title: `Кредит ${context.suffix}`,
      type: 'loan',
      creditor: 'Тест банк',
      currency: 'RUB',
      principalAmount: 100000,
      currentDebt: 80000,
      monthlyPayment: 7000,
      interestRate: 12,
      termMonths: 18,
      paidMonths: 2,
      paymentDay: 15,
      nextPaymentDate: nextDateIso(5),
      reminderDaysBefore: 1,
      accountId: account.id,
      autoCreateExpense: true,
      note: 'Сценарная проверка',
    },
  });
  const loan = loanResponse.payload?.loan;
  requireId(loan?.id, 'loan');

  const summary = await requestJson(context, '/obligations/summary');
  if (typeof summary.payload?.summary?.monthlyPayment !== 'number') throw new Error('Obligations summary monthlyPayment is invalid');

  const reportPreview = await requestJson(context, '/reports/preview?mode=month');
  if (!reportPreview.payload?.summary || typeof reportPreview.payload.transactionsCount !== 'number') throw new Error('Report preview is invalid');

  const pdf = await fetch(`${context.baseUrl}/reports/download?mode=month&format=pdf`, {
    headers: { authorization: `Bearer ${context.token}` },
  });
  if (!pdf.ok) throw new Error(`PDF report returned ${pdf.status}`);
  const pdfBytes = await pdf.arrayBuffer();
  if (pdfBytes.byteLength < 500) throw new Error(`PDF report is too small: ${pdfBytes.byteLength}`);

  await safeRequest(context, `/obligations/loans/${loan.id}`, { method: 'DELETE' });
  await safeRequest(context, `/spending-limits/${limit.id}`, { method: 'DELETE' });
  await safeRequest(context, `/transactions/${expense.id}`, { method: 'DELETE', body: { balanceMode: 'revert' } });
  await safeRequest(context, `/categories/${category.id}`, { method: 'DELETE' });
  await safeRequest(context, `/sections/${section.id}`, { method: 'DELETE' });
  await safeRequest(context, `/accounts/${account.id}`, { method: 'DELETE' });

  context.log('limits obligations reports passed', { limitId: limit.id, loanId: loan.id, pdfBytes: pdfBytes.byteLength });
});
