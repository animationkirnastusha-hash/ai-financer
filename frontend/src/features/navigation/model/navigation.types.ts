import type { AppScreen } from './navigation.store';

export type { AppScreen };

export type NavigationIntent =
  | { type: 'open_screen'; screen: AppScreen }
  | { type: 'go_back' }
  | { type: 'none' };
