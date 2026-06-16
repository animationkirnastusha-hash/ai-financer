import { useEffect, useMemo, useState } from 'react';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useSubscriptionStore } from '@/features/subscription/model/subscription.store';
import { useI18n } from '@/shared/lib/i18n';

type TrialOfferSource = 'tour_complete' | 'tour_skip' | 'store' | 'premium' | 'manual';

type Props = {
  open: boolean;
  layer?: number;
  source?: TrialOfferSource;
  onClose: () => void;
};

function formatTrialDate(value?: string | null) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'long' }).format(new Date(value));
  } catch {
    return '';
  }
}

export function TrialOfferSheet({ open, layer = 120, source = 'manual', onClose }: Props) {
  const { t } = useI18n();
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const subscription = useSubscriptionStore((state) => state.status);
  const isLoading = useSubscriptionStore((state) => state.isLoading);
  const error = useSubscriptionStore((state) => state.error);
  const loadSubscription = useSubscriptionStore((state) => state.load);
  const startTrial = useSubscriptionStore((state) => state.startTrial);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [startedUntil, setStartedUntil] = useState<string | null>(null);

  useEffect(() => {
    if (open) void loadSubscription();
  }, [loadSubscription, open]);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add('ai-any-modal-open');
    document.documentElement.classList.add('ai-any-modal-open');
    return () => {
      document.body.classList.remove('ai-any-modal-open');
      document.documentElement.classList.remove('ai-any-modal-open');
    };
  }, [open]);

  const alreadyUsed = Boolean(subscription?.access.trialUsed && !subscription?.access.trialActive);
  const alreadyActive = Boolean(subscription?.access.trialActive);
  const titleKey = useMemo(() => {
    if (alreadyActive || startedUntil) return 'trialOffer.active.title';
    if (alreadyUsed) return 'trialOffer.used.title';
    if (source === 'tour_skip') return 'trialOffer.skip.title';
    return 'trialOffer.title';
  }, [alreadyActive, alreadyUsed, source, startedUntil]);

  if (!open) return null;

  const handleStart = async () => {
    const status = await startTrial({ telegramReminderConsent: true });
    const until = status?.access.trialUntil ?? null;
    setStartedUntil(until);
    setConsentAccepted(true);
  };

  const handleOpenStore = () => {
    onClose();
    navigateTo('store');
  };

  const trialUntilText = formatTrialDate(startedUntil ?? subscription?.access.trialUntil);

  return (
    <div className="app-modal-backdrop trial-offer-backdrop" data-no-swipe="true" style={{ zIndex: layer }} onClick={onClose}>
      <section className="app-modal-sheet trial-offer-sheet" data-no-swipe="true" onClick={(event) => event.stopPropagation()}>
        <div className="app-modal-handle" />
        <div className="app-modal-body trial-offer-sheet__body">
          <div className="trial-offer-hero">
            <div className="trial-offer-hero__icon" aria-hidden="true">✦</div>
            <div className="app-eyebrow">{t('trialOffer.eyebrow')}</div>
            <h2>{t(titleKey)}</h2>
            <p>{t(alreadyUsed ? 'trialOffer.used.caption' : alreadyActive || startedUntil ? 'trialOffer.active.caption' : 'trialOffer.caption')}</p>
            {trialUntilText ? <span className="trial-offer-hero__date">{t('trialOffer.until', { date: trialUntilText })}</span> : null}
          </div>

          {!alreadyUsed && !alreadyActive && !startedUntil ? (
            <>
              <div className="trial-offer-benefits" aria-label={t('trialOffer.benefits.aria')}>
                <div>
                  <strong>{t('trialOffer.benefit.voice.title')}</strong>
                  <span>{t('trialOffer.benefit.voice.caption')}</span>
                </div>
                <div>
                  <strong>{t('trialOffer.benefit.analysis.title')}</strong>
                  <span>{t('trialOffer.benefit.analysis.caption')}</span>
                </div>
                <div>
                  <strong>{t('trialOffer.benefit.receipts.title')}</strong>
                  <span>{t('trialOffer.benefit.receipts.caption')}</span>
                </div>
              </div>

              <label className="trial-offer-consent">
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(event) => setConsentAccepted(event.currentTarget.checked)}
                />
                <span>
                  <strong>{t('trialOffer.consent.title')}</strong>
                  <small>{t('trialOffer.consent.caption')}</small>
                </span>
              </label>

              <div className="trial-offer-note">{t('trialOffer.telegram.note')}</div>
              {error ? <div className="app-status-box app-status-box--error">{t('trialOffer.error')}</div> : null}
            </>
          ) : null}
        </div>

        <footer className="app-modal-footer trial-offer-actions">
          {alreadyUsed ? (
            <button type="button" className="app-primary-button" onClick={handleOpenStore}>{t('trialOffer.openStore')}</button>
          ) : alreadyActive || startedUntil ? (
            <button type="button" className="app-primary-button" onClick={onClose}>{t('trialOffer.done')}</button>
          ) : (
            <button type="button" className="app-primary-button" disabled={!consentAccepted || isLoading} onClick={() => void handleStart()}>
              {isLoading ? t('trialOffer.starting') : t('trialOffer.start')}
            </button>
          )}
          <button type="button" className="app-secondary-button" onClick={onClose}>{t('trialOffer.later')}</button>
        </footer>
      </section>
    </div>
  );
}
