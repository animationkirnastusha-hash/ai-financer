import { useSettingsStore } from '@/features/settings/model/settings.store';
import { useAuthStore } from '@/features/auth/model/auth.store';
import type { AppLanguage } from '@/features/settings/model/settings.types';

const labels: Record<AppLanguage, string> = {
  ru: 'RU',
  en: 'EN',
};

type Props = {
  compact?: boolean;
};

export function LanguageSwitcher({ compact = false }: Props) {
  const appLanguage = useSettingsStore((state) => state.appLanguage);
  const setAppLanguage = useSettingsStore((state) => state.setAppLanguage);
  const syncUserLocale = useAuthStore((state) => state.syncUserLocale);

  const setLanguage = (language: AppLanguage) => {
    if (language === appLanguage) return;
    setAppLanguage(language);
    void syncUserLocale(language);
  };

  return (
    <div
      className={`inline-flex rounded-full border border-white/10 bg-black/24 p-1 ${compact ? 'scale-95' : ''}`}
      role="group"
      aria-label={appLanguage === 'ru' ? 'Язык интерфейса' : 'Interface language'}
      data-no-swipe="true"
    >
      {(['ru', 'en'] as AppLanguage[]).map((language) => {
        const active = language === appLanguage;

        return (
          <button
            key={language}
            type="button"
            onClick={() => setLanguage(language)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              active ? 'bg-emerald-300/18 text-emerald-50' : 'text-white/42 hover:text-white/70'
            }`}
          >
            {labels[language]}
          </button>
        );
      })}
    </div>
  );
}
