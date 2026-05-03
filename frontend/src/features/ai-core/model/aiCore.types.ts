export type AICoreState =
  | 'idle'
  | 'expanded'
  | 'listening'
  | 'thinking'
  | 'responding';

export type AICoreMode = 'text' | 'voice';