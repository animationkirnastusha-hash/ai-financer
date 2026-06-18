import { useEffect, useState, type ReactNode } from 'react';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { useNavigationStore, type SettingsSection } from '@/features/navigation/model/navigation.store';
import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { Drawer } from '@/shared/ui/Drawer';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { dataResetApi, type DataResetMode } from '@/features/data-reset/api/dataReset.api';
import { useNotificationsStore } from '@/features/notifications/model/notifications.store';
import type { AppCurrency } from '@/features/settings/model/settings.types';
import { useI18n } from '@/shared/lib/i18n';
import { AISettingsPanel } from '@/features/settings/ui/AISettingsPanel';

type SettingsModal = SettingsSection | null;

const currencyOptions: AppCurrency[] = ['RUB', 'USD', 'EUR', 'KZT', 'UZS', 'KGS', 'AMD', 'GEL', 'AZN'];

function ModalShell({ title, caption, children, onClose }: { title: string; caption?: string; children: ReactNode; onClose: () => void }) {
  return (
    <Drawer
      open
      onClose={onClose}
      title={title}
      subtitle={caption}
      className="app-settings-modal"
      bodyClassName="app-settings-modal__body"
    >
      {children}
    </Drawer>
  );
}

function SettingsCard({ title, caption, value, onClick }: { title: string; caption: string; value?: string; onClick: () => void }) {
  return (
    <button type="button" className="app-settings-card" onClick={onClick}>
      <span><b>{title}</b><small>{caption}</small></span>
      {value ? <em>{value}</em> : null}
    </button>
  );
}

function ToggleLine({ title, caption, checked, onChange }: { title: string; caption: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="app-toggle-row app-toggle-row--compact">
      <span><span>{title}</span><small>{caption}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

export default function SettingsPage() {
  const { t, language } = useI18n();
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState<DataResetMode | null>(null);
  const [modal, setModal] = useState<SettingsModal>(null);
  const consumeSettingsSection = useNavigationStore((state) => state.consumeSettingsSection);
  const user = useAuthStore((state) => state.user);

  const voiceEnabled = useSettingsStore((state) => state.voiceEnabled);
  const voiceBetaEnabled = useSettingsStore((state) => state.voiceBetaEnabled);
  const voiceRepliesEnabled = useSettingsStore((state) => state.voiceRepliesEnabled);
  const textInputEnabled = useSettingsStore((state) => state.textInputEnabled);
  const aiInsightsEnabled = useSettingsStore((state) => state.aiInsightsEnabled);
  const mainCurrency = useSettingsStore((state) => state.mainCurrency);
  const secondaryCurrencyEnabled = useSettingsStore((state) => state.secondaryCurrencyEnabled);
  const secondaryCurrency = useSettingsStore((state) => state.secondaryCurrency);
  const rubToUsdRate = useSettingsStore((state) => state.rubToUsdRate);
  const rubToEurRate = useSettingsStore((state) => state.rubToEurRate);

  const notificationSettings = useNotificationsStore((state) => state.settings);
  const notificationError = useNotificationsStore((state) => state.error);
  const loadNotificationSettings = useNotificationsStore((state) => state.loadSettings);
  const updateNotificationSettings = useNotificationsStore((state) => state.updateSettings);

  const setVoiceEnabled = useSettingsStore((state) => state.setVoiceEnabled);
  const setVoiceBetaEnabled = useSettingsStore((state) => state.setVoiceBetaEnabled);
  const setVoiceRepliesEnabled = useSettingsStore((state) => state.setVoiceRepliesEnabled);
  const setTextInputEnabled = useSettingsStore((state) => state.setTextInputEnabled);
  const setAIInsightsEnabled = useSettingsStore((state) => state.setAIInsightsEnabled);
  const setMainCurrency = useSettingsStore((state) => state.setMainCurrency);
  const setSecondaryCurrencyEnabled = useSettingsStore((state) => state.setSecondaryCurrencyEnabled);
  const setSecondaryCurrency = useSettingsStore((state) => state.setSecondaryCurrency);
  const setRubToUsdRate = useSettingsStore((state) => state.setRubToUsdRate);
  const setRubToEurRate = useSettingsStore((state) => state.setRubToEurRate);

  const [usdDraft, setUsdDraft] = useState(String(rubToUsdRate));
  const [eurDraft, setEurDraft] = useState(String(rubToEurRate));

  useEffect(() => setUsdDraft(String(rubToUsdRate)), [rubToUsdRate, modal]);
  useEffect(() => setEurDraft(String(rubToEurRate)), [rubToEurRate, modal]);

  useEffect(() => {
    const section = consumeSettingsSection();
    if (section) setModal(section);
  }, [consumeSettingsSection]);

  useEffect(() => {
    if (modal === 'notifications') void loadNotificationSettings();
  }, [loadNotificationSettings, modal]);

  const saveUsdRate = () => {
    const value = Number(usdDraft.replace(',', '.'));
    if (Number.isFinite(value) && value > 0) setRubToUsdRate(value);
    setUsdDraft(String(Number.isFinite(value) && value > 0 ? value : rubToUsdRate));
  };

  const saveEurRate = () => {
    const value = Number(eurDraft.replace(',', '.'));
    if (Number.isFinite(value) && value > 0) setRubToEurRate(value);
    setEurDraft(String(Number.isFinite(value) && value > 0 ? value : rubToEurRate));
  };

  const handleReset = async (mode: DataResetMode) => {
    const text = mode === 'finance'
      ? t('settings.data.confirm.finance')
      : t('settings.data.confirm.full');

    if (!window.confirm(text)) return;

    setResetMode(mode);
    setResetStatus(null);

    try {
      await dataResetApi.resetMe(mode);
      setResetStatus(mode === 'finance' ? t('settings.data.status.finance') : t('settings.data.status.full'));
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setResetStatus(error instanceof Error ? error.message : t('settings.data.status.error'));
    } finally {
      setResetMode(null);
    }
  };


  return (
    <div className="app-page app-settings-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title={t('settings.title')} left="back" right={['notifications', 'home']} />

        <header className="app-card app-card--hero app-settings-hero">
          <div className="app-eyebrow">{t('settings.hero.eyebrow')}</div>
          <h1>{t('settings.hero.title')}</h1>
          <p>{t('settings.hero.caption')}</p>
        </header>

        <section className="app-card app-settings-language">
          <div>
            <div className="app-section-title">{t('settings.language.title')}</div>
            <p>{language === 'en' ? t('settings.language.caption.en') : t('settings.language.caption')}</p>
          </div>
          <LanguageSwitcher />
        </section>

        <section className="app-settings-grid">
          <SettingsCard title={t('settings.card.voice.title')} caption={t('settings.card.voice.caption')} value={voiceEnabled ? t('settings.card.voice.on') : t('settings.card.voice.off')} onClick={() => setModal('voice')} />
          <SettingsCard title={t('settings.card.fina.title')} caption={t('settings.card.fina.caption')} value={t('settings.card.fina.value')} onClick={() => setModal('fina')} />
          <SettingsCard title={t('settings.card.notifications.title')} caption={t('settings.card.notifications.caption')} value={notificationSettings?.inAppEnabled === false ? t('settings.card.notifications.off') : t('settings.card.notifications.on')} onClick={() => setModal('notifications')} />
          <SettingsCard title={t('settings.card.currency.title')} caption={t('settings.card.currency.caption')} value={`${mainCurrency}${secondaryCurrencyEnabled ? ` + ${secondaryCurrency}` : ''}`} onClick={() => setModal('currency')} />
          <SettingsCard title={t('settings.card.ai.title')} caption={t('settings.card.ai.caption')} value={textInputEnabled ? t('settings.card.ai.on') : t('settings.card.ai.off')} onClick={() => setModal('ai')} />
          <SettingsCard title={t('settings.card.data.title')} caption={t('settings.card.data.caption')} value={t('settings.card.data.value')} onClick={() => setModal('data')} />
        </section>

        {user ? (
          <section className="app-card app-settings-user">
            <div className="app-section-title">{t('settings.profile.title')}</div>
            <p>{user.firstName || user.username || t('settings.profile.fallback')}</p>
            <small>ID: {user.telegramId}</small>
          </section>
        ) : null}
      </div>

      {modal === 'voice' ? (
        <ModalShell title={t('settings.voice.title')} caption={t('settings.voice.caption')} onClose={() => setModal(null)}>
          <div className="grid gap-3">
            <ToggleLine title={t('settings.voice.input.title')} caption={t('settings.voice.input.caption')} checked={voiceEnabled} onChange={setVoiceEnabled} />
            <ToggleLine title={t('settings.voice.replies.title')} caption={t('settings.voice.replies.caption')} checked={voiceRepliesEnabled} onChange={setVoiceRepliesEnabled} />
            <ToggleLine title={t('settings.voice.recognition.title')} caption={t('settings.voice.recognition.caption')} checked={voiceBetaEnabled} onChange={setVoiceBetaEnabled} />
          </div>
          <p className="app-settings-note mt-4">{t('settings.voice.note')}</p>
        </ModalShell>
      ) : null}

      {modal === 'fina' ? (
        <ModalShell title={t('settings.fina.modal.title')} caption={t('settings.fina.modal.caption')} onClose={() => setModal(null)}>
          <div className="app-fina-rules">
            <div><b>1</b><span>{t('settings.fina.step.hold')}</span></div>
            <div><b>2</b><span>{t('settings.fina.step.say')}</span></div>
            <div><b>3</b><span>{t('settings.fina.step.release')}</span></div>
          </div>
          <p className="app-settings-note">{t('settings.fina.note')}</p>
        </ModalShell>
      ) : null}

      {modal === 'currency' ? (
        <ModalShell title={t('settings.currency.modal.title')} caption={t('settings.currency.modal.caption')} onClose={() => setModal(null)}>
          <div className="app-currency-settings-grid">
            <div className="app-currency-row">
              <div className="app-currency-row__head"><b>{t('settings.currency.main')}</b><small>{mainCurrency}</small></div>
              <div className="app-currency-pills">
                {currencyOptions.map((currency) => (
                  <button key={currency} type="button" data-active={currency === mainCurrency} onClick={() => setMainCurrency(currency)}>{currency}</button>
                ))}
              </div>
            </div>

            <ToggleLine title={t('settings.currency.conversion.title')} caption={t('settings.currency.conversion.caption')} checked={secondaryCurrencyEnabled} onChange={setSecondaryCurrencyEnabled} />

            <div className="app-currency-row">
              <div className="app-currency-row__head"><b>{t('settings.currency.secondary')}</b><small>{secondaryCurrency}</small></div>
              <div className="app-currency-pills">
                {currencyOptions.filter((currency) => currency !== mainCurrency).map((currency) => (
                  <button key={currency} type="button" data-active={currency === secondaryCurrency} onClick={() => setSecondaryCurrency(currency)}>{currency}</button>
                ))}
              </div>
            </div>

            <div className="app-currency-row">
              <div className="app-currency-row__head"><b>{t('settings.currency.usdRate')}</b><small>{t('settings.currency.usdRate.caption')}</small></div>
              <input className="app-currency-rate-input" inputMode="decimal" value={usdDraft} onChange={(event) => setUsdDraft(event.target.value)} onBlur={saveUsdRate} />
            </div>

            <div className="app-currency-row">
              <div className="app-currency-row__head"><b>{t('settings.currency.eurRate')}</b><small>{t('settings.currency.eurRate.caption')}</small></div>
              <input className="app-currency-rate-input" inputMode="decimal" value={eurDraft} onChange={(event) => setEurDraft(event.target.value)} onBlur={saveEurRate} />
            </div>
          </div>
        </ModalShell>
      ) : null}

      {modal === 'ai' ? (
        <ModalShell title={t('settings.ai.title')} caption={t('settings.ai.caption')} onClose={() => setModal(null)}>
          <AISettingsPanel
            t={t}
            textInputEnabled={textInputEnabled}
            aiInsightsEnabled={aiInsightsEnabled}
            onTextInputChange={setTextInputEnabled}
            onAIInsightsChange={setAIInsightsEnabled}
          />
        </ModalShell>
      ) : null}


      {modal === 'notifications' ? (
        <ModalShell title={t('settings.notifications.modal.title')} caption={t('settings.notifications.modal.caption')} onClose={() => setModal(null)}>
          <div className="grid gap-3">
            <ToggleLine
              title={t('settings.notifications.inApp.title')}
              caption={t('settings.notifications.inApp.caption')}
              checked={notificationSettings?.inAppEnabled !== false}
              onChange={(value) => void updateNotificationSettings({ inAppEnabled: value })}
            />
            <ToggleLine
              title={t('settings.notifications.telegram.title')}
              caption={t('settings.notifications.telegram.caption')}
              checked={notificationSettings?.telegramEnabled !== false}
              onChange={(value) => void updateNotificationSettings({ telegramEnabled: value })}
            />
            <ToggleLine
              title={t('settings.notifications.due.title')}
              caption={t('settings.notifications.due.caption')}
              checked={notificationSettings?.remindOnDueDate !== false}
              onChange={(value) => void updateNotificationSettings({ remindOnDueDate: value })}
            />
            <ToggleLine
              title={t('settings.notifications.overdue.title')}
              caption={t('settings.notifications.overdue.caption')}
              checked={notificationSettings?.remindOverdue !== false}
              onChange={(value) => void updateNotificationSettings({ remindOverdue: value })}
            />
            {notificationError ? <div className="app-status-box app-status-box--error">{notificationError}</div> : null}
          </div>
        </ModalShell>
      ) : null}

      {modal === 'data' ? (
        <ModalShell title={t('settings.data.modal.title')} caption={t('settings.data.modal.caption')} onClose={() => setModal(null)}>
          <div className="grid gap-3">
            <button type="button" className="app-danger-card" disabled={resetMode !== null} onClick={() => handleReset('finance')}>
              <b>{t('settings.data.clearFinance.title')}</b>
              <small>{t('settings.data.clearFinance.caption')}</small>
            </button>
            <button type="button" className="app-danger-card app-danger-card--hard" disabled={resetMode !== null} onClick={() => handleReset('full')}>
              <b>{t('settings.data.resetAll.title')}</b>
              <small>{t('settings.data.resetAll.caption')}</small>
            </button>
            {resetStatus ? <div className="app-status-box">{resetStatus}</div> : null}
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
