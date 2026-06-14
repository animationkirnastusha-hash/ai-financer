import type { ReactNode } from 'react';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useI18n, type I18nKey } from '@/shared/lib/i18n';

type FinaCommandBarProps = {
  titleKey?: I18nKey;
  captionKey?: I18nKey;
  placeholderKey?: I18nKey;
  suggestions?: Array<{ key: I18nKey; command: string }>;
  action?: ReactNode;
  className?: string;
};

const defaultSuggestions: Array<{ key: I18nKey; command: string }> = [
  { key: 'fina.command.addExpense', command: 'потратил 450 на кофе' },
  { key: 'fina.command.balance', command: 'какой общий баланс' },
  { key: 'fina.command.week', command: 'сколько я потратил за неделю' },
];

export function FinaCommandBar({
  titleKey = 'fina.command.title',
  captionKey = 'fina.command.caption',
  placeholderKey = 'fina.command.placeholder',
  suggestions = defaultSuggestions,
  action,
  className = '',
}: FinaCommandBarProps) {
  const { t } = useI18n();
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);

  return (
    <section className={`fina-command-bar app-card ${className}`.trim()} data-no-swipe="true">
      <div className="fina-command-bar__copy">
        <span>{t(titleKey)}</span>
        <strong>{t(placeholderKey)}</strong>
        <p>{t(captionKey)}</p>
      </div>

      <button type="button" className="fina-command-bar__input" onClick={() => openAIWithCommand()}>
        <span>{t('fina.command.input')}</span>
        <b>{t('fina.command.open')}</b>
      </button>

      {suggestions.length ? (
        <div className="fina-command-bar__chips" aria-label={t('fina.command.suggestions')}>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.key}
              type="button"
              onClick={() => openAIWithCommand(suggestion.command)}
            >
              {t(suggestion.key)}
            </button>
          ))}
        </div>
      ) : null}

      {action ? <div className="fina-command-bar__action">{action}</div> : null}
    </section>
  );
}
