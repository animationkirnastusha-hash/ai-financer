export type TaxonomyKind = 'expense' | 'income';

export type TaxonomyMatch = {
  categoryName: string;
  sectionName: string;
  categoryIcon: string;
  sectionIcon: string;
  categoryColor: string;
  sectionColor: string;
};

type TaxonomyEntry = TaxonomyMatch & {
  kind: TaxonomyKind;
  keywords: string[];
};

const expenseEntries: Omit<TaxonomyEntry, 'kind'>[] = [
  { categoryName: 'Мясо и колбасы', sectionName: 'Продукты', categoryIcon: '🌭', sectionIcon: '🛒', categoryColor: '#fb7185', sectionColor: '#34d399', keywords: ['колбаса','сосиски','сардельки','ветчина','бекон','мясо','говядина','свинина','курица','индейка','фарш','котлеты','стейк','ребра','карбонат','салями','пепперони','буженина','шашлык','куриные'] },
  { categoryName: 'Молочные продукты', sectionName: 'Продукты', categoryIcon: '🥛', sectionIcon: '🛒', categoryColor: '#93c5fd', sectionColor: '#34d399', keywords: ['молоко','кефир','йогурт','творог','сыр','сметана','сливки','ряженка','масло сливочное','моцарелла','пармезан','брынза','молочка','айран','тан'] },
  { categoryName: 'Хлеб и выпечка', sectionName: 'Продукты', categoryIcon: '🥐', sectionIcon: '🛒', categoryColor: '#fbbf24', sectionColor: '#34d399', keywords: ['хлеб','батон','булка','булочка','круассан','лаваш','пирожок','выпечка','багет','лепешка','пончик','печенье','сдоба','бублик','хачапури'] },
  { categoryName: 'Овощи и фрукты', sectionName: 'Продукты', categoryIcon: '🥦', sectionIcon: '🛒', categoryColor: '#22c55e', sectionColor: '#34d399', keywords: ['яблоки','бананы','апельсины','мандарины','овощи','фрукты','картошка','картофель','помидоры','огурцы','лук','морковь','капуста','зелень','салат','ягоды','виноград','арбуз','дыня','лимон','чеснок'] },
  { categoryName: 'Сладости', sectionName: 'Продукты', categoryIcon: '🍫', sectionIcon: '🛒', categoryColor: '#c084fc', sectionColor: '#34d399', keywords: ['шоколад','конфеты','сладости','торт','пирожное','мороженое','вафли','зефир','мармелад','чипсы сладкие','батончик','печеньки','кекс','десерт'] },
  { categoryName: 'Напитки', sectionName: 'Продукты', categoryIcon: '🧃', sectionIcon: '🛒', categoryColor: '#38bdf8', sectionColor: '#34d399', keywords: ['сок','лимонад','вода','газировка','энергетик','чай','напиток','морс','компот','квас','кола','пепси','фанта','спрайт','минералка'] },
  { categoryName: 'Кофе', sectionName: 'Еда вне дома', categoryIcon: '☕', sectionIcon: '🍽️', categoryColor: '#a16207', sectionColor: '#f97316', keywords: ['кофе','латте','капучино','американо','раф','эспрессо','флэт уайт','кофейня','старбакс','кофеёк','маккафе','кофе с собой','капуч'] },
  { categoryName: 'Рестораны и кафе', sectionName: 'Еда вне дома', categoryIcon: '🍽️', sectionIcon: '🍽️', categoryColor: '#f97316', sectionColor: '#f97316', keywords: ['ресторан','кафе','ужин','обед','завтрак','бургер','пицца','суши','роллы','шаурма','донер','столовая','фудкорт','еда','макдональдс','kfc','вкусно и точка','додо','якитория','тануки'] },
  { categoryName: 'Доставка еды', sectionName: 'Еда вне дома', categoryIcon: '🥡', sectionIcon: '🍽️', categoryColor: '#fb923c', sectionColor: '#f97316', keywords: ['доставка еды','яндекс еда','delivery','деливери','самокат еда','купер','готовая еда','заказ еды','пицца доставка','роллы доставка'] },
  { categoryName: 'Такси', sectionName: 'Транспорт', categoryIcon: '🚕', sectionIcon: '🚗', categoryColor: '#facc15', sectionColor: '#60a5fa', keywords: ['такси','яндекс такси','убер','uber','bolt','поездка','ситимобил','gett','индрайв','таксист'] },
  { categoryName: 'Общественный транспорт', sectionName: 'Транспорт', categoryIcon: '🚌', sectionIcon: '🚗', categoryColor: '#60a5fa', sectionColor: '#60a5fa', keywords: ['метро','автобус','трамвай','троллейбус','маршрутка','проезд','транспортная карта','тройка','подорожник','электричка','жд билет','поезд','мцд','мцк'] },
  { categoryName: 'Бензин', sectionName: 'Авто', categoryIcon: '⛽', sectionIcon: '🚙', categoryColor: '#ef4444', sectionColor: '#64748b', keywords: ['бензин','топливо','азс','заправка','дизель','газ','лукойл','газпромнефть','роснефть','шелл','95','92','98','солярка'] },
  { categoryName: 'Автообслуживание', sectionName: 'Авто', categoryIcon: '🔧', sectionIcon: '🚙', categoryColor: '#94a3b8', sectionColor: '#64748b', keywords: ['сто','автосервис','ремонт авто','шиномонтаж','мойка','масло','техосмотр','страховка осаго','каско','запчасти','колеса','шины','аккумулятор','парковка','штраф гибдд'] },
  { categoryName: 'Аренда жилья', sectionName: 'Дом', categoryIcon: '🏠', sectionIcon: '🏡', categoryColor: '#818cf8', sectionColor: '#8b5cf6', keywords: ['аренда','квартира','съем','снять квартиру','жилье','комната','дом','ипотека платеж','арендодатель','найм жилья'] },
  { categoryName: 'Коммунальные услуги', sectionName: 'Дом', categoryIcon: '💡', sectionIcon: '🏡', categoryColor: '#f59e0b', sectionColor: '#8b5cf6', keywords: ['жкх','коммуналка','коммунальные','электричество','свет','газ квартира','вода','отопление','квартплата','управляющая','домофон','капремонт'] },
  { categoryName: 'Интернет и связь', sectionName: 'Связь', categoryIcon: '📶', sectionIcon: '📱', categoryColor: '#38bdf8', sectionColor: '#0ea5e9', keywords: ['интернет','телефон','связь','мобильная связь','симка','тариф','мтс','билайн','мегафон','теле2','йота','роутер','домашний интернет','провайдер'] },
  { categoryName: 'Подписки', sectionName: 'Развлечения', categoryIcon: '🔁', sectionIcon: '🎮', categoryColor: '#a78bfa', sectionColor: '#ec4899', keywords: ['подписка','netflix','нетфликс','spotify','спотифай','яндекс плюс','кинопоиск','ivi','okko','premier','apple music','icloud','google one','youtube','telegram premium','patreon','boosty'] },
  { categoryName: 'Игры', sectionName: 'Развлечения', categoryIcon: '🎮', sectionIcon: '🎮', categoryColor: '#8b5cf6', sectionColor: '#ec4899', keywords: ['игра','steam','стим','ps store','playstation','xbox','nintendo','донат','роблокс','fortnite','genshin','game pass','epic games'] },
  { categoryName: 'Кино и события', sectionName: 'Развлечения', categoryIcon: '🎬', sectionIcon: '🎮', categoryColor: '#ec4899', sectionColor: '#ec4899', keywords: ['кино','театр','концерт','билет','музей','выставка','квест','ивент','мероприятие','цирк','стендап','бар','клуб'] },
  { categoryName: 'Аптека', sectionName: 'Здоровье', categoryIcon: '💊', sectionIcon: '❤️', categoryColor: '#f43f5e', sectionColor: '#ef4444', keywords: ['аптека','лекарства','таблетки','витамины','сироп','капли','мазь','антибиотик','обезболивающее','фармация','пластырь'] },
  { categoryName: 'Врачи и клиники', sectionName: 'Здоровье', categoryIcon: '🩺', sectionIcon: '❤️', categoryColor: '#fb7185', sectionColor: '#ef4444', keywords: ['врач','клиника','стоматолог','зубной','анализы','мрт','узи','прием врача','лечение','медицина','окулист','терапевт','психолог'] },
  { categoryName: 'Спорт', sectionName: 'Здоровье', categoryIcon: '🏋️', sectionIcon: '❤️', categoryColor: '#22c55e', sectionColor: '#ef4444', keywords: ['спортзал','зал','фитнес','тренировка','абонемент','йога','бассейн','плавание','спорт','тренер','кроссфит','пилатес'] },
  { categoryName: 'Одежда', sectionName: 'Покупки', categoryIcon: '👕', sectionIcon: '🛍️', categoryColor: '#06b6d4', sectionColor: '#c084fc', keywords: ['одежда','футболка','джинсы','куртка','платье','брюки','кофта','худи','носки','белье','рубашка','пальто','wildberries одежда','ламода','zara'] },
  { categoryName: 'Обувь', sectionName: 'Покупки', categoryIcon: '👟', sectionIcon: '🛍️', categoryColor: '#0ea5e9', sectionColor: '#c084fc', keywords: ['обувь','кроссовки','ботинки','туфли','сапоги','кеды','тапки','шлепки','сандалии'] },
  { categoryName: 'Косметика', sectionName: 'Покупки', categoryIcon: '💄', sectionIcon: '🛍️', categoryColor: '#f472b6', sectionColor: '#c084fc', keywords: ['косметика','крем','шампунь','гель','парфюм','духи','макияж','помада','тушь','маникюр','уход','золотое яблоко','летуаль','рив гош'] },
  { categoryName: 'Маркетплейсы', sectionName: 'Покупки', categoryIcon: '📦', sectionIcon: '🛍️', categoryColor: '#f97316', sectionColor: '#c084fc', keywords: ['wildberries','вайлдберриз','ozon','озон','маркетплейс','алиэкспресс','aliexpress','яндекс маркет','посылка','пункт выдачи','заказ'] },
  { categoryName: 'Образование', sectionName: 'Развитие', categoryIcon: '🎓', sectionIcon: '📚', categoryColor: '#3b82f6', sectionColor: '#6366f1', keywords: ['курс','обучение','университет','школа','репетитор','книга','учебник','английский','занятие','лекция','семинар','skillbox','coursera','udemy','нетология'] },
  { categoryName: 'Рабочие сервисы', sectionName: 'Работа', categoryIcon: '💼', sectionIcon: '💻', categoryColor: '#64748b', sectionColor: '#475569', keywords: ['работа','сервис','хостинг','домен','сервер','vps','github','figma','notion','slack','zoom','vpn','прокси','cloudflare','openai','api','saas'] },
  { categoryName: 'Подарки', sectionName: 'Личное', categoryIcon: '🎁', sectionIcon: '✨', categoryColor: '#f43f5e', sectionColor: '#a78bfa', keywords: ['подарок','цветы','букет','сюрприз','день рождения','поздравление','открытка','игрушка','подарки'] },
  { categoryName: 'Дети', sectionName: 'Семья', categoryIcon: '🧸', sectionIcon: '👨‍👩‍👧', categoryColor: '#fbbf24', sectionColor: '#fb7185', keywords: ['дети','ребенок','садик','школа ребенку','игрушки','подгузники','памперсы','детское','кружок','няня'] },
  { categoryName: 'Животные', sectionName: 'Семья', categoryIcon: '🐾', sectionIcon: '👨‍👩‍👧', categoryColor: '#a3e635', sectionColor: '#fb7185', keywords: ['кот','кошка','собака','питомец','корм','ветеринар','ветклиника','наполнитель','зоомагазин','животные'] },
  { categoryName: 'Путешествия', sectionName: 'Путешествия', categoryIcon: '✈️', sectionIcon: '🧳', categoryColor: '#0ea5e9', sectionColor: '#0ea5e9', keywords: ['самолет','авиабилет','отель','гостиница','поездка','путешествие','бронирование','booking','airbnb','такс фри','багаж','тур','отпуск','виза','паспорт'] },
  { categoryName: 'Переводы и комиссии', sectionName: 'Финансы', categoryIcon: '💸', sectionIcon: '🏦', categoryColor: '#14b8a6', sectionColor: '#14b8a6', keywords: ['комиссия','перевод','снятие','банкомат','обслуживание карты','банк','проценты банка','смс банк','эквайринг'] },
  { categoryName: 'Кредиты', sectionName: 'Финансы', categoryIcon: '🏦', sectionIcon: '🏦', categoryColor: '#6366f1', sectionColor: '#14b8a6', keywords: ['кредит','ипотека','рассрочка','займ','платеж по кредиту','долг','проценты','погашение','микрозайм'] },
  { categoryName: 'Налоги и штрафы', sectionName: 'Обязательные платежи', categoryIcon: '🧾', sectionIcon: '📌', categoryColor: '#f97316', sectionColor: '#f59e0b', keywords: ['налог','штраф','пени','госпошлина','фнс','гибдд штраф','пошлина','налоги','штрафы'] },
  { categoryName: 'Благотворительность', sectionName: 'Личное', categoryIcon: '🤝', sectionIcon: '✨', categoryColor: '#22c55e', sectionColor: '#a78bfa', keywords: ['донат','пожертвование','благотворительность','помощь','фонд','сбор','волонтер'] },
  { categoryName: 'Другое', sectionName: 'Прочее', categoryIcon: '🧾', sectionIcon: '📌', categoryColor: '#94a3b8', sectionColor: '#64748b', keywords: ['прочее','другое','расход','покупка','трата','оплата','платеж','чек'] },
];

const incomeEntries: Omit<TaxonomyEntry, 'kind'>[] = [
  { categoryName: 'Зарплата', sectionName: 'Доходы', categoryIcon: '💰', sectionIcon: '💵', categoryColor: '#22c55e', sectionColor: '#16a34a', keywords: ['зарплата','аванс','оклад','получка','зп','salary','работодатель','премия зарплата'] },
  { categoryName: 'Фриланс', sectionName: 'Доходы', categoryIcon: '💻', sectionIcon: '💵', categoryColor: '#38bdf8', sectionColor: '#16a34a', keywords: ['фриланс','заказ','оплата проекта','клиент','гонорар','подработка','услуга','разработка','дизайн'] },
  { categoryName: 'Бизнес', sectionName: 'Доходы', categoryIcon: '📈', sectionIcon: '💵', categoryColor: '#84cc16', sectionColor: '#16a34a', keywords: ['бизнес','выручка','продажа','доход бизнеса','поступление','оплата от клиента','касса','маржа'] },
  { categoryName: 'Кэшбек', sectionName: 'Доходы', categoryIcon: '🪙', sectionIcon: '💵', categoryColor: '#facc15', sectionColor: '#16a34a', keywords: ['кэшбек','cashback','бонус','возврат бонусов','баллы','милли','начисление'] },
  { categoryName: 'Возврат', sectionName: 'Доходы', categoryIcon: '↩️', sectionIcon: '💵', categoryColor: '#2dd4bf', sectionColor: '#16a34a', keywords: ['возврат','вернули','refund','компенсация','возмещение','отмена покупки','вернули деньги'] },
  { categoryName: 'Подарок', sectionName: 'Доходы', categoryIcon: '🎁', sectionIcon: '💵', categoryColor: '#f472b6', sectionColor: '#16a34a', keywords: ['подарили','подарок деньгами','перевели подарок','день рождения','поздравили'] },
  { categoryName: 'Инвестиции', sectionName: 'Доходы', categoryIcon: '📊', sectionIcon: '💵', categoryColor: '#818cf8', sectionColor: '#16a34a', keywords: ['дивиденды','инвестиции','акции','купон','проценты по вкладу','вклад','доход от инвестиций','облигации'] },
  { categoryName: 'Другое поступление', sectionName: 'Доходы', categoryIcon: '💵', sectionIcon: '💵', categoryColor: '#34d399', sectionColor: '#16a34a', keywords: ['доход','поступление','получил','получила','зачисление','пришли деньги','пополнение'] },
];

const catalog: TaxonomyEntry[] = [
  ...expenseEntries.map((entry) => ({ ...entry, kind: 'expense' as const })),
  ...incomeEntries.map((entry) => ({ ...entry, kind: 'income' as const })),
];

const genericCategoryIcons = new Set(['✨', '⭐', '🌟', '💰', '📌', '🗂️', '']);

function normalize(value: string) {
  return value
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[.,!?;:()\[\]{}«»"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreEntry(text: string, entry: TaxonomyEntry) {
  let score = 0;
  const padded = ` ${text} `;
  for (const rawKeyword of entry.keywords) {
    const keyword = normalize(rawKeyword);
    if (!keyword) continue;
    if (padded.includes(` ${keyword} `)) score += 100 + keyword.length;
    else if (text.includes(keyword)) score += 50 + keyword.length;
  }
  return score;
}

export function resolveTaxonomyForText(params: { kind: TaxonomyKind; title?: string | null; description?: string | null }): TaxonomyMatch {
  const text = normalize(`${params.title ?? ''} ${params.description ?? ''}`);
  const candidates = catalog.filter((entry) => entry.kind === params.kind);

  let best: TaxonomyEntry | null = null;
  let bestScore = 0;
  for (const entry of candidates) {
    const score = scoreEntry(text, entry);
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }

  if (best) {
    const { keywords: _keywords, kind: _kind, ...result } = best;
    return result;
  }

  return params.kind === 'income'
    ? { categoryName: 'Другое поступление', sectionName: 'Доходы', categoryIcon: '💵', sectionIcon: '💵', categoryColor: '#34d399', sectionColor: '#16a34a' }
    : { categoryName: 'Другое', sectionName: 'Прочее', categoryIcon: '🧾', sectionIcon: '📌', categoryColor: '#94a3b8', sectionColor: '#64748b' };
}

export function resolveCategoryAppearance(name: string, kind: TaxonomyKind) {
  return resolveTaxonomyForText({ kind, title: name });
}

export function resolveSectionAppearance(name: string) {
  const text = normalize(name);
  const match = catalog.find((entry) => normalize(entry.sectionName) === text || entry.keywords.some((keyword) => normalize(keyword) === text));
  if (match) return { icon: match.sectionIcon, color: match.sectionColor };
  return { icon: '📌', color: '#64748b' };
}

export function shouldReplaceGenericIcon(icon?: string | null) {
  return genericCategoryIcons.has((icon ?? '').trim());
}
