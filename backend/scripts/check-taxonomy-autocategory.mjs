import { runSmoke } from './lib/test-context.mjs';
import { requestJson } from './lib/http-client.mjs';

const OTHER_NAMES = new Set(['другое', 'прочее', 'other', 'misc']);

function normalizeName(value) {
  return String(value ?? '').trim().toLowerCase();
}

function assertSemanticSection(section, label) {
  if (!section?.id) throw new Error(`${label}: section is missing`);
  const name = normalizeName(section.name);
  if (!name) throw new Error(`${label}: section name is empty`);
  if (OTHER_NAMES.has(name)) {
    throw new Error(`${label}: section must not fall back to ${section.name}`);
  }
}

function assertCategory(category, label) {
  if (!category?.id) throw new Error(`${label}: category is missing`);
  if (!category.name) throw new Error(`${label}: category name is missing`);
  if (!category.icon) throw new Error(`${label}: category icon was not assigned`);
  if (!category.color) throw new Error(`${label}: category color was not assigned`);
}

await runSmoke('taxonomy-autocategory', async (context) => {
  const accountResponse = await requestJson(context, '/accounts', {
    method: 'POST',
    expected: [201],
    body: {
      name: `Taxonomy smoke account ${context.suffix}`,
      type: 'cash',
      currency: 'RUB',
      balance: 12000,
    },
  });
  const accountId = accountResponse.payload?.account?.id;
  if (!accountId) throw new Error('Account for taxonomy autocategory was not created');

  const txResponse = await requestJson(context, '/transactions', {
    method: 'POST',
    expected: [201],
    body: {
      accountId,
      amount: 777,
      type: 'expense',
      title: `Канцтовары бумага ручки ${context.suffix}`,
      description: 'taxonomy autocategory smoke',
    },
  });

  const transaction = txResponse.payload?.transaction;
  if (!transaction?.id) throw new Error('Autocategory transaction was not created');
  assertCategory(transaction.category, 'transaction');
  assertSemanticSection(transaction.section ?? transaction.category?.section, 'transaction');

  const azsResponse = await requestJson(context, '/transactions', {
    method: 'POST',
    expected: [201],
    body: {
      accountId,
      amount: 387,
      type: 'expense',
      title: 'заправка напиток и сигареты',
      description: 'одна сумма без разбивки по товарам',
    },
  });

  const azsTransaction = azsResponse.payload?.transaction;
  if (!azsTransaction?.id) throw new Error('AZS semantic transaction was not created');
  if (azsTransaction.section?.name !== 'АЗС') {
    throw new Error(`AZS transaction section mismatch: ${azsTransaction.section?.name}`);
  }
  if (azsTransaction.category?.name !== 'Покупки на АЗС') {
    throw new Error(`AZS mixed purchase category mismatch: ${azsTransaction.category?.name}`);
  }
  if (azsTransaction.title === 'заправка напиток и сигареты') {
    throw new Error('AZS transaction title should not repeat the raw command text');
  }

  const sectionsResponse = await requestJson(context, '/sections');
  const sections = sectionsResponse.payload?.sections ?? [];
  if (!Array.isArray(sections) || !sections.some((section) => section.id === (transaction.sectionId ?? transaction.section?.id ?? transaction.category?.sectionId))) {
    throw new Error('Autocreated transaction section is not visible on /sections');
  }

  const categoriesResponse = await requestJson(context, '/categories');
  const categories = categoriesResponse.payload?.categories ?? [];
  const listedCategory = Array.isArray(categories) ? categories.find((category) => category.id === transaction.category.id) : null;
  if (!listedCategory) throw new Error('Autocreated transaction category is not visible on /categories');
  assertCategory(listedCategory, 'listed category');
  assertSemanticSection(listedCategory.section ?? transaction.section, 'listed category');

  const manualCategoryResponse = await requestJson(context, '/categories', {
    method: 'POST',
    expected: [201],
    body: {
      name: `Детский сад ${context.suffix}`,
      type: 'expense',
    },
  });
  const manualCategory = manualCategoryResponse.payload?.category;
  assertCategory(manualCategory, 'manual category');
  assertSemanticSection(manualCategory.section, 'manual category');

  context.log('taxonomy autocategory flow passed', {
    transactionId: transaction.id,
    category: transaction.category.name,
    section: (transaction.section ?? transaction.category.section)?.name,
    azsTransactionId: azsTransaction.id,
    azsCategory: azsTransaction.category.name,
    manualCategory: manualCategory.name,
    manualSection: manualCategory.section?.name,
  });
});
