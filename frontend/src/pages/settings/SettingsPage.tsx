import { useEffect, useState, type ReactNode } from 'react';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { dataResetApi, type DataResetMode } from '@/features/data-reset/api/dataReset.api';
import type { AppCurrency } from '@/features/settings/model/settings.types';

type SettingsModal = 'voice' | 'fina' | 'ai' | 'currency' | 'data' | null;

const currencyOptions: AppCurrency[] = ['RUB', 'USD', 'EUR'];

function ModalShell({ title, caption, children, onClose }: { title: string; caption?: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="app-modal-backdrop" data-no-swipe="true" onClick={onClose}>
      <div className="app-modal-sheet app-settings-modal" data-no-swipe="true" onClick={(event) => event.stopPropagation()}>
        <div className="app-modal-handle" />
        <div className="app-modal-body">
          <div className="app-settings-modal__head">
            <div>
              <div className="app-eyebrow">Настройки</div>
              <h2>{title}</h2>
              {caption ? <p>{caption}</p> : null}
            </div>
            <button type="button" className="app-icon-button" onClick={onClose} aria-label="Закрыть">×</button>
          </div>
          {children}
        </div>
      </div>
    </div>
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
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState<DataResetMode | null>(null);
  const [modal, setModal] = useState<SettingsModal>(null);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const user = useAuthStore((state) => state.user);

  const voiceActiveWindowSeconds = useSettingsStore((state) => state.voiceActiveWindowSeconds);
  const voiceEnabled = useSettingsStore((state) => state.voiceEnabled);
  const voiceBetaEnabled = useSettingsStore((state) => state.voiceBetaEnabled);
  const voiceAlwaysOnEnabled = useSettingsStore((state) => state.voiceAlwaysOnEnabled);
  const textInputEnabled = useSettingsStore((state) => state.textInputEnabled);
  const aiInsightsEnabled = useSettingsStore((state) => state.aiInsightsEnabled);
  const mainCurrency = useSettingsStore((state) => state.mainCurrency);
  const secondaryCurrencyEnabled = useSettingsStore((state) => state.secondaryCurrencyEnabled);
  const secondaryCurrency = useSettingsStore((state) => state.secondaryCurrency);
  const rubToUsdRate = useSettingsStore((state) => state.rubToUsdRate);
  const rubToEurRate = useSettingsStore((state) => state.rubToEurRate);

  const setVoiceActiveWindowSeconds = useSettingsStore((state) => state.setVoiceActiveWindowSeconds);
  const setVoiceEnabled = useSettingsStore((state) => state.setVoiceEnabled);
  const setVoiceBetaEnabled = useSettingsStore((state) => state.setVoiceBetaEnabled);
  const setVoiceAlwaysOnEnabled = useSettingsStore((state) => state.setVoiceAlwaysOnEnabled);
  const setTextInputEnabled = useSettingsStore((state) => state.setTextInputEnabled);
  const setAIInsightsEnabled = useSettingsStore((state) => state.setAIInsightsEnabled);
  const setMainCurrency = useSettingsStore((state) => state.setMainCurrency);
  const setSecondaryCurrencyEnabled = useSettingsStore((state) => state.setSecondaryCurrencyEnabled);
  const setSecondaryCurrency = useSettingsStore((state) => state.setSecondaryCurrency);
  const setRubToUsdRate = useSettingsStore((state) => state.setRubToUsdRate);
  const setRubToEurRate = useSettingsStore((state) => state.setRubToEurRate);

  const [activeWindowDraft, setActiveWindowDraft] = useState(String(voiceActiveWindowSeconds));
  const [usdDraft, setUsdDraft] = useState(String(rubToUsdRate));
  const [eurDraft, setEurDraft] = useState(String(rubToEurRate));

  useEffect(() => setActiveWindowDraft(String(voiceActiveWindowSeconds)), [voiceActiveWindowSeconds, modal]);
  useEffect(() => setUsdDraft(String(rubToUsdRate)), [rubToUsdRate, modal]);
  useEffect(() => setEurDraft(String(rubToEurRate)), [rubToEurRate, modal]);

  const handleActiveWindowBlur = () => {
    const value = Number(activeWindowDraft);
    setVoiceActiveWindowSeconds(Number.isFinite(value) ? value : voiceActiveWindowSeconds);
    setActiveWindowDraft(String(Number.isFinite(value) ? Math.min(120, Math.max(2, Math.round(value))) : voiceActiveWindowSeconds));
  };

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
      ? 'Очистить все финансовые данные? XP, уровень и прогресс останутся.'
      : 'Сбросить всё по аккаунту? Финансы, XP, уровень, достижения и прогресс будут обнулены. Профиль останется.';

    if (!window.confirm(text)) return;

    setResetMode(mode);
    setResetStatus(null);

    try {
      await dataResetApi.resetMe(mode);
      setResetStatus(mode === 'finance' ? 'Финансовые данные очищены.' : 'Аккаунт обнулён.');
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      setResetStatus(error instanceof Error ? error.message : 'Не удалось выполнить сброс.');
    } finally {
      setResetMode(null);
    }
  };

  const navigationItems = [
    { title: 'Счета', caption: 'Баланс и основные счета', screen: 'accounts' as const },
    { title: 'Цели', caption: 'Накопления и планы', screen: 'goals' as const },
    { title: 'Фина', caption: 'Прогресс и привычка', screen: 'companion' as const },
    { title: 'Разделы', caption: 'Категории и структура', screen: 'taxonomy-settings' as const },
    { title: 'Рефералы', caption: 'Код и приглашения', screen: 'referral' as const },
    { title: 'Премиум', caption: 'Расширенные возможности', screen: 'premium' as const },
  ];

  return (
    <div className="app-page app-settings-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title="Настройки" left="back" right={['home']} />

        <header className="app-card app-card--hero app-settings-hero">
          <div className="app-eyebrow">Настройки</div>
          <h1>Управление</h1>
          <p>Голос, валюты, подсказки, данные и быстрые разделы.</p>
        </header>

        <section className="app-card app-settings-language">
          <div>
            <div className="app-section-title">Язык</div>
            <p>Сейчас активен русский интерфейс.</p>
          </div>
          <LanguageSwitcher />
        </section>

        <section className="app-settings-grid">
          <SettingsCard title="Голос" caption="Микрофон и окно после команды" value={voiceEnabled ? 'включён' : 'выключен'} onClick={() => setModal('voice')} />
          <SettingsCard title="Фина" caption="Как помощник слушает команды" value="по имени" onClick={() => setModal('fina')} />
          <SettingsCard title="Валюты" caption="Главная валюта и курсы" value={`${mainCurrency}${secondaryCurrencyEnabled ? ` + ${secondaryCurrency}` : ''}`} onClick={() => setModal('currency')} />
          <SettingsCard title="Подсказки" caption="Текстовый ввод и наблюдения" value={textInputEnabled ? 'текст есть' : 'только голос'} onClick={() => setModal('ai')} />
          <SettingsCard title="Данные" caption="Очистка финансов или полный сброс" value="тесты" onClick={() => setModal('data')} />
        </section>

        <section className="app-card app-settings-nav">
          <div className="app-section-title">Разделы приложения</div>
          <div className="mt-3 grid gap-2">
            {navigationItems.map((item) => (
              <button key={item.screen} type="button" onClick={() => navigateTo(item.screen)} className="app-list-button">
                <span>{item.title}</span>
                <small>{item.caption}</small>
              </button>
            ))}
          </div>
        </section>

        {user ? (
          <section className="app-card app-settings-user">
            <div className="app-section-title">Профиль</div>
            <p>{user.firstName || user.username || 'Пользователь'}</p>
            <small>ID: {user.telegramId}</small>
          </section>
        ) : null}
      </div>

      {modal === 'voice' ? (
        <ModalShell title="Голос" caption="Фина слушает только после имени. Озвучка ответов временно выключена." onClose={() => setModal(null)}>
          <div className="grid gap-3">
            <ToggleLine title="Голосовой ввод" caption="Команды можно говорить вслух." checked={voiceEnabled} onChange={setVoiceEnabled} />
            <ToggleLine title="Микрофон включён" caption="Пока приложение открыто, Фина ждёт своё имя." checked={voiceAlwaysOnEnabled} onChange={setVoiceAlwaysOnEnabled} />
            <ToggleLine title="Бета-режим" caption="Улучшенный голосовой цикл для тестов." checked={voiceBetaEnabled} onChange={setVoiceBetaEnabled} />
          </div>
          <div className="app-settings-number mt-4">
            <div><b>Слушать после команды</b><small>Сколько секунд можно продолжать без повторного имени.</small></div>
            <label>
              <input
                type="number"
                min={2}
                max={120}
                step={1}
                inputMode="numeric"
                value={activeWindowDraft}
                onChange={(event) => setActiveWindowDraft(event.target.value)}
                onBlur={handleActiveWindowBlur}
              />
              <span>сек</span>
            </label>
          </div>
        </ModalShell>
      ) : null}

      {modal === 'fina' ? (
        <ModalShell title="Фина" caption="Помощник реагирует на имя, готовит действие и показывает подтверждение." onClose={() => setModal(null)}>
          <div className="app-fina-rules">
            <div><b>1</b><span>Скажи «Фина»</span></div>
            <div><b>2</b><span>Назови задачу</span></div>
            <div><b>3</b><span>Подтверди или уточни</span></div>
          </div>
          <p className="app-settings-note">До имени Фина не отправляет речь в обработку. Если действие влияет на деньги, появится окно подтверждения.</p>
        </ModalShell>
      ) : null}

      {modal === 'currency' ? (
        <ModalShell title="Валюты" caption="Выбери, что показывать на главной карточке баланса." onClose={() => setModal(null)}>
          <div className="app-currency-settings-grid">
            <div className="app-currency-row">
              <div className="app-currency-row__head"><b>Главная валюта</b><small>{mainCurrency}</small></div>
              <div className="app-currency-pills">
                {currencyOptions.map((currency) => (
                  <button key={currency} type="button" data-active={currency === mainCurrency} onClick={() => setMainCurrency(currency)}>{currency}</button>
                ))}
              </div>
            </div>

            <ToggleLine title="Вторая валюта" caption="Показывать дополнительную валюту на главной." checked={secondaryCurrencyEnabled} onChange={setSecondaryCurrencyEnabled} />

            <div className="app-currency-row">
              <div className="app-currency-row__head"><b>Дополнительная</b><small>{secondaryCurrency}</small></div>
              <div className="app-currency-pills">
                {(['USD', 'EUR'] as const).map((currency) => (
                  <button key={currency} type="button" data-active={currency === secondaryCurrency} onClick={() => setSecondaryCurrency(currency)}>{currency}</button>
                ))}
              </div>
            </div>

            <div className="app-currency-row">
              <div className="app-currency-row__head"><b>Курс доллара</b><small>1 USD в рублях</small></div>
              <input className="app-currency-rate-input" inputMode="decimal" value={usdDraft} onChange={(event) => setUsdDraft(event.target.value)} onBlur={saveUsdRate} />
            </div>

            <div className="app-currency-row">
              <div className="app-currency-row__head"><b>Курс евро</b><small>1 EUR в рублях</small></div>
              <input className="app-currency-rate-input" inputMode="decimal" value={eurDraft} onChange={(event) => setEurDraft(event.target.value)} onBlur={saveEurRate} />
            </div>
          </div>
        </ModalShell>
      ) : null}

      {modal === 'ai' ? (
        <ModalShell title="Подсказки" caption="Запасной ввод и короткие наблюдения по финансам." onClose={() => setModal(null)}>
          <div className="grid gap-3">
            <ToggleLine title="Текстовый ввод" caption="Показывать поле, если говорить неудобно." checked={textInputEnabled} onChange={setTextInputEnabled} />
            <ToggleLine title="Наблюдения" caption="Показывать короткие финансовые выводы." checked={aiInsightsEnabled} onChange={setAIInsightsEnabled} />
          </div>
        </ModalShell>
      ) : null}

      {modal === 'data' ? (
        <ModalShell title="Данные" caption="Для тестов можно начать заново без удаления профиля." onClose={() => setModal(null)}>
          <div className="grid gap-3">
            <button type="button" className="app-danger-card" disabled={resetMode !== null} onClick={() => handleReset('finance')}>
              <b>Очистить финансы</b>
              <small>Счета, операции, цели, категории, разделы и финансовый контекст. XP останется.</small>
            </button>
            <button type="button" className="app-danger-card app-danger-card--hard" disabled={resetMode !== null} onClick={() => handleReset('full')}>
              <b>Сбросить всё</b>
              <small>Финансы, XP, уровень, достижения и прогресс. Профиль останется.</small>
            </button>
            {resetStatus ? <div className="app-status-box">{resetStatus}</div> : null}
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
