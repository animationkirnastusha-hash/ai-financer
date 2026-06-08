import { runSmoke } from './lib/test-context.mjs';
import { requestJson } from './lib/http-client.mjs';

function tomorrowIso() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setUTCHours(9, 0, 0, 0);
  return date.toISOString();
}

await runSmoke('obligations-reports', async (context) => {
  const accountResponse = await requestJson(context, '/accounts', {
    method: 'POST',
    expected: [201],
    body: {
      name: `Smoke obligation account ${context.suffix}`,
      type: 'card',
      currency: 'RUB',
      balance: 90000,
    },
  });
  const accountId = accountResponse.payload?.account?.id;
  if (!accountId) throw new Error('Account for obligation was not created');

  const createdLoan = await requestJson(context, '/obligations/loans', {
    method: 'POST',
    expected: [201],
    body: {
      title: `Smoke credit ${context.suffix}`,
      type: 'loan',
      creditor: 'Smoke Bank',
      currency: 'RUB',
      principalAmount: 100000,
      currentDebt: 80000,
      monthlyPayment: 7000,
      interestRate: 12,
      termMonths: 18,
      paidMonths: 2,
      paymentDay: 15,
      nextPaymentDate: tomorrowIso(),
      reminderDaysBefore: 1,
      accountId,
      autoCreateExpense: true,
      note: 'predeploy smoke',
    },
  });

  const loan = createdLoan.payload?.loan;
  if (!loan?.id) throw new Error('Loan was not created');
  if (Number(loan.monthlyPayment) !== 7000) throw new Error('Loan monthly payment mismatch');

  const summary = await requestJson(context, '/obligations/summary');
  if (!summary.payload?.summary || typeof summary.payload.summary.totalDebt !== 'number') {
    throw new Error('Obligation summary is invalid');
  }

  const paid = await requestJson(context, `/obligations/loans/${loan.id}/payments`, {
    method: 'POST',
    body: {
      amount: 7000,
      accountId,
      createExpense: true,
      note: 'predeploy smoke payment',
    },
  });
  if (!paid.payload?.loan?.id) throw new Error('Loan payment did not return loan');

  const reminder = await requestJson(context, '/obligations/reminders', {
    method: 'POST',
    expected: [201],
    body: {
      loanId: loan.id,
      title: `Smoke reminder ${context.suffix}`,
      message: 'predeploy smoke reminder',
      dueDate: tomorrowIso(),
      remindAt: tomorrowIso(),
      channel: 'app',
    },
  });
  const reminderId = reminder.payload?.reminder?.id;
  if (!reminderId) throw new Error('Reminder was not created');

  await requestJson(context, `/obligations/reminders/${reminderId}`, {
    method: 'PATCH',
    body: { status: 'done' },
  });

  const reportPreview = await requestJson(context, '/reports/preview?mode=month');
  if (!reportPreview.payload?.summary || typeof reportPreview.payload.transactionsCount !== 'number') {
    throw new Error('Report preview is invalid');
  }

  const excel = await fetch(`${context.baseUrl}/reports/download?mode=month&format=xlsx`, {
    headers: { authorization: `Bearer ${context.token}` },
  });
  if (!excel.ok) throw new Error(`Excel report returned ${excel.status}`);
  const excelBytes = await excel.arrayBuffer();
  if (excelBytes.byteLength < 1000) throw new Error(`Excel report is too small: ${excelBytes.byteLength}`);

  const pdf = await fetch(`${context.baseUrl}/reports/download?mode=month&format=pdf`, {
    headers: { authorization: `Bearer ${context.token}` },
  });
  if (!pdf.ok) throw new Error(`PDF report returned ${pdf.status}`);
  const pdfBytes = await pdf.arrayBuffer();
  if (pdfBytes.byteLength < 500) throw new Error(`PDF report is too small: ${pdfBytes.byteLength}`);

  await requestJson(context, `/obligations/loans/${loan.id}`, { method: 'DELETE' });

  context.log('obligations and reports passed', {
    loanId: loan.id,
    reminderId,
    excelBytes: excelBytes.byteLength,
    pdfBytes: pdfBytes.byteLength,
  });
});
