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

  if (
    includesAny(input, [
      'счета',
      'счет',
      'счета мои',
      'мои счета',
      'аккаунты',
      'accounts',
      'баланс',
      'кошельки',
      'карты',
      'накопления',
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
      'расходы',
      'доходы',
      'траты',
      'платежи',
      'движения',
    ])
  ) {
    return 'transactions';
  }

  if (
    includesAny(input, [
      'настройки',
      'settings',
      'параметры',
      'профиль',
      'подписка',
      'premium',
      'премиум',
      'голос',
    ])
  ) {
    return 'settings';
  }

  if (
    includesAny(input, [
      'ядро',
      'главный экран',
      'ассистент',
      'ai core',
      'core',
      'чат',
      'ии',
      'ai',
      'помощник',
      'финансовый помощник',
    ])
  ) {
    return 'ai-core';
  }

  return null;
}

export function parseNavigationIntent(command: string): NavigationIntent {
  const input = normalize(command);

  if (!input) return { type: 'none' };

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
    includesAny(input, [
      'открой',
      'покажи',
      'перейди',
      'зайди',
      'перемести',
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