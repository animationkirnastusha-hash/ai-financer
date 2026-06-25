function expense(label, command, amount, extra = {}) {
  return {
    label,
    group: extra.group ?? 'expense',
    command,
    expect: {
      tool: 'create_transaction',
      kind: 'expense',
      amount,
      cleanTitle: true,
      ...(extra.expect ?? {}),
    },
  };
}

function income(label, command, amount, extra = {}) {
  return {
    label,
    group: extra.group ?? 'income',
    command,
    expect: {
      tool: 'create_transaction',
      kind: 'income',
      amount,
      cleanTitle: true,
      ...(extra.expect ?? {}),
    },
  };
}

function query(label, command, tool, extra = {}) {
  return {
    label,
    group: extra.group ?? 'query',
    command,
    expect: {
      tool,
      ...(extra.expect ?? {}),
    },
  };
}

const explicitExpenseCases = [
  expense('ru-coffee-cash-100', 'Кофе 100 с налички', 100, { expect: { includes: { account: ['налич'] } } }),
  expense('ru-coffee-cash-250', 'Купил кофе за 250 с налички', 250, { expect: { includes: { account: ['налич'] } } }),
  expense('ru-taxi-card-780', 'Такси 780 с карты', 780, { expect: { includes: { account: ['карт'] } } }),
  expense('ru-groceries-card-5300', 'Продукты 5300 с карты', 5300, { expect: { includes: { account: ['карт'] } } }),
  expense('ru-pharmacy-cash-640', 'Аптека 640 наличкой', 640, { expect: { includes: { account: ['налич'] } } }),
  expense('ru-rent-card-45000', 'Аренда квартиры 45000 с карты', 45000, { expect: { includes: { account: ['карт'] } } }),
  expense('ru-internet-card-900', 'Интернет 900 с карты', 900, { expect: { includes: { account: ['карт'] } } }),
  expense('ru-phone-card-600', 'Связь 600 с карты', 600, { expect: { includes: { account: ['карт'] } } }),
  expense('ru-fuel-card-3200', 'Бензин 3200 с карты', 3200, { expect: { includes: { account: ['карт'] } } }),
  expense('ru-restaurant-cash-2600', 'Ужин в ресторане 2600 наличкой', 2600, { expect: { includes: { account: ['налич'] } } }),
  expense('ru-child-school-card-15000', 'Оплатил детский сад 15000 с карты', 15000, { expect: { includes: { account: ['карт'] } } }),
  expense('ru-gym-card-3500', 'Абонемент в зал 3500 с карты', 3500, { expect: { includes: { account: ['карт'] } } }),
  expense('ru-books-card-1800', 'Книги 1800 с карты', 1800, { expect: { includes: { account: ['карт'] } } }),
  expense('ru-subway-cash-70', 'Метро 70 наличкой', 70, { expect: { includes: { account: ['налич'] } } }),
  expense('ru-clothes-card-7200', 'Одежда 7200 с карты', 7200, { expect: { includes: { account: ['карт'] } } }),
  expense('ru-beauty-card-2400', 'Стрижка 2400 с карты', 2400, { expect: { includes: { account: ['карт'] } } }),
  expense('ru-repair-cash-5000', 'Ремонт телефона 5000 наличкой', 5000, { expect: { includes: { account: ['налич'] } } }),
  expense('ru-parking-card-300', 'Парковка 300 с карты', 300, { expect: { includes: { account: ['карт'] } } }),
  expense('ru-flowers-cash-1500', 'Цветы 1500 наличкой', 1500, { expect: { includes: { account: ['налич'] } } }),
  expense('ru-vet-card-4200', 'Ветеринар 4200 с карты', 4200, { expect: { includes: { account: ['карт'] } } }),
];

const amountNotationCases = [
  expense('ru-rent-20k-card', 'Потратил 20к на аренду с карты', 20000, { expect: { includes: { account: ['карт'] } } }),
  expense('ru-products-5-300-card', 'Потратил 5 300 рублей на продукты с карты', 5300, { expect: { includes: { account: ['карт'] } } }),
  expense('ru-cafe-1k-cash', 'Кафе 1к наличкой', 1000, { expect: { includes: { account: ['налич'] } } }),
  expense('en-groceries-5300-card', 'I spent 5300 rubles on groceries from card', 5300, { expect: { language: 'en', includes: { account: ['card', 'карт'] } } }),
  expense('en-coffee-300-cash', 'I spent 300 RUB on coffee from cash', 300, { expect: { language: 'en', includes: { account: ['cash', 'налич'] } } }),
  expense('en-rent-20k-card', 'Spent 20k rubles on rent from card', 20000, { expect: { language: 'en', includes: { account: ['card', 'карт'] } } }),
  expense('en-taxi-1-2k-card', 'Taxi 1.2k rubles from card', 1200, { expect: { language: 'en', includes: { account: ['card', 'карт'] } } }),
  income('ru-income-20k-cash', 'Доход 20к на наличку', 20000, { expect: { includes: { account: ['налич'] } } }),
  income('ru-income-35k-card', 'Положи доход 35к на карту', 35000, { expect: { includes: { account: ['карт'] } } }),
  income('en-income-35k-cash', 'Income 35k rubles to cash', 35000, { expect: { language: 'en', includes: { account: ['cash', 'налич'] } } }),
];

const noAccountClarificationCases = [
  expense('ru-groceries-no-account', 'Потратил 5300 рублей на продукты', 5300, { expect: { clarificationField: ['account'], noSilentAccount: true } }),
  expense('ru-coffee-no-account', 'Потратил 300 на кофе', 300, { expect: { clarificationField: ['account'], noSilentAccount: true } }),
  expense('ru-medicine-no-account', 'Купил лекарства за 900', 900, { expect: { clarificationField: ['account'], noSilentAccount: true } }),
  income('ru-income-no-account', 'Получил 10000 рублей', 10000, { expect: { clarificationField: ['account'], noSilentAccount: true } }),
  expense('en-groceries-no-account', 'I spent 5300 rubles on groceries', 5300, { expect: { language: 'en', clarificationField: ['account'], noSilentAccount: true } }),
  expense('en-coffee-no-account', 'I bought coffee for 300 rubles', 300, { expect: { language: 'en', clarificationField: ['account'], noSilentAccount: true } }),
  income('en-income-no-account', 'I got 10000 rubles income', 10000, { expect: { language: 'en', clarificationField: ['account'], noSilentAccount: true } }),
  expense('ru-coffee-missing-amount', 'Купил кофе', undefined, { expect: { amount: undefined, clarificationField: ['amount'] } }),
  expense('en-coffee-missing-amount', 'I bought coffee', undefined, { expect: { language: 'en', amount: undefined, clarificationField: ['amount'] } }),
  income('ru-salary-missing-amount', 'Получил зарплату на карту', undefined, { expect: { amount: undefined, clarificationField: ['amount'] } }),
];

const mixedMerchantCases = [
  expense('mixed-azs-drink-cigarettes', 'Потратил 387 рублей на заправке, напиток и сигареты', 387, {
    expect: {
      noSilentAccount: true,
      clarificationField: ['account'],
      textIncludes: [['заправ', 'азс'], ['напит'], ['сигар']],
      textNotIncludes: ['Заправка: напиток и сигареты'],
      noProductForMixedMerchant: true,
    },
  }),
  expense('mixed-azs-fuel-coffee-card', 'На АЗС потратил 1800 на бензин и кофе с карты', 1800, {
    expect: { includes: { account: ['карт'] }, textIncludes: [['азс', 'заправ'], ['бенз'], ['коф']], noProductForMixedMerchant: true },
  }),
  expense('mixed-mall-cinema-food-card', 'В ТЦ потратил 2400 на кино и еду с карты', 2400, {
    expect: { includes: { account: ['карт'] }, textIncludes: [['тц', 'торгов'], ['кино'], ['ед']] },
  }),
  expense('mixed-store-name-moloko-card', 'В магазине Молоко купил хлеб и шампунь на 900 с карты', 900, {
    expect: { includes: { account: ['карт'] }, textIncludes: [['молоко'], ['хлеб'], ['шампун']] },
  }),
  expense('merchant-is-not-category', 'Купил в Пятерочке корм для кота на 700 с карты', 700, {
    expect: { includes: { account: ['карт'] }, textIncludes: [['пятер'], ['корм', 'кот']] },
  }),
];



const realUserLaunchCases = [
  expense('real-cash-energy-hotdog-split-amounts', 'Расход налик 100 энергетик хотдог 222', 322, {
    group: 'real-user',
    expect: {
      actionCount: 1,
      includes: { account: ['налич'] },
      textIncludes: [['энерг'], ['хотд']],
      textNotIncludes: ['Расход налик 100 энергетик хотдог 222'],
      cleanTitle: true,
    },
  }),
  expense('real-cash-energy-hotdog-typo', 'Расход нал 100 энергетик хот дог 222', 322, {
    group: 'real-user',
    expect: {
      actionCount: 1,
      includes: { account: ['налич'] },
      textIncludes: [['энерг'], ['хот']],
      cleanTitle: true,
    },
  }),
  expense('real-short-coffee-cash-no-wake-word', 'кофе 100 с налички', 100, {
    group: 'real-user',
    expect: { includes: { account: ['налич'] }, textIncludes: [['коф']], cleanTitle: true },
  }),
  income('real-short-income-cash-no-wake-word', 'доход 1000 на наличку', 1000, {
    group: 'real-user',
    expect: { includes: { account: ['налич'] }, cleanTitle: true },
  }),
  query('real-goal-vacation-no-wake-word', 'создай цель отпуск 120000', ['create_goal'], {
    group: 'real-user',
    expect: { amount: 120000, includes: { title: ['отпуск'] } },
  }),
  query('real-show-taxonomy-no-wake-word', 'покажи категории', ['show_taxonomy'], {
    group: 'real-user',
  }),
  expense('real-products-20k-card', 'Потратил 20к на продукты с карты', 20000, {
    group: 'real-user',
    expect: { includes: { account: ['карт'] }, textIncludes: [['продукт']], cleanTitle: true },
  }),
  expense('real-products-short-20k-card', '20к продукты карта', 20000, {
    group: 'real-user',
    expect: { includes: { account: ['карт'] }, textIncludes: [['продукт']], cleanTitle: true },
  }),
  income('real-salary-short-85k-card', 'зп 85к карта', 85000, {
    group: 'real-user',
    expect: { includes: { account: ['карт'] }, textIncludes: [['зарп', 'зп']], cleanTitle: true },
  }),
  expense('real-azs-without-amount-asks-amount', 'Заправка напиток сигареты', undefined, {
    group: 'real-user',
    expect: { amount: undefined, clarificationField: ['amount'] },
  }),
  expense('real-snack-without-amount-asks-amount', 'налик энергетик хотдог', undefined, {
    group: 'real-user',
    expect: { amount: undefined, clarificationField: ['amount'] },
  }),
  query('real-search-cafe-week', 'найди траты на кафе за неделю', ['query_analytics', 'show_transactions'], {
    group: 'real-user',
  }),
  query('real-no-general-expense-for-cafe-search', 'Есть траты на кафе за неделю?', ['query_analytics', 'show_transactions'], {
    group: 'real-user',
  }),
  expense('real-mixed-azs-cash', 'на заправке 387 наличкой напиток сигареты', 387, {
    group: 'real-user',
    expect: {
      includes: { account: ['налич'] },
      textIncludes: [['заправ', 'азс'], ['напит'], ['сигар']],
      noProductForMixedMerchant: true,
      cleanTitle: true,
    },
  }),
  expense('real-card-cafe-colloquial', 'карта кофе булка 430', 430, {
    group: 'real-user',
    expect: { includes: { account: ['карт'] }, textIncludes: [['коф'], ['бул']], cleanTitle: true },
  }),
];

const accountCases = [
  query('create-cash-account-35k-en', 'Create a cash account and deposit 35k rubles', ['create_account'], {
    group: 'accounts',
    expect: { language: 'en', amount: 35000, includes: { type: ['cash'] }, textNotIncludes: ['T-Банк', 'Т-Банк'] },
  }),
  query('create-card-account-10k-en', 'Create a card account with a balance of 10k rubles', ['create_account'], {
    group: 'accounts',
    expect: { language: 'en', amount: 10000, includes: { type: ['card'] } },
  }),
  query('create-usd-cash-vietnam-ru', 'Создай счёт в долларах наличка, назови его Вьетнам', ['create_account'], {
    group: 'accounts',
    expect: { currency: 'USD', includes: { name: ['вьет'] }, textNotIncludes: ['Т-Банк', 'T-Bank'] },
  }),
  query('create-usd-cash-vietnam-typo-ru', 'Создай счет в долларах нал, назови его вьетнаи', ['create_account'], {
    group: 'accounts',
    expect: { currency: 'USD', includes: { name: ['вьет'] }, textNotIncludes: ['Т-Банк', 'T-Bank'] },
  }),
  query('rename-account', 'Переименуй счёт Карта в Основная карта', ['update_account'], { group: 'accounts', expect: { includes: { account: ['карт'], name: ['основ'] } } }),
  query('show-accounts-ru', 'Покажи счета', ['show_accounts'], { group: 'accounts' }),
  query('show-accounts-en', 'Show my accounts', ['show_accounts'], { group: 'accounts', expect: { language: 'en' } }),
  query('set-primary-expense-account', 'Сделай наличку основным счётом для расходов', ['set_primary_account'], { group: 'accounts', expect: { includes: { account: ['налич'] } } }),
  query('delete-one-account-danger', 'Удали счёт Карта', ['delete_account'], { group: 'accounts', expect: { includes: { account: ['карт'] } } }),
  query('delete-all-accounts-danger', 'Удали все мои счета', ['delete_accounts'], { group: 'accounts' }),
];

const transferCases = [
  query('transfer-cash-to-card', 'Переведи 1000 с налички на карту', ['transfer_money'], { group: 'transfer', expect: { amount: 1000, includes: { fromAccount: ['налич'], toAccount: ['карт'] } } }),
  query('transfer-card-to-cash', 'Переведи 2500 с карты в наличку', ['transfer_money'], { group: 'transfer', expect: { amount: 2500, includes: { fromAccount: ['карт'], toAccount: ['налич'] } } }),
  query('transfer-en-card-to-cash', 'Move 5000 rubles from card to cash', ['transfer_money'], { group: 'transfer', expect: { language: 'en', amount: 5000, includes: { fromAccount: ['card', 'карт'], toAccount: ['cash', 'налич'] } } }),
  query('transfer-missing-target', 'Переведи 5000 с карты', ['transfer_money'], { group: 'transfer', expect: { amount: 5000, clarificationField: ['toAccount', 'account'] } }),
  query('transfer-missing-source', 'Переведи 5000 на карту', ['transfer_money'], { group: 'transfer', expect: { amount: 5000, clarificationField: ['fromAccount', 'account'] } }),
  query('transfer-missing-amount', 'Переведи с налички на карту', ['transfer_money'], { group: 'transfer', expect: { clarificationField: ['amount'] } }),
];

const goalCases = [
  query('goal-vacation-120k', 'Создай цель отпуск 120000', ['create_goal'], { group: 'goals', expect: { amount: 120000, includes: { title: ['отпуск'] } } }),
  query('goal-vacation-missing-amount', 'Создай цель на отпуск', ['create_goal'], { group: 'goals', expect: { clarificationField: ['amount', 'targetAmount'] } }),
  query('goal-emergency-autosave', 'Создай цель подушка 300000 и откладывай 10 процентов с каждого дохода', ['create_goal'], { group: 'goals', expect: { amount: 300000, includes: { title: ['подуш'] } } }),
  query('show-goals-ru', 'Покажи цели', ['show_goals'], { group: 'goals' }),
  query('show-goals-en', 'Show my goals', ['show_goals'], { group: 'goals', expect: { language: 'en' } }),
  query('update-goal-amount', 'Измени цель отпуск на 150000', ['update_goal'], { group: 'goals', expect: { amount: 150000, includes: { goal: ['отпуск'] } } }),
  query('archive-goal', 'Удали цель отпуск', ['delete_goal'], { group: 'goals', expect: { includes: { goal: ['отпуск'] } } }),
];

const taxonomyCases = [
  query('show-taxonomy-ru', 'Покажи категории', ['show_taxonomy'], { group: 'taxonomy' }),
  query('show-taxonomy-en', 'Show categories', ['show_taxonomy'], { group: 'taxonomy', expect: { language: 'en' } }),
  query('create-category-coffee', 'Создай категорию Кофе в разделе Еда вне дома', ['create_category'], { group: 'taxonomy', expect: { includes: { name: ['кофе'], section: ['еда'] } } }),
  query('create-section-rest', 'Создай раздел Отдых', ['create_section'], { group: 'taxonomy', expect: { includes: { name: ['отдых'] } } }),
  query('move-category-section', 'Перенеси категорию Кино в раздел Отдых', ['assign_category_to_section'], { group: 'taxonomy', expect: { includes: { category: ['кино'], section: ['отдых'] } } }),
  query('rename-category', 'Переименуй категорию Еда в Продукты', ['update_category'], { group: 'taxonomy', expect: { includes: { category: ['еда'], name: ['продукт'] } } }),
  query('delete-category-danger', 'Удали категорию Сигареты', ['delete_category'], { group: 'taxonomy', expect: { includes: { category: ['сигар'] } } }),
  expense('rest-can-be-category', 'Потратил 3000 на отдых с карты', 3000, { group: 'taxonomy', expect: { includes: { account: ['карт'] }, textIncludes: [['отдых']] } }),
];

const analyticsCases = [
  query('month-expenses', 'Покажи расходы за месяц', ['query_analytics', 'show_transactions'], { group: 'analytics' }),
  query('month-income', 'Покажи доходы за месяц', ['query_analytics', 'show_transactions'], { group: 'analytics' }),
  query('today-spending', 'Сколько я потратил сегодня?', ['query_analytics'], { group: 'analytics' }),
  query('top-categories', 'Топ категорий за месяц', ['query_analytics'], { group: 'analytics' }),
  query('coffee-search', 'Покажи все расходы на кофе', ['query_analytics', 'show_transactions'], { group: 'analytics' }),
  query('card-spending', 'Сколько ушло с карты за неделю?', ['query_analytics'], { group: 'analytics' }),
  query('cash-balance', 'Сколько денег на наличке?', ['query_analytics', 'show_accounts'], { group: 'analytics' }),
  query('en-month-expenses', 'Show expenses for this month', ['query_analytics', 'show_transactions'], { group: 'analytics', expect: { language: 'en' } }),
  query('en-top-categories', 'What are my top spending categories?', ['query_analytics'], { group: 'analytics', expect: { language: 'en' } }),
  query('recent-transactions', 'Покажи последние операции', ['show_transactions'], { group: 'analytics' }),
];

const editCases = [
  query('update-last-expense-amount', 'Исправь последний расход на 500 рублей', ['update_transaction'], { group: 'edits', expect: { amount: 500 } }),
  query('rename-last-operation', 'Переименуй последнюю операцию в кофе', ['update_transaction'], { group: 'edits', expect: { textIncludes: [['кофе']] } }),
  query('move-last-to-card', 'Перенеси последнюю операцию на карту', ['update_transaction'], { group: 'edits', expect: { includes: { account: ['карт'] } } }),
  query('change-last-category', 'Поставь последнему расходу категорию транспорт', ['update_transaction'], { group: 'edits', expect: { includes: { category: ['транспорт'] } } }),
  query('undo-last-ai-action', 'Отмени последнюю операцию', ['undo_last_action'], { group: 'edits' }),
  query('en-update-last-expense', 'Change the last expense to 700 rubles', ['update_transaction'], { group: 'edits', expect: { language: 'en', amount: 700 } }),
];

const obligationCases = [
  query('create-loan', 'Добавь кредит в Сбербанке: остаток 300000, платёж 15000, каждый месяц 10 числа', ['create_obligation'], { group: 'obligations', expect: { amount: 15000, textIncludes: [['сбер'], ['300000', '300 000']] } }),
  query('create-subscription', 'Добавь подписку Netflix 999 рублей каждый месяц с карты', ['create_obligation'], { group: 'obligations', expect: { amount: 999, includes: { account: ['карт'] } } }),
  query('show-obligations', 'Покажи ближайшие платежи', ['show_obligations'], { group: 'obligations' }),
  query('mark-loan-paid', 'Отметь кредит Сбер оплаченным с карты', ['mark_obligation_paid'], { group: 'obligations', expect: { includes: { account: ['карт'] } } }),
  query('update-loan-payment', 'Измени платёж по кредиту Сбер на 17000', ['update_obligation'], { group: 'obligations', expect: { amount: 17000 } }),
  query('delete-subscription', 'Удали подписку Netflix', ['delete_obligation'], { group: 'obligations', expect: { includes: { obligation: ['netflix'] } } }),
  query('en-create-subscription', 'Add a monthly subscription Spotify for 399 rubles from card', ['create_obligation'], { group: 'obligations', expect: { language: 'en', amount: 399, includes: { account: ['card', 'карт'] } } }),
];

const limitCases = [
  query('limit-cafes', 'Поставь лимит на кафе 10000 в месяц', ['create_spending_limit'], { group: 'limits', expect: { amount: 10000, includes: { targetType: ['category'] } } }),
  query('limit-card', 'Лимит по карте 50000 в месяц', ['create_spending_limit'], { group: 'limits', expect: { amount: 50000, includes: { targetType: ['account'], account: ['карт'] } } }),
  query('limit-total', 'Ограничь все расходы до 100000 в месяц', ['create_spending_limit'], { group: 'limits', expect: { amount: 100000, includes: { targetType: ['total'] } } }),
  query('show-limits', 'Покажи лимиты', ['show_spending_limits'], { group: 'limits' }),
  query('update-limit', 'Измени лимит кафе на 12000', ['update_spending_limit'], { group: 'limits', expect: { amount: 12000 } }),
  query('delete-limit', 'Удали лимит на кафе', ['delete_spending_limit'], { group: 'limits' }),
  query('en-limit-groceries', 'Set a monthly grocery limit of 30000 rubles', ['create_spending_limit'], { group: 'limits', expect: { language: 'en', amount: 30000 } }),
];

const smallTalkCases = [
  query('smalltalk-ru-how-are-you', 'Как дела?', null, { group: 'smalltalk', expect: { noMoneyAction: true, language: 'ru' } }),
  query('smalltalk-ru-what', 'Что', null, { group: 'smalltalk', expect: { noMoneyAction: true, language: 'ru' } }),
  query('smalltalk-ru-thanks', 'Спасибо', null, { group: 'smalltalk', expect: { noMoneyAction: true, language: 'ru' } }),
  query('smalltalk-ru-help', 'Что ты умеешь?', null, { group: 'smalltalk', expect: { noMoneyAction: true, language: 'ru' } }),
  query('smalltalk-en-how-are-you', 'How are you?', null, { group: 'smalltalk', expect: { noMoneyAction: true, language: 'en' } }),
  query('smalltalk-en-what', 'What', null, { group: 'smalltalk', expect: { noMoneyAction: true, language: 'en' } }),
  query('smalltalk-en-help', 'What can you do?', null, { group: 'smalltalk', expect: { noMoneyAction: true, language: 'en' } }),
  query('random-words', 'зелёный самолёт без денег', null, { group: 'smalltalk', expect: { noMoneyAction: true, language: 'ru' } }),
];

export const AI_REGRESSION_CASES = [
  ...explicitExpenseCases,
  ...amountNotationCases,
  ...noAccountClarificationCases,
  ...mixedMerchantCases,
  ...realUserLaunchCases,
  ...accountCases,
  ...transferCases,
  ...goalCases,
  ...taxonomyCases,
  ...analyticsCases,
  ...editCases,
  ...obligationCases,
  ...limitCases,
  ...smallTalkCases,
];
