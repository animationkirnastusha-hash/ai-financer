import type {
  AppScreen,
  NavigationIntent,
} from '@/features/navigation/model/navigation.types';

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
  if (
    includesAny(input, [
      'админ',
      'админка',
      'admin',
      'панель администратора',
      'статистика приложения',
      'состояние сервера',
    ])
  ) {
    return 'admin';
  }

  if (
    includesAny(input, [
      'ai core',
      'ai-core',
      'ии ядро',
      'ядро',
      'ассистент',
      'чат',
      'ии',
      'ai',
      'помощник',
      'финансовый помощник',
      'текстовый ввод',
      'написать фине',
      'командный центр',
    ])
  ) {
    return 'ai-core';
  }



  if (
    includesAny(input, [
      'ии бухгалтер',
      'бухгалтер',
      'бухгалтерия',
      'фина бухгалтер',
      'самозанятый',
      'самозанятые',
      'ип',
      'малый бизнес',
      'business',
      'accountant',
    ])
  ) {
    return 'business-accountant';
  }

  if (
    includesAny(input, [
      'аналитика',
      'аналитику',
      'анализ',
      'analytics',
      'статистика',
      'статистику',
      'отчет',
      'отчеты',
      'сравнение',
      'сравни',
    ])
  ) {
    return 'analytics';
  }

  if (
    includesAny(input, [
      'цели',
      'цель',
      'копилка',
      'копилки',
      'подушка',
      'накопительная цель',
      'goals',
    ])
  ) {
    return 'goals';
  }

  if (
    includesAny(input, [
      'companion',
      'компаньон',
      'компаньона',
      'спутник',
      'присутствие',
      'настроение companion',
    ])
  ) {
    return 'companion';
  }

  if (
    includesAny(input, [
      'разделы и категории',
      'категории и разделы',
      'категории',
      'категорию',
      'разделы',
      'раздел',
      'taxonomy',
      'таксономия',
      'структура категорий',
    ])
  ) {
    return 'taxonomy-settings';
  }

  if (
    includesAny(input, [
      'настройки',
      'settings',
      'параметры',
      'профиль',
      'голосовые настройки',
      'voice settings',
      'режим ai',
      'режим ии',
    ])
  ) {
    return 'settings';
  }

  if (
    includesAny(input, [
      'счета',
      'счет',
      'счета мои',
      'мои счета',
      'аккаунты',
      'accounts',
      'кошельки',
      'карты',
    ])
  ) {
    return 'accounts';
  }

  if (
    includesAny(input, [
      'транзакции',
      'операции',
      'история',
      'историю',
      'transactions',
      'платежи',
      'движения',
    ])
  ) {
    return 'transactions';
  }

  if (
    includesAny(input, [
      'дашборд',
      'dashboard',
      'главная',
      'главный',
      'домой',
      'сводка',
      'обзор',
      'картина',
      'финансовая картина',
      'покажи главную',
    ])
  ) {
    return 'dashboard';
  }

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
    transactions: ['операции', 'транзакции', 'история', 'платежи'],
    analytics: ['аналитика', 'анализ', 'статистика', 'отчеты'],
    goals: ['цели', 'цель', 'копилки', 'копилка'],
    settings: ['настройки', 'параметры', 'профиль'],
    'taxonomy-settings': ['категории', 'разделы', 'категории и разделы', 'разделы и категории'],
    companion: ['компаньон', 'фина', 'помощник'],
    admin: ['админка', 'админ'],
    'business-accountant': ['ии бухгалтер', 'бухгалтер', 'бухгалтерия', 'фина бухгалтер'],
    'ai-core': ['чат', 'текстовый ввод', 'ии чат'],
  };

  return (bareAliases[screen] ?? []).some((alias) => input === alias || input === `страница ${alias}` || input === `экран ${alias}`);
}

export function parseNavigationIntent(command: string): NavigationIntent {
  const input = normalize(command);

  if (!input) return { type: 'none' };

  if ((input.includes('главн') || input.includes('домой')) && (input.includes('верни') || input.includes('открой') || input.includes('покажи') || input === 'домой')) {
    return { type: 'open_screen', screen: 'dashboard' };
  }

  if (
    includesAny(input, [
      'назад',
      'вернись',
      'верни меня',
      'предыдущий экран',
      'go back',
      'back',
    ])
  ) {
    return { type: 'go_back' };
  }

  const screen = detectScreen(input);

  if (!screen) return { type: 'none' };

  if (
    isBareNavigationTarget(input, screen) ||
    includesAny(input, [
      'открой',
      'покажи',
      'перейди',
      'зайди',
      'перемести меня',
      'перекинь меня',
      'хочу посмотреть',
      'дай посмотреть',
      'open',
      'show',
      'go to',
    ])
  ) {
    return {
      type: 'open_screen',
      screen,
    };
  }

  return { type: 'none' };
}
