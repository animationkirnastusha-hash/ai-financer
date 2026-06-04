export type TaxonomyEntryType = 'income' | 'expense' | 'both';

export type TaxonomyIconRule = {
  id: string;
  type: TaxonomyEntryType;
  sectionId: string;
  sectionName: string;
  sectionIcon: string;
  sectionColor: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  keywords: string[];
};

export type ResolvedTaxonomy = {
  type: 'income' | 'expense';
  sectionName: string;
  sectionIcon: string;
  sectionColor: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  confidence: number;
  matchedRuleId: string;
};

export const TAXONOMY_ICON_RULES: TaxonomyIconRule[] = [
  {
    "id": "sausage",
    "type": "expense",
    "sectionId": "groceries",
    "sectionName": "Продукты",
    "sectionIcon": "🛒",
    "sectionColor": "#34D399",
    "categoryName": "Мясо и колбасы",
    "categoryIcon": "🌭",
    "categoryColor": "#34D399",
    "keywords": [
      "колбаса",
      "сосиски",
      "сардельки",
      "ветчина",
      "бекон",
      "салями",
      "мясо",
      "говядина",
      "свинина",
      "курица",
      "индейка",
      "фарш",
      "котлеты",
      "стейк",
      "карбонат",
      "грудинка",
      "докторская",
      "сервелат",
      "купаты",
      "шашлык",
      "куриное филе",
      "окорочка",
      "бедро куриное",
      "мясной магазин",
      "мясницкий ряд",
      "колбасный",
      "пельмени мясо"
    ]
  },
  {
    "id": "dairy",
    "type": "expense",
    "sectionId": "groceries",
    "sectionName": "Продукты",
    "sectionIcon": "🛒",
    "sectionColor": "#34D399",
    "categoryName": "Молочные продукты",
    "categoryIcon": "🥛",
    "categoryColor": "#34D399",
    "keywords": [
      "молоко",
      "кефир",
      "йогурт",
      "сыр",
      "творог",
      "сметана",
      "сливки",
      "масло сливочное",
      "ряженка",
      "айран",
      "моцарелла",
      "пармезан",
      "активиа",
      "данон",
      "простоквашино",
      "домик в деревне",
      "сырок",
      "творожок",
      "биойогурт",
      "маскарпоне",
      "брынза",
      "адыгейский сыр",
      "молочка"
    ]
  },
  {
    "id": "bakery",
    "type": "expense",
    "sectionId": "groceries",
    "sectionName": "Продукты",
    "sectionIcon": "🛒",
    "sectionColor": "#34D399",
    "categoryName": "Хлеб и выпечка",
    "categoryIcon": "🥖",
    "categoryColor": "#34D399",
    "keywords": [
      "хлеб",
      "батон",
      "булка",
      "булочка",
      "лаваш",
      "круассан",
      "пирожок",
      "выпечка",
      "багет",
      "лепешка",
      "пита",
      "пекарня",
      "хлебозавод",
      "буханка",
      "сдоба",
      "баранки",
      "сушки",
      "пирог",
      "пироги",
      "ватрушка",
      "слойка",
      "булочная"
    ]
  },
  {
    "id": "vegetables",
    "type": "expense",
    "sectionId": "groceries",
    "sectionName": "Продукты",
    "sectionIcon": "🛒",
    "sectionColor": "#34D399",
    "categoryName": "Овощи",
    "categoryIcon": "🥦",
    "categoryColor": "#34D399",
    "keywords": [
      "овощи",
      "помидоры",
      "огурцы",
      "картошка",
      "картофель",
      "морковь",
      "лук",
      "капуста",
      "перец",
      "баклажан",
      "кабачок",
      "зелень",
      "салат",
      "свекла",
      "чеснок",
      "овощной",
      "огурчик",
      "томат",
      "черри",
      "авокадо",
      "шпинат",
      "руккола",
      "петрушка",
      "укроп",
      "кинза",
      "сельдерей",
      "редис"
    ]
  },
  {
    "id": "fruits",
    "type": "expense",
    "sectionId": "groceries",
    "sectionName": "Продукты",
    "sectionIcon": "🛒",
    "sectionColor": "#34D399",
    "categoryName": "Фрукты",
    "categoryIcon": "🍎",
    "categoryColor": "#34D399",
    "keywords": [
      "фрукты",
      "яблоки",
      "бананы",
      "апельсины",
      "мандарины",
      "груши",
      "виноград",
      "манго",
      "киви",
      "лимон",
      "арбуз",
      "дыня",
      "персики",
      "ягоды",
      "клубника",
      "малина",
      "фруктовый",
      "голубика",
      "ежевика",
      "смородина",
      "ананас",
      "гранат",
      "слива",
      "абрикос",
      "нектарин",
      "черешня",
      "вишня"
    ]
  },
  {
    "id": "fish",
    "type": "expense",
    "sectionId": "groceries",
    "sectionName": "Продукты",
    "sectionIcon": "🛒",
    "sectionColor": "#34D399",
    "categoryName": "Рыба и морепродукты",
    "categoryIcon": "🐟",
    "categoryColor": "#34D399",
    "keywords": [
      "рыба",
      "лосось",
      "семга",
      "тунец",
      "форель",
      "селедка",
      "креветки",
      "мидии",
      "кальмар",
      "икра",
      "морепродукты",
      "суши набор",
      "рыбный",
      "сельдь",
      "скумбрия",
      "минтай",
      "треска",
      "краб",
      "крабовые палочки",
      "осьминог",
      "устрицы",
      "морской коктейль"
    ]
  },
  {
    "id": "sweets",
    "type": "expense",
    "sectionId": "groceries",
    "sectionName": "Продукты",
    "sectionIcon": "🛒",
    "sectionColor": "#34D399",
    "categoryName": "Сладости",
    "categoryIcon": "🍫",
    "categoryColor": "#34D399",
    "keywords": [
      "шоколад",
      "конфеты",
      "печенье",
      "торт",
      "пирожное",
      "вафли",
      "мармелад",
      "сладости",
      "мороженое",
      "чипсы сладкие",
      "батончик",
      "десерт"
    ]
  },
  {
    "id": "snacks",
    "type": "expense",
    "sectionId": "groceries",
    "sectionName": "Продукты",
    "sectionIcon": "🛒",
    "sectionColor": "#34D399",
    "categoryName": "Снеки",
    "categoryIcon": "🍿",
    "categoryColor": "#34D399",
    "keywords": [
      "чипсы",
      "сухарики",
      "орешки",
      "попкорн",
      "снэки",
      "снеки",
      "крекер",
      "фисташки",
      "арахис",
      "семечки"
    ]
  },
  {
    "id": "water",
    "type": "expense",
    "sectionId": "groceries",
    "sectionName": "Продукты",
    "sectionIcon": "🛒",
    "sectionColor": "#34D399",
    "categoryName": "Вода и напитки",
    "categoryIcon": "🥤",
    "categoryColor": "#34D399",
    "keywords": [
      "вода",
      "газировка",
      "сок",
      "лимонад",
      "кола",
      "напиток",
      "энергетик",
      "чай бутылка",
      "минералка",
      "морс",
      "компот"
    ]
  },
  {
    "id": "coffee",
    "type": "expense",
    "sectionId": "food",
    "sectionName": "Еда вне дома",
    "sectionIcon": "🍽️",
    "sectionColor": "#F59E0B",
    "categoryName": "Кофе",
    "categoryIcon": "☕",
    "categoryColor": "#F59E0B",
    "keywords": [
      "кофе",
      "латте",
      "капучино",
      "американо",
      "эспрессо",
      "раф",
      "кофейня",
      "старбакс",
      "старбак",
      "кофеек",
      "флэт уайт",
      "кофе с собой",
      "кофикс",
      "cofix",
      "кофепорт",
      "кофемания",
      "шоколадница кофе",
      "кофейный",
      "кофе хауз",
      "дубльби",
      "surf coffee",
      "one price coffee"
    ]
  },
  {
    "id": "cafe",
    "type": "expense",
    "sectionId": "food",
    "sectionName": "Еда вне дома",
    "sectionIcon": "🍽️",
    "sectionColor": "#F59E0B",
    "categoryName": "Кафе и рестораны",
    "categoryIcon": "🍽️",
    "categoryColor": "#F59E0B",
    "keywords": [
      "кафе",
      "ресторан",
      "обед",
      "ужин",
      "завтрак",
      "столовая",
      "фастфуд",
      "бургер",
      "пицца",
      "шаурма",
      "роллы",
      "суши",
      "доставка еды",
      "макдональдс",
      "вкусно и точка",
      "kfc",
      "бургер кинг",
      "додо",
      "доминос",
      "теремок",
      "бургер",
      "мак",
      "ростикс",
      "вкусвилл кафе",
      "рест",
      "кафешка",
      "ланч",
      "бизнес ланч",
      "еда доставка"
    ]
  },
  {
    "id": "bar",
    "type": "expense",
    "sectionId": "food",
    "sectionName": "Еда вне дома",
    "sectionIcon": "🍽️",
    "sectionColor": "#F59E0B",
    "categoryName": "Бары",
    "categoryIcon": "🍸",
    "categoryColor": "#F59E0B",
    "keywords": [
      "бар",
      "коктейль",
      "паб",
      "лаунж",
      "кальян",
      "вечеринка",
      "настойка",
      "сидр",
      "безалкогольный бар"
    ]
  },
  {
    "id": "taxi",
    "type": "expense",
    "sectionId": "transport",
    "sectionName": "Транспорт",
    "sectionIcon": "🚕",
    "sectionColor": "#60A5FA",
    "categoryName": "Такси",
    "categoryIcon": "🚕",
    "categoryColor": "#60A5FA",
    "keywords": [
      "такси",
      "яндекс такси",
      "uber",
      "убер",
      "bolt",
      "таксист",
      "поездка на такси",
      "ситимобил",
      "яндекс go",
      "таксопарк",
      "indrive",
      "gettaxi",
      "такси домой",
      "такси аэропорт",
      "поездка домой",
      "такси работа"
    ]
  },
  {
    "id": "public_transport",
    "type": "expense",
    "sectionId": "transport",
    "sectionName": "Транспорт",
    "sectionIcon": "🚕",
    "sectionColor": "#60A5FA",
    "categoryName": "Общественный транспорт",
    "categoryIcon": "🚌",
    "categoryColor": "#60A5FA",
    "keywords": [
      "автобус",
      "метро",
      "трамвай",
      "троллейбус",
      "маршрутка",
      "проезд",
      "транспортная карта",
      "подорожник",
      "тройка",
      "электричка",
      "метрополитен",
      "проездной",
      "единый билет",
      "карта тройка",
      "оплата проезда",
      "транспорт",
      "автобус билет",
      "маршрут"
    ]
  },
  {
    "id": "train",
    "type": "expense",
    "sectionId": "transport",
    "sectionName": "Транспорт",
    "sectionIcon": "🚕",
    "sectionColor": "#60A5FA",
    "categoryName": "Поезда",
    "categoryIcon": "🚆",
    "categoryColor": "#60A5FA",
    "keywords": [
      "поезд",
      "ржд",
      "сапсан",
      "ласточка",
      "купе",
      "плацкарт",
      "жд билет",
      "вокзал"
    ]
  },
  {
    "id": "fuel",
    "type": "expense",
    "sectionId": "auto",
    "sectionName": "Авто",
    "sectionIcon": "⛽",
    "sectionColor": "#FB7185",
    "categoryName": "Бензин",
    "categoryIcon": "⛽",
    "categoryColor": "#FB7185",
    "keywords": [
      "бензин",
      "топливо",
      "заправка",
      "азс",
      "дизель",
      "солярка",
      "газ",
      "gpn",
      "лукойл",
      "роснефть",
      "shell",
      "bp",
      "аи95",
      "аи92",
      "аи98",
      "заправился",
      "полный бак",
      "топливная карта",
      "газпромнефть",
      "татнефть",
      "бензоколонка"
    ]
  },
  {
    "id": "parking",
    "type": "expense",
    "sectionId": "auto",
    "sectionName": "Авто",
    "sectionIcon": "⛽",
    "sectionColor": "#FB7185",
    "categoryName": "Парковка",
    "categoryIcon": "🅿️",
    "categoryColor": "#FB7185",
    "keywords": [
      "парковка",
      "паркинг",
      "платная парковка",
      "штраф парковка",
      "стоянка"
    ]
  },
  {
    "id": "car_service",
    "type": "expense",
    "sectionId": "auto",
    "sectionName": "Авто",
    "sectionIcon": "⛽",
    "sectionColor": "#FB7185",
    "categoryName": "Обслуживание авто",
    "categoryIcon": "🔧",
    "categoryColor": "#FB7185",
    "keywords": [
      "сто",
      "сервис авто",
      "ремонт авто",
      "мойка",
      "шины",
      "резина",
      "масло",
      "техосмотр",
      "запчасти",
      "автосервис"
    ]
  },
  {
    "id": "car_insurance",
    "type": "expense",
    "sectionId": "auto",
    "sectionName": "Авто",
    "sectionIcon": "⛽",
    "sectionColor": "#FB7185",
    "categoryName": "Страховка авто",
    "categoryIcon": "🛡️",
    "categoryColor": "#FB7185",
    "keywords": [
      "осаго",
      "каско",
      "страховка авто",
      "автострахование"
    ]
  },
  {
    "id": "rent",
    "type": "expense",
    "sectionId": "home",
    "sectionName": "Дом",
    "sectionIcon": "🏠",
    "sectionColor": "#A78BFA",
    "categoryName": "Аренда",
    "categoryIcon": "🏘️",
    "categoryColor": "#A78BFA",
    "keywords": [
      "аренда",
      "квартира аренда",
      "съем жилья",
      "найм жилья",
      "снять квартиру",
      "жилье"
    ]
  },
  {
    "id": "mortgage",
    "type": "expense",
    "sectionId": "finance",
    "sectionName": "Финансы",
    "sectionIcon": "🏦",
    "sectionColor": "#FCD34D",
    "categoryName": "Ипотека",
    "categoryIcon": "🏦",
    "categoryColor": "#FCD34D",
    "keywords": [
      "ипотека",
      "ипотечный платеж",
      "кредит за квартиру",
      "жилищный кредит"
    ]
  },
  {
    "id": "repair",
    "type": "expense",
    "sectionId": "home",
    "sectionName": "Дом",
    "sectionIcon": "🏠",
    "sectionColor": "#A78BFA",
    "categoryName": "Ремонт",
    "categoryIcon": "🛠️",
    "categoryColor": "#A78BFA",
    "keywords": [
      "ремонт",
      "стройматериалы",
      "краска",
      "обои",
      "плитка",
      "ламинат",
      "инструменты",
      "двери",
      "сантехника",
      "мебель ремонт"
    ]
  },
  {
    "id": "furniture",
    "type": "expense",
    "sectionId": "home",
    "sectionName": "Дом",
    "sectionIcon": "🏠",
    "sectionColor": "#A78BFA",
    "categoryName": "Мебель",
    "categoryIcon": "🛋️",
    "categoryColor": "#A78BFA",
    "keywords": [
      "мебель",
      "диван",
      "кровать",
      "стол",
      "стул",
      "шкаф",
      "матрас",
      "тумба",
      "комод",
      "ikea",
      "икеа"
    ]
  },
  {
    "id": "household",
    "type": "expense",
    "sectionId": "home",
    "sectionName": "Дом",
    "sectionIcon": "🏠",
    "sectionColor": "#A78BFA",
    "categoryName": "Бытовые товары",
    "categoryIcon": "🧽",
    "categoryColor": "#A78BFA",
    "keywords": [
      "бытовая химия",
      "порошок",
      "моющее",
      "губки",
      "салфетки",
      "туалетная бумага",
      "хозтовары",
      "уборка",
      "перчатки"
    ]
  },
  {
    "id": "electricity",
    "type": "expense",
    "sectionId": "utilities",
    "sectionName": "Коммунальные услуги",
    "sectionIcon": "💡",
    "sectionColor": "#38BDF8",
    "categoryName": "Электричество",
    "categoryIcon": "💡",
    "categoryColor": "#38BDF8",
    "keywords": [
      "электричество",
      "свет",
      "энергия",
      "электроэнергия",
      "мосэнергосбыт"
    ]
  },
  {
    "id": "water_bill",
    "type": "expense",
    "sectionId": "utilities",
    "sectionName": "Коммунальные услуги",
    "sectionIcon": "💡",
    "sectionColor": "#38BDF8",
    "categoryName": "Вода",
    "categoryIcon": "🚿",
    "categoryColor": "#38BDF8",
    "keywords": [
      "водоснабжение",
      "вода счет",
      "горячая вода",
      "холодная вода",
      "водоканал"
    ]
  },
  {
    "id": "gas_bill",
    "type": "expense",
    "sectionId": "utilities",
    "sectionName": "Коммунальные услуги",
    "sectionIcon": "💡",
    "sectionColor": "#38BDF8",
    "categoryName": "Газ",
    "categoryIcon": "🔥",
    "categoryColor": "#38BDF8",
    "keywords": [
      "газ коммуналка",
      "газоснабжение",
      "газпром межрегионгаз"
    ]
  },
  {
    "id": "internet",
    "type": "expense",
    "sectionId": "utilities",
    "sectionName": "Коммунальные услуги",
    "sectionIcon": "💡",
    "sectionColor": "#38BDF8",
    "categoryName": "Интернет",
    "categoryIcon": "🌐",
    "categoryColor": "#38BDF8",
    "keywords": [
      "интернет",
      "wi-fi",
      "вайфай",
      "провайдер",
      "домашний интернет",
      "роутер",
      "мгтс",
      "ростелеком"
    ]
  },
  {
    "id": "mobile",
    "type": "expense",
    "sectionId": "utilities",
    "sectionName": "Коммунальные услуги",
    "sectionIcon": "💡",
    "sectionColor": "#38BDF8",
    "categoryName": "Мобильная связь",
    "categoryIcon": "📶",
    "categoryColor": "#38BDF8",
    "keywords": [
      "телефон",
      "мобильная связь",
      "симка",
      "тариф",
      "сотовая связь",
      "мтс",
      "билайн",
      "мегафон",
      "tele2",
      "йота",
      "yota"
    ]
  },
  {
    "id": "streaming",
    "type": "expense",
    "sectionId": "subscriptions",
    "sectionName": "Подписки",
    "sectionIcon": "🔁",
    "sectionColor": "#818CF8",
    "categoryName": "Кино и музыка",
    "categoryIcon": "🎬",
    "categoryColor": "#818CF8",
    "keywords": [
      "netflix",
      "нетфликс",
      "ivi",
      "кинопоиск",
      "okko",
      "wink",
      "spotify",
      "яндекс музыка",
      "apple music",
      "youtube premium",
      "стриминг",
      "подписка кино",
      "музыка подписка",
      "amediateka",
      "more tv",
      "premier",
      "start",
      "твич",
      "twitch",
      "бусти",
      "boosty",
      "patreon",
      "telegram premium"
    ]
  },
  {
    "id": "software",
    "type": "expense",
    "sectionId": "subscriptions",
    "sectionName": "Подписки",
    "sectionIcon": "🔁",
    "sectionColor": "#818CF8",
    "categoryName": "Приложения и сервисы",
    "categoryIcon": "🧩",
    "categoryColor": "#818CF8",
    "keywords": [
      "подписка",
      "сервис",
      "приложение",
      "icloud",
      "google one",
      "notion",
      "figma",
      "adobe",
      "canva",
      "vpn",
      "антивирус",
      "openai",
      "chatgpt",
      "нейросеть",
      "github",
      "gitlab",
      "jetbrains",
      "cursor",
      "midjourney",
      "claude",
      "perplexity",
      "zoom",
      "slack",
      "microsoft 365",
      "office 365"
    ]
  },
  {
    "id": "games_sub",
    "type": "expense",
    "sectionId": "subscriptions",
    "sectionName": "Подписки",
    "sectionIcon": "🔁",
    "sectionColor": "#818CF8",
    "categoryName": "Игровые подписки",
    "categoryIcon": "🎮",
    "categoryColor": "#818CF8",
    "keywords": [
      "game pass",
      "ps plus",
      "playstation plus",
      "xbox",
      "steam подписка",
      "игровая подписка"
    ]
  },
  {
    "id": "pharmacy",
    "type": "expense",
    "sectionId": "health",
    "sectionName": "Здоровье",
    "sectionIcon": "🩺",
    "sectionColor": "#F87171",
    "categoryName": "Аптека",
    "categoryIcon": "💊",
    "categoryColor": "#F87171",
    "keywords": [
      "аптека",
      "лекарства",
      "таблетки",
      "витамины",
      "мазь",
      "капли",
      "антибиотик",
      "обезболивающее",
      "фармация",
      "36.6",
      "ригла",
      "аптека ру",
      "аптечный",
      "здравсити",
      "парацетамол",
      "ибупрофен",
      "нурофен",
      "аспирин",
      "ингавирин",
      "омега"
    ]
  },
  {
    "id": "doctor",
    "type": "expense",
    "sectionId": "health",
    "sectionName": "Здоровье",
    "sectionIcon": "🩺",
    "sectionColor": "#F87171",
    "categoryName": "Врач",
    "categoryIcon": "🩺",
    "categoryColor": "#F87171",
    "keywords": [
      "врач",
      "доктор",
      "клиника",
      "анализы",
      "прием врача",
      "стоматолог",
      "зубы",
      "терапевт",
      "узи",
      "мрт",
      "медицина",
      "инвитро",
      "гемотест",
      "смд",
      "cmd",
      "поликлиника",
      "медцентр",
      "медси",
      "стоматология",
      "ортодонт",
      "пломба",
      "чистка зубов"
    ]
  },
  {
    "id": "fitness",
    "type": "expense",
    "sectionId": "sports",
    "sectionName": "Спорт",
    "sectionIcon": "🏋️",
    "sectionColor": "#34D399",
    "categoryName": "Фитнес",
    "categoryIcon": "🏋️",
    "categoryColor": "#34D399",
    "keywords": [
      "фитнес",
      "спортзал",
      "тренажерный зал",
      "абонемент",
      "тренер",
      "йога",
      "пилатес",
      "бассейн",
      "секция",
      "спорт"
    ]
  },
  {
    "id": "haircut",
    "type": "expense",
    "sectionId": "beauty",
    "sectionName": "Красота",
    "sectionIcon": "💅",
    "sectionColor": "#F472B6",
    "categoryName": "Парикмахер",
    "categoryIcon": "💇",
    "categoryColor": "#F472B6",
    "keywords": [
      "стрижка",
      "барбер",
      "парикмахер",
      "салон",
      "волосы",
      "окрашивание",
      "укладка"
    ]
  },
  {
    "id": "cosmetics",
    "type": "expense",
    "sectionId": "beauty",
    "sectionName": "Красота",
    "sectionIcon": "💅",
    "sectionColor": "#F472B6",
    "categoryName": "Косметика",
    "categoryIcon": "💄",
    "categoryColor": "#F472B6",
    "keywords": [
      "косметика",
      "крем",
      "помада",
      "тушь",
      "духи",
      "парфюм",
      "уход",
      "шампунь",
      "гель",
      "мейкап"
    ]
  },
  {
    "id": "manicure",
    "type": "expense",
    "sectionId": "beauty",
    "sectionName": "Красота",
    "sectionIcon": "💅",
    "sectionColor": "#F472B6",
    "categoryName": "Маникюр",
    "categoryIcon": "💅",
    "categoryColor": "#F472B6",
    "keywords": [
      "маникюр",
      "педикюр",
      "ногти",
      "шеллак",
      "лак"
    ]
  },
  {
    "id": "clothes",
    "type": "expense",
    "sectionId": "clothes",
    "sectionName": "Одежда",
    "sectionIcon": "👕",
    "sectionColor": "#C084FC",
    "categoryName": "Одежда",
    "categoryIcon": "👕",
    "categoryColor": "#C084FC",
    "keywords": [
      "одежда",
      "футболка",
      "джинсы",
      "куртка",
      "пальто",
      "рубашка",
      "свитер",
      "платье",
      "брюки",
      "носки",
      "белье",
      "zara",
      "uniqlo",
      "hm",
      "ostin",
      "befree",
      "lamoda",
      "wildberries одежда",
      "ozon одежда",
      "спортмастер одежда",
      "курточка"
    ]
  },
  {
    "id": "shoes",
    "type": "expense",
    "sectionId": "clothes",
    "sectionName": "Одежда",
    "sectionIcon": "👕",
    "sectionColor": "#C084FC",
    "categoryName": "Обувь",
    "categoryIcon": "👟",
    "categoryColor": "#C084FC",
    "keywords": [
      "обувь",
      "кроссовки",
      "ботинки",
      "сапоги",
      "туфли",
      "кеды",
      "сандали"
    ]
  },
  {
    "id": "accessories",
    "type": "expense",
    "sectionId": "clothes",
    "sectionName": "Одежда",
    "sectionIcon": "👕",
    "sectionColor": "#C084FC",
    "categoryName": "Аксессуары",
    "categoryIcon": "👜",
    "categoryColor": "#C084FC",
    "keywords": [
      "сумка",
      "рюкзак",
      "кошелек",
      "ремень",
      "часы",
      "очки",
      "аксессуары",
      "украшения",
      "цепочка",
      "кольцо"
    ]
  },
  {
    "id": "phone",
    "type": "expense",
    "sectionId": "electronics",
    "sectionName": "Техника",
    "sectionIcon": "📱",
    "sectionColor": "#60A5FA",
    "categoryName": "Телефон",
    "categoryIcon": "📱",
    "categoryColor": "#60A5FA",
    "keywords": [
      "телефон",
      "смартфон",
      "айфон",
      "iphone",
      "android",
      "чехол",
      "зарядка",
      "стекло",
      "powerbank",
      "пауэрбанк",
      "связной",
      "мвидео телефон",
      "dns телефон",
      "apple store",
      "app store",
      "ремонт телефона",
      "сим карта",
      "мобильник",
      "смартфон аксессуар"
    ]
  },
  {
    "id": "computer",
    "type": "expense",
    "sectionId": "electronics",
    "sectionName": "Техника",
    "sectionIcon": "📱",
    "sectionColor": "#60A5FA",
    "categoryName": "Компьютер",
    "categoryIcon": "💻",
    "categoryColor": "#60A5FA",
    "keywords": [
      "ноутбук",
      "компьютер",
      "пк",
      "монитор",
      "клавиатура",
      "мышка",
      "ssd",
      "процессор",
      "видеокарта",
      "планшет",
      "ipad"
    ]
  },
  {
    "id": "appliance",
    "type": "expense",
    "sectionId": "electronics",
    "sectionName": "Техника",
    "sectionIcon": "📱",
    "sectionColor": "#60A5FA",
    "categoryName": "Бытовая техника",
    "categoryIcon": "🔌",
    "categoryColor": "#60A5FA",
    "keywords": [
      "холодильник",
      "стиральная машина",
      "чайник",
      "микроволновка",
      "пылесос",
      "кофемашина",
      "духовка",
      "посудомойка"
    ]
  },
  {
    "id": "children",
    "type": "expense",
    "sectionId": "family",
    "sectionName": "Семья",
    "sectionIcon": "👨‍👩‍👧",
    "sectionColor": "#FBBF24",
    "categoryName": "Дети",
    "categoryIcon": "🧸",
    "categoryColor": "#FBBF24",
    "keywords": [
      "дети",
      "ребенок",
      "школа ребенку",
      "садик",
      "игрушки",
      "подгузники",
      "детское",
      "кружок",
      "детский",
      "детский мир",
      "акушерство",
      "школьная форма",
      "учеба ребенок",
      "садик оплата",
      "секция ребенку",
      "игрушка ребенку",
      "памперсы"
    ]
  },
  {
    "id": "parents",
    "type": "expense",
    "sectionId": "family",
    "sectionName": "Семья",
    "sectionIcon": "👨‍👩‍👧",
    "sectionColor": "#FBBF24",
    "categoryName": "Родители и семья",
    "categoryIcon": "👨‍👩‍👧",
    "categoryColor": "#FBBF24",
    "keywords": [
      "мама",
      "папа",
      "родители",
      "семья помощь",
      "родным",
      "бабушка",
      "дедушка"
    ]
  },
  {
    "id": "pets_food",
    "type": "expense",
    "sectionId": "pets",
    "sectionName": "Питомцы",
    "sectionIcon": "🐾",
    "sectionColor": "#A3E635",
    "categoryName": "Корм для питомца",
    "categoryIcon": "🐶",
    "categoryColor": "#A3E635",
    "keywords": [
      "корм",
      "кот",
      "кошка",
      "собака",
      "питомец",
      "животное",
      "наполнитель",
      "зоомагазин",
      "ветеринар",
      "ветклиника"
    ]
  },
  {
    "id": "cinema",
    "type": "expense",
    "sectionId": "entertainment",
    "sectionName": "Развлечения",
    "sectionIcon": "🎮",
    "sectionColor": "#22D3EE",
    "categoryName": "Кино и события",
    "categoryIcon": "🎟️",
    "categoryColor": "#22D3EE",
    "keywords": [
      "кино",
      "театр",
      "концерт",
      "билет",
      "мероприятие",
      "выставка",
      "музей",
      "стендап",
      "цирк",
      "фестиваль"
    ]
  },
  {
    "id": "games",
    "type": "expense",
    "sectionId": "entertainment",
    "sectionName": "Развлечения",
    "sectionIcon": "🎮",
    "sectionColor": "#22D3EE",
    "categoryName": "Игры",
    "categoryIcon": "🎮",
    "categoryColor": "#22D3EE",
    "keywords": [
      "игра",
      "игры",
      "steam",
      "стим",
      "playstation",
      "ps store",
      "xbox",
      "донат",
      "внутриигровая покупка",
      "roblox",
      "steam purchase",
      "epic games",
      "genshin",
      "pubg",
      "dota",
      "cs go",
      "minecraft",
      "fortnite",
      "донат игра"
    ]
  },
  {
    "id": "books",
    "type": "expense",
    "sectionId": "education",
    "sectionName": "Образование",
    "sectionIcon": "🎓",
    "sectionColor": "#4ADE80",
    "categoryName": "Книги",
    "categoryIcon": "📚",
    "categoryColor": "#4ADE80",
    "keywords": [
      "книга",
      "книги",
      "литрес",
      "учебник",
      "журнал",
      "комикс",
      "аудиокнига"
    ]
  },
  {
    "id": "courses",
    "type": "expense",
    "sectionId": "education",
    "sectionName": "Образование",
    "sectionIcon": "🎓",
    "sectionColor": "#4ADE80",
    "categoryName": "Курсы",
    "categoryIcon": "🎓",
    "categoryColor": "#4ADE80",
    "keywords": [
      "курс",
      "курсы",
      "обучение",
      "школа",
      "университет",
      "вебинар",
      "урок",
      "репетитор",
      "английский",
      "образование",
      "skyeng",
      "skillbox",
      "нетология",
      "coursera",
      "udemy",
      "stepik",
      "geekbrains",
      "репетитор математика",
      "урок английского"
    ]
  },
  {
    "id": "flights",
    "type": "expense",
    "sectionId": "travel",
    "sectionName": "Путешествия",
    "sectionIcon": "✈️",
    "sectionColor": "#2DD4BF",
    "categoryName": "Авиабилеты",
    "categoryIcon": "✈️",
    "categoryColor": "#2DD4BF",
    "keywords": [
      "самолет",
      "авиабилет",
      "авиа",
      "перелет",
      "аэропорт",
      "s7",
      "аэрофлот",
      "победа",
      "utair"
    ]
  },
  {
    "id": "hotel",
    "type": "expense",
    "sectionId": "travel",
    "sectionName": "Путешествия",
    "sectionIcon": "✈️",
    "sectionColor": "#2DD4BF",
    "categoryName": "Отели",
    "categoryIcon": "🏨",
    "categoryColor": "#2DD4BF",
    "keywords": [
      "отель",
      "гостиница",
      "хостел",
      "airbnb",
      "апартаменты",
      "бронь жилья",
      "проживание"
    ]
  },
  {
    "id": "vacation",
    "type": "expense",
    "sectionId": "travel",
    "sectionName": "Путешествия",
    "sectionIcon": "✈️",
    "sectionColor": "#2DD4BF",
    "categoryName": "Отпуск",
    "categoryIcon": "🏖️",
    "categoryColor": "#2DD4BF",
    "keywords": [
      "отпуск",
      "тур",
      "путевка",
      "курорт",
      "пляж",
      "экскурсия",
      "путешествие",
      "поездка"
    ]
  },
  {
    "id": "visa",
    "type": "expense",
    "sectionId": "travel",
    "sectionName": "Путешествия",
    "sectionIcon": "✈️",
    "sectionColor": "#2DD4BF",
    "categoryName": "Визы и документы",
    "categoryIcon": "🛂",
    "categoryColor": "#2DD4BF",
    "keywords": [
      "виза",
      "загранпаспорт",
      "паспорт",
      "страховка туриста",
      "документы поездка"
    ]
  },
  {
    "id": "loan",
    "type": "expense",
    "sectionId": "finance",
    "sectionName": "Финансы",
    "sectionIcon": "🏦",
    "sectionColor": "#FCD34D",
    "categoryName": "Кредиты",
    "categoryIcon": "💳",
    "categoryColor": "#FCD34D",
    "keywords": [
      "кредит",
      "займ",
      "платеж по кредиту",
      "рассрочка",
      "долг",
      "микрозайм",
      "погашение кредита"
    ]
  },
  {
    "id": "bank_fee",
    "type": "expense",
    "sectionId": "finance",
    "sectionName": "Финансы",
    "sectionIcon": "🏦",
    "sectionColor": "#FCD34D",
    "categoryName": "Банковские комиссии",
    "categoryIcon": "🏦",
    "categoryColor": "#FCD34D",
    "keywords": [
      "комиссия",
      "банковская комиссия",
      "обслуживание карты",
      "смс банк",
      "плата банка"
    ]
  },
  {
    "id": "tax",
    "type": "expense",
    "sectionId": "finance",
    "sectionName": "Финансы",
    "sectionIcon": "🏦",
    "sectionColor": "#FCD34D",
    "categoryName": "Налоги",
    "categoryIcon": "🧾",
    "categoryColor": "#FCD34D",
    "keywords": [
      "налог",
      "налоги",
      "фнс",
      "патент",
      "самозанятый налог",
      "усн",
      "страховые взносы"
    ]
  },
  {
    "id": "gift",
    "type": "expense",
    "sectionId": "gifts",
    "sectionName": "Подарки",
    "sectionIcon": "🎁",
    "sectionColor": "#FB7185",
    "categoryName": "Подарки",
    "categoryIcon": "🎁",
    "categoryColor": "#FB7185",
    "keywords": [
      "подарок",
      "подарки",
      "цветы",
      "сувенир",
      "день рождения",
      "праздник",
      "донат подарок"
    ]
  },
  {
    "id": "charity",
    "type": "expense",
    "sectionId": "gifts",
    "sectionName": "Подарки",
    "sectionIcon": "🎁",
    "sectionColor": "#FB7185",
    "categoryName": "Благотворительность",
    "categoryIcon": "🤝",
    "categoryColor": "#FB7185",
    "keywords": [
      "благотворительность",
      "донат",
      "пожертвование",
      "помощь",
      "сбор"
    ]
  },
  {
    "id": "office",
    "type": "expense",
    "sectionId": "work",
    "sectionName": "Работа",
    "sectionIcon": "💼",
    "sectionColor": "#94A3B8",
    "categoryName": "Офис и работа",
    "categoryIcon": "💼",
    "categoryColor": "#94A3B8",
    "keywords": [
      "офис",
      "канцелярия",
      "бумага",
      "ручки",
      "печать",
      "коворкинг",
      "рабочее место"
    ]
  },
  {
    "id": "business_expense",
    "type": "expense",
    "sectionId": "business",
    "sectionName": "Бизнес",
    "sectionIcon": "📊",
    "sectionColor": "#38BDF8",
    "categoryName": "Бизнес-расходы",
    "categoryIcon": "📊",
    "categoryColor": "#38BDF8",
    "keywords": [
      "бизнес расход",
      "закупка",
      "поставщик",
      "маркетинг",
      "реклама",
      "доставка клиенту",
      "командировка"
    ]
  },
  {
    "id": "salary",
    "type": "income",
    "sectionId": "income",
    "sectionName": "Доходы",
    "sectionIcon": "💰",
    "sectionColor": "#34D399",
    "categoryName": "Зарплата",
    "categoryIcon": "💰",
    "categoryColor": "#34D399",
    "keywords": [
      "зарплата",
      "аванс",
      "зп",
      "оклад",
      "получил зарплату",
      "премия",
      "работодатель",
      "перечисление зарплаты",
      "зарплатный проект",
      "получка",
      "месячная зарплата",
      "заработная плата"
    ]
  },
  {
    "id": "freelance",
    "type": "income",
    "sectionId": "income",
    "sectionName": "Доходы",
    "sectionIcon": "💰",
    "sectionColor": "#34D399",
    "categoryName": "Фриланс",
    "categoryIcon": "🧑‍💻",
    "categoryColor": "#34D399",
    "keywords": [
      "фриланс",
      "заказ",
      "клиент оплатил",
      "оплата проекта",
      "подработка",
      "гонорар",
      "фрилансер",
      "upwork",
      "kwork",
      "freelancehunt",
      "заказчик",
      "проект оплатили",
      "оплата работы",
      "работа на стороне"
    ]
  },
  {
    "id": "business_income",
    "type": "income",
    "sectionId": "business",
    "sectionName": "Бизнес",
    "sectionIcon": "📊",
    "sectionColor": "#38BDF8",
    "categoryName": "Бизнес-доход",
    "categoryIcon": "📈",
    "categoryColor": "#38BDF8",
    "keywords": [
      "выручка",
      "продажа",
      "оплата клиента",
      "доход бизнеса",
      "поступление от клиента",
      "касса"
    ]
  },
  {
    "id": "cashback",
    "type": "income",
    "sectionId": "finance",
    "sectionName": "Финансы",
    "sectionIcon": "🏦",
    "sectionColor": "#FCD34D",
    "categoryName": "Кэшбэк",
    "categoryIcon": "💸",
    "categoryColor": "#FCD34D",
    "keywords": [
      "кэшбек",
      "cashback",
      "бонусы",
      "проценты на остаток",
      "возврат бонусов",
      "тинькофф кэшбек",
      "тбанк кэшбек",
      "альфа бонус",
      "сберспасибо",
      "бонусная программа",
      "мили",
      "баллы"
    ]
  },
  {
    "id": "refund",
    "type": "income",
    "sectionId": "finance",
    "sectionName": "Финансы",
    "sectionIcon": "🏦",
    "sectionColor": "#FCD34D",
    "categoryName": "Возврат",
    "categoryIcon": "↩️",
    "categoryColor": "#FCD34D",
    "keywords": [
      "возврат",
      "вернули деньги",
      "refund",
      "компенсация",
      "возмещение"
    ]
  },
  {
    "id": "gift_income",
    "type": "income",
    "sectionId": "gifts",
    "sectionName": "Подарки",
    "sectionIcon": "🎁",
    "sectionColor": "#FB7185",
    "categoryName": "Подаренные деньги",
    "categoryIcon": "🎁",
    "categoryColor": "#FB7185",
    "keywords": [
      "подарили деньги",
      "подарок деньгами",
      "перевели подарок",
      "денежный подарок"
    ]
  },
  {
    "id": "investment_income",
    "type": "income",
    "sectionId": "finance",
    "sectionName": "Финансы",
    "sectionIcon": "🏦",
    "sectionColor": "#FCD34D",
    "categoryName": "Инвестиции",
    "categoryIcon": "📈",
    "categoryColor": "#FCD34D",
    "keywords": [
      "дивиденды",
      "купон",
      "инвестиции доход",
      "прибыль акции",
      "проценты вклад",
      "вклад"
    ]
  },
  {
    "id": "rental_income",
    "type": "income",
    "sectionId": "finance",
    "sectionName": "Финансы",
    "sectionIcon": "🏦",
    "sectionColor": "#FCD34D",
    "categoryName": "Арендный доход",
    "categoryIcon": "🏘️",
    "categoryColor": "#FCD34D",
    "keywords": [
      "аренда доход",
      "сдал квартиру",
      "арендатор заплатил",
      "доход от аренды"
    ]
  },
  {
    "id": "extra_0",
    "type": "expense",
    "sectionId": "groceries",
    "sectionName": "Продукты",
    "sectionIcon": "🛒",
    "sectionColor": "#34D399",
    "categoryName": "Продукты",
    "categoryIcon": "🛒",
    "categoryColor": "#34D399",
    "keywords": [
      "пятерочка",
      "перекресток",
      "магнит",
      "лента",
      "ашан",
      "вкусвилл",
      "самокат",
      "лавка",
      "окей",
      "metro",
      "глобус",
      "дикси",
      "верный",
      "монетка",
      "ярче",
      "spar",
      "азбука вкуса",
      "delivery club продукты",
      "sbermarket",
      "купил продукты",
      "продуктовый магазин",
      "еда домой"
    ]
  },
  {
    "id": "extra_1",
    "type": "expense",
    "sectionId": "electronics",
    "sectionName": "Техника",
    "sectionIcon": "📱",
    "sectionColor": "#60A5FA",
    "categoryName": "Техника и электроника",
    "categoryIcon": "📱",
    "categoryColor": "#60A5FA",
    "keywords": [
      "dns",
      "мвидео",
      "эльдорадо",
      "ситилинк",
      "re store",
      "apple",
      "xiaomi",
      "samsung",
      "huawei",
      "honor",
      "техника",
      "электроника",
      "гаджет",
      "наушники",
      "airpods",
      "колонка",
      "телевизор",
      "камера",
      "принтер",
      "сканер"
    ]
  },
  {
    "id": "extra_2",
    "type": "expense",
    "sectionId": "home",
    "sectionName": "Дом",
    "sectionIcon": "🏠",
    "sectionColor": "#A78BFA",
    "categoryName": "Дом и быт",
    "categoryIcon": "🏠",
    "categoryColor": "#A78BFA",
    "keywords": [
      "леруа",
      "obi",
      "петрович",
      "hoff",
      "home market",
      "посуда",
      "тарелки",
      "сковорода",
      "кастрюля",
      "ножи",
      "подушка",
      "одеяло",
      "плед",
      "шторы",
      "лампа",
      "светильник",
      "ковер",
      "декор"
    ]
  },
  {
    "id": "extra_3",
    "type": "expense",
    "sectionId": "beauty",
    "sectionName": "Красота",
    "sectionIcon": "💅",
    "sectionColor": "#F472B6",
    "categoryName": "Красота и уход",
    "categoryIcon": "💅",
    "categoryColor": "#F472B6",
    "keywords": [
      "летуаль",
      "рив гош",
      "золотое яблоко",
      "подружка",
      "магнит косметик",
      "уход за лицом",
      "уход за телом",
      "спа",
      "массаж",
      "брови",
      "ресницы",
      "косметолог",
      "эпиляция"
    ]
  },
  {
    "id": "extra_4",
    "type": "expense",
    "sectionId": "travel",
    "sectionName": "Путешествия",
    "sectionIcon": "✈️",
    "sectionColor": "#2DD4BF",
    "categoryName": "Путешествия",
    "categoryIcon": "✈️",
    "categoryColor": "#2DD4BF",
    "keywords": [
      "booking",
      "ostrovok",
      "aviasales",
      "tutu",
      "яндекс путешествия",
      "суточно",
      "trip",
      "билеты самолет",
      "билеты поезд",
      "отпуск расходы",
      "чемодан",
      "багаж",
      "трансфер",
      "экскурсии"
    ]
  },
  {
    "id": "extra_5",
    "type": "expense",
    "sectionId": "finance",
    "sectionName": "Финансы",
    "sectionIcon": "🏦",
    "sectionColor": "#FCD34D",
    "categoryName": "Финансы",
    "categoryIcon": "🏦",
    "categoryColor": "#FCD34D",
    "keywords": [
      "сбер",
      "тинькофф",
      "тбанк",
      "альфа банк",
      "втб",
      "озон банк",
      "райффайзен",
      "газпромбанк",
      "банк",
      "перевод себе",
      "комиссия банка",
      "обслуживание",
      "проценты",
      "страховка"
    ]
  }
];

export const TAXONOMY_ICON_ENTRY_COUNT = TAXONOMY_ICON_RULES.reduce((sum, item) => sum + item.keywords.length + 1, 0);

const CATEGORY_COLOR_PALETTE = [
  '#34D399', '#60A5FA', '#FBBF24', '#F87171', '#C4B5FD', '#2DD4BF', '#F472B6', '#A3E635',
  '#FB923C', '#38BDF8', '#818CF8', '#FACC15', '#22C55E', '#06B6D4', '#E879F9', '#F97316',
];

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function stableCategoryColor(value: string) {
  return CATEGORY_COLOR_PALETTE[hashString(value) % CATEGORY_COLOR_PALETTE.length];
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[.,!?;:()\[\]{}«»"'`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string) {
  return normalizeText(value).split(' ').filter((token) => token.length >= 2);
}

function scoreKeyword(query: string, queryTokens: string[], keyword: string) {
  const current = normalizeText(keyword);
  if (!current) return 0;
  if (query === current) return 1000 + current.length;
  if (query.includes(current)) return 420 + current.length;
  if (current.includes(query) && query.length >= 4) return 260 + query.length;

  const keywordTokens = tokenize(current);
  if (keywordTokens.length === 0) return 0;

  let score = 0;
  for (const token of queryTokens) {
    if (keywordTokens.includes(token)) score += 90 + token.length;
    else if (keywordTokens.some((item) => item.includes(token) || token.includes(item))) score += 38 + token.length;
  }

  if (keywordTokens.every((token) => queryTokens.includes(token))) score += 160;
  return score;
}

export function resolveTaxonomyIcon(rawText: string, type: 'income' | 'expense'): ResolvedTaxonomy {
  const query = normalizeText(rawText || '');
  const queryTokens = tokenize(query);
  const candidates = TAXONOMY_ICON_RULES.filter((item) => item.type === type || item.type === 'both');

  let best: { rule: TaxonomyIconRule; score: number } | null = null;

  for (const rule of candidates) {
    const labels = [rule.categoryName, rule.sectionName, ...rule.keywords];
    const score = labels.reduce((sum, keyword) => Math.max(sum, scoreKeyword(query, queryTokens, keyword)), 0);
    if (!best || score > best.score) best = { rule, score };
  }

  const fallback = type === 'income'
    ? {
        id: 'income_other', type: 'income' as const, sectionId: 'income', sectionName: 'Доходы', sectionIcon: '💰', sectionColor: '#34D399', categoryName: 'Доход', categoryIcon: '💰', categoryColor: '#34D399', keywords: [],
      }
    : {
        id: 'expense_other', type: 'expense' as const, sectionId: 'other', sectionName: 'Другое', sectionIcon: '📌', sectionColor: '#94A3B8', categoryName: 'Другое', categoryIcon: '🧾', categoryColor: '#94A3B8', keywords: [],
      };

  const chosen = best && best.score >= 70 ? best.rule : fallback;
  const confidence = best && best.score >= 70 ? Math.min(0.99, best.score / 1000) : 0.25;

  return {
    type,
    sectionName: chosen.sectionName,
    sectionIcon: chosen.sectionIcon,
    sectionColor: chosen.sectionColor,
    categoryName: chosen.categoryName,
    categoryIcon: chosen.categoryIcon,
    categoryColor: stableCategoryColor(`${type}:${chosen.categoryName}:${chosen.id}`),
    confidence,
    matchedRuleId: chosen.id,
  };
}

export function resolveSectionIcon(rawName: string) {
  const resolvedExpense = resolveTaxonomyIcon(rawName, 'expense');
  const resolvedIncome = resolveTaxonomyIcon(rawName, 'income');
  const resolved = resolvedExpense.confidence >= resolvedIncome.confidence ? resolvedExpense : resolvedIncome;
  return { icon: resolved.sectionIcon, color: resolved.sectionColor, name: resolved.sectionName };
}

export function resolveCategoryIcon(rawName: string, type: 'income' | 'expense' = 'expense') {
  const resolved = resolveTaxonomyIcon(rawName, type);
  return { icon: resolved.categoryIcon, color: resolved.categoryColor, sectionName: resolved.sectionName, sectionIcon: resolved.sectionIcon, sectionColor: resolved.sectionColor };
}


export type TaxonomyKind = 'expense' | 'income';

export type TaxonomyMatch = {
  categoryName: string;
  sectionName: string;
  categoryIcon: string;
  sectionIcon: string;
  categoryColor: string;
  sectionColor: string;
};

const GENERIC_TAXONOMY_ICONS = new Set(['✨', '⭐', '🌟', '📌', '🗂️', '']);

export function shouldReplaceGenericIcon(icon?: string | null) {
  return GENERIC_TAXONOMY_ICONS.has((icon ?? '').trim());
}

export function resolveTaxonomyForText(params: { kind: TaxonomyKind; title?: string | null; description?: string | null }): TaxonomyMatch {
  const resolved = resolveTaxonomyIcon(`${params.title ?? ''} ${params.description ?? ''}`, params.kind);
  return {
    categoryName: resolved.categoryName,
    sectionName: resolved.sectionName,
    categoryIcon: resolved.categoryIcon || (params.kind === 'income' ? '💵' : '🧾'),
    sectionIcon: resolved.sectionIcon || (params.kind === 'income' ? '💵' : '📌'),
    categoryColor: resolved.categoryColor,
    sectionColor: resolved.sectionColor,
  };
}

export function resolveCategoryAppearance(name: string, kind: TaxonomyKind) {
  return resolveTaxonomyForText({ kind, title: name });
}

export function resolveSectionAppearance(name: string) {
  const resolvedExpense = resolveTaxonomyForText({ kind: 'expense', title: name });
  const resolvedIncome = resolveTaxonomyForText({ kind: 'income', title: name });
  const isIncome = resolvedIncome.sectionName.toLowerCase() === name.toLowerCase() || resolvedIncome.categoryName.toLowerCase() === name.toLowerCase();
  const resolved = isIncome ? resolvedIncome : resolvedExpense;
  return { icon: resolved.sectionIcon, color: resolved.sectionColor };
}
