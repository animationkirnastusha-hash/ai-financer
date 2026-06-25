import { runSmoke } from './lib/test-context.mjs';
import { requestJson } from './lib/http-client.mjs';

function assertEntity(entity, label) {
  if (!entity?.id) throw new Error(`${label}: id is missing`);
  if (!entity?.name) throw new Error(`${label}: name is missing`);
}

function assertAppearance(entity, label) {
  assertEntity(entity, label);
  if (!entity.icon) throw new Error(`${label}: icon is missing`);
  if (!entity.color) throw new Error(`${label}: color is missing`);
}

await runSmoke('taxonomy-contract', async (context) => {
  const accountResponse = await requestJson(context, '/accounts', {
    method: 'POST',
    expected: [201],
    body: {
      name: `Taxonomy contract account ${context.suffix}`,
      type: 'cash',
      currency: 'RUB',
      balance: 12000,
    },
  });
  const accountId = accountResponse.payload?.account?.id;
  if (!accountId) throw new Error('Account for taxonomy contract smoke was not created');

  const txResponse = await requestJson(context, '/transactions', {
    method: 'POST',
    expected: [201],
    body: {
      accountId,
      amount: 777,
      type: 'expense',
      title: `Канцтовары бумага ручки ${context.suffix}`,
      description: 'taxonomy contract smoke',
    },
  });

  const transaction = txResponse.payload?.transaction;
  if (!transaction?.id) throw new Error('Transaction was not created');
  assertAppearance(transaction.category, 'transaction fallback category');

  if (transaction.sectionId || transaction.section) {
    throw new Error('Category-only transaction must not keep a section link');
  }

  if (transaction.category.name !== 'Прочие расходы') {
    throw new Error(`Manual transaction must use category-only fallback: ${transaction.category.name}`);
  }

  const manualCategoryResponse = await requestJson(context, '/categories', {
    method: 'POST',
    expected: [201],
    body: {
      name: `Детский сад ${context.suffix}`,
      type: 'expense',
      sectionId: 'legacy-section-must-be-ignored',
    },
  });
  const manualCategory = manualCategoryResponse.payload?.category;
  assertAppearance(manualCategory, 'manual category');
  if (manualCategory.sectionId) {
    throw new Error('Manual category must ignore sectionId in category-only mode');
  }

  context.log('taxonomy contract flow passed', {
    transactionId: transaction.id,
    fallbackCategory: transaction.category.name,
    manualCategory: manualCategory.name,
    sectionId: manualCategory.sectionId ?? null,
  });
});
