export type AppScreen =
  | 'ai-core'
  | 'dashboard'
  | 'accounts'
  | 'transactions'
  | 'settings';

export type NavigationIntent =
  | { type: 'open_screen'; screen: AppScreen }
  | { type: 'go_back' }
  | { type: 'none' };