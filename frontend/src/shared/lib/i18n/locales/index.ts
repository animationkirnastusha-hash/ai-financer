import { ruDictionary } from './ru';
import { enDictionary } from './en';

export const dictionary = {
  ru: ruDictionary,
  en: enDictionary,
} as const;

export type I18nKey = keyof typeof ruDictionary;

export { ruDictionary, enDictionary };
