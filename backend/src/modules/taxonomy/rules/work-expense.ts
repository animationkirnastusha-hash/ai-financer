import type { TaxonomyIconRule } from '../types';

export const workExpenseRules: TaxonomyIconRule[] = [
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
    }
];
