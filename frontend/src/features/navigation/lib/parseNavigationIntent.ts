import type { AppScreen } from '@/features/navigation/model/navigation.store';

export type NavigationIntent =
  | { type: 'none' }
  | { type: 'go_back' }
  | { type: 'open_screen'; screen: AppScreen }
  | { type: 'open_text_chat' };

function includesAny(input: string, variants: string[]) {
  return variants.some((variant) => input.includes(variant));
}

function normalize(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[.,!?;:]/g, ' ')
    .replace(/\s+/g, ' ');
}

function detectScreen(input: string): AppScreen | null {
  if (includesAny(input, ['админ', 'админка', 'admin', 'панель администратора'])) return 'admin';
  if (includesAny(input, ['магазин', 'store', 'стор', 'тарифы', 'купить премиум', 'premium', 'business'])) return 'store';
  if (includesAny(input, ['ии бухгалтер', 'бухгалтер', 'бухгалтерия', 'фина бухгалтер', 'самозанятый', 'ип', 'малый бизнес'])) return 'business-accountant';
  if (includesAny(input, ['аналитика', 'аналитику', 'анализ', 'analytics', 'статистика', 'отчет', 'отчеты', 'операции', 'история', 'платежи'])) return 'analytics';
  if (includesAny(input, ['цели', 'цель', 'копилка', 'копилки', 'goals'])) return 'goals';
  if (includesAny(input, ['лимит', 'лимиты', 'ограничения трат', 'контроль трат', 'spending limits', 'limits'])) return 'spending-limits';
  if (includesAny(input, ['companion', 'компаньон', 'компаньона', 'спутник'])) return 'companion';
  if (includesAny(input, ['категории', 'категорию', 'разделы', 'раздел', 'taxonomy', 'таксономия'])) return 'sections';
  if (includesAny(input, ['настройки', 'settings', 'параметры', 'профиль'])) return 'settings';
  if (includesAny(input, ['счета', 'счет', 'мои счета', 'аккаунты', 'accounts', 'кошельки', 'карты'])) return 'accounts';
  if (includesAny(input, ['главная', 'главный', 'домой', 'сводка', 'обзор', 'dashboard'])) return 'dashboard';
  return null;
}

function isBareNavigationTarget(input: string, screen: AppScreen) {
  const words = input.split(' ').filter(Boolean);
  if (words.length > 4) return false;

  const blockedActionWords = [
    'создай', 'создать', 'добавь', 'добавить', 'удали', 'удалить', 'переименуй', 'переименовать',
    'измени', 'изменить', 'сделай', 'назначь', 'переведи', 'перевод', 'потратил', 'потратила',
    'доход', 'расход', 'запиши', 'записать', 'оплати', 'оплатить', 'пополни', 'пополнить',
  ];

  if (blockedActionWords.some((word) => input.includes(word))) return false;

  const bareAliases: Partial<Record<AppScreen, string[]>> = {
    dashboard: ['главная', 'домой', 'главный экран', 'сводка'],
    accounts: ['счета', 'счет', 'мои счета', 'кошельки', 'карты'],
    analytics: ['аналитика', 'анализ', 'статистика', 'отчеты', 'операции', 'история'],
    goals: ['цели', 'цель', 'копилки', 'копилка'],
    'spending-limits': ['лимиты', 'лимит', 'контроль трат'],
    settings: ['настройки', 'параметры', 'профиль'],
    sections: ['категории', 'разделы', 'категории и разделы', 'разделы и категории'],
    companion: ['компаньон', 'фина', 'помощник'],
    admin: ['админка', 'админ'],
    store: ['магазин', 'стор', 'тарифы', 'premium', 'премиум'],
    'business-accountant': ['ии бухгалтер', 'бухгалтер', 'бухгалтерия', 'фина бухгалтер'],
  };

  return (bareAliases[screen] ?? []).some((alias) => input === alias || input === `страница ${alias}` || input === `экран ${alias}`);
}

export function parseNavigationIntent(command: string): NavigationIntent {
  const input = normalize(command);
  if (!input) return { type: 'none' };

  if ((input.includes('главн') || input.includes('домой')) && (input.includes('верни') || input.includes('открой') || input.includes('покажи') || input === 'домой')) {
    return { type: 'open_screen', screen: 'dashboard' };
  }

  if (includesAny(input, ['чат', 'текстовый ввод', 'написать фине', 'ии чат', 'открой чат', 'напиши фине', 'write to fina'])) {
    return { type: 'open_text_chat' };
  }

  if (includesAny(input, ['назад', 'вернись', 'верни меня', 'предыдущий экран', 'go back', 'back'])) return { type: 'go_back' };

  const screen = detectScreen(input);
  if (!screen) return { type: 'none' };

  if (isBareNavigationTarget(input, screen) || includesAny(input, ['открой', 'покажи', 'перейди', 'зайди', 'хочу посмотреть', 'open', 'show', 'go to'])) {
    return { type: 'open_screen', screen };
  }

  return { type: 'none' };
}
