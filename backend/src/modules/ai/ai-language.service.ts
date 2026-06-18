export type AILanguage = 'ru' | 'en';

export class AILanguageService {
  detectFromText(value: unknown, fallback: AILanguage = 'ru'): AILanguage {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) return fallback;

    const cyrillic = (text.match(/[А-Яа-яЁё]/g) ?? []).length;
    const latin = (text.match(/[A-Za-z]/g) ?? []).length;

    if (latin >= 2 && latin >= cyrillic * 2) return 'en';
    if (cyrillic >= 2 && cyrillic >= latin) return 'ru';
    return fallback;
  }

  normalize(value: unknown, fallback: AILanguage = 'ru'): AILanguage {
    const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (text === 'en' || text === 'english') return 'en';
    if (text === 'ru' || text === 'russian') return 'ru';
    return fallback;
  }
}

export const aiLanguageService = new AILanguageService();
