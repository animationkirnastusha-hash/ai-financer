import { runSmoke } from '../smoke/lib/test-context.mjs';
import {
  createAccount,
  createTransaction,
  requestJson,
  safeRequest,
  unwrapArray,
} from './lib/scenario-helpers.mjs';

await runSmoke('scenario-03-taxonomy-merchant-meaning', async (context) => {
  const account = await createAccount(context, `АЗС карта ${context.suffix}`, 10000, 'card');

  const transaction = await createTransaction(context, {
    accountId: account.id,
    type: 'expense',
    amount: 387,
    title: 'заправка',
    description: 'напиток и сигареты',
  }, 'azs mixed expense');

  if (transaction.title === 'Заправка: напиток и сигареты' || /напиток и сигареты/i.test(transaction.title)) {
    throw new Error(`Transaction title looks like copied user phrase: ${transaction.title}`);
  }
  if (!['Покупка на АЗС', 'Покупки на АЗС'].includes(transaction.title)) {
    throw new Error(`Unexpected AZS title: ${transaction.title}`);
  }
  if (transaction.section?.name !== 'АЗС') {
    throw new Error(`AZS place was not preserved as a section: ${transaction.section?.name}`);
  }
  if (transaction.category?.name === 'Продукты') {
    throw new Error('Mixed AZS purchase must not be put into generic Продукты');
  }
  if (transaction.category?.name !== 'Покупки на АЗС') {
    throw new Error(`Mixed AZS purchase category mismatch: ${transaction.category?.name}`);
  }
  if (!String(transaction.description || '').includes('Место: АЗС')) {
    throw new Error(`AZS merchant metadata is missing from description: ${transaction.description}`);
  }
  if (!String(transaction.description || '').includes('Состав:')) {
    throw new Error(`Mixed purchase composition is missing from description: ${transaction.description}`);
  }

  const sections = unwrapArray((await requestJson(context, '/sections')).payload, 'sections');
  if (!sections.some((item) => item.name === 'АЗС')) throw new Error('AZS section is not visible in taxonomy');

  await safeRequest(context, `/transactions/${transaction.id}`, { method: 'DELETE', body: { balanceMode: 'revert' } });
  await safeRequest(context, `/accounts/${account.id}`, { method: 'DELETE' });

  context.log('taxonomy merchant meaning passed', {
    transactionId: transaction.id,
    title: transaction.title,
    category: transaction.category?.name,
    section: transaction.section?.name,
  });
});
