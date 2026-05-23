import { useState, type ReactNode } from 'react';
import { useSettingsStore } from '@/features/settings/model/settings.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { dataResetApi, type DataResetMode } from '@/features/data-reset/api/dataReset.api';

type SettingsModal = 'voice' | 'fina' | 'ai' | 'data' | null;

function ModalShell({
  title,
  caption,
  children,
  onClose,
}: {
  title: string;
  caption?: string;
  children: ReactNode;
  onClose: () => void;
}) {
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

function SettingsCard({
  title,
  caption,
  value,
  onClick,
}: {
  title: string;
  caption: string;
  value?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="app-settings-card" onClick={onClick}>
      <span>
        <b>{title}</b>
        <small>{caption}</small>
      </span>
      {value ? <em>{value}</em> : null}
    </button>
  );
}

function ToggleLine({
  title,
  caption,
  checked,
  onChange,
}: {
  title: string;
  caption: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
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
  const voiceRepliesEnabled = useSettingsStore((state) => state.voiceRepliesEnabled);
  const voiceAlwaysOnEnabled = useSettingsStore((state) => state.voiceAlwaysOnEnabled);
  const textInputEnabled = useSettingsStore((state) => state.textInputEnabled);
  const aiInsightsEnabled = useSettingsStore((state) => state.aiInsightsEnabled);

  const setVoiceActiveWindowSeconds = useSettingsStore((state) => state.setVoiceActiveWindowSeconds);
  const setVoiceEnabled = useSettingsStore((state) => state.setVoiceEnabled);
  const setVoiceBetaEnabled = useSettingsStore((state) => state.setVoiceBetaEnabled);
  const setVoiceRepliesEnabled = useSettingsStore((state) => state.setVoiceRepliesEnabled);
  const setVoiceAlwaysOnEnabled = useSettingsStore((state) => state.setVoiceAlwaysOnEnabled);
  const setTextInputEnabled = useSettingsStore((state) => state.setTextInputEnabled);
  const setAIInsightsEnabled = useSettingsStore((state) => state.setAIInsightsEnabled);

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
    { title: 'Помощник', caption: 'Прогресс и реакции Фины', screen: 'companion' as const },
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
          <p>Язык, голос, ввод, данные и быстрые разделы.</p>
        </header>

        <section className="app-card app-settings-language">
          <div>
            <div className="app-section-title">Язык</div>
            <p>Сейчас активен русский интерфейс.</p>
          </div>
          <LanguageSwitcher />
        </section>

        <section className="app-settings-grid">
          <SettingsCard
            title="Голос"
            caption="Микрофон, ответы и окно после команды"
            value={voiceEnabled ? 'включён' : 'выключен'}
            onClick={() => setModal('voice')}
          />
          <SettingsCard
            title="Фина"
            caption="Как помощник слушает и отвечает"
            value="по имени"
            onClick={() => setModal('fina')}
          />
          <SettingsCard
            title="Подсказки"
            caption="Подсказки, наблюдения и текстовый ввод"
            value={textInputEnabled ? 'текст есть' : 'только голос'}
            onClick={() => setModal('ai')}
          />
          <SettingsCard
            title="Данные"
            caption="Очистка финансов или полный сброс"
            value="тесты"
            onClick={() => setModal('data')}
          />
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
        <ModalShell title="Голос" caption="Настройки того, как Фина слушает в открытом приложении." onClose={() => setModal(null)}>
          <div className="grid gap-3">
            <ToggleLine title="Голосовой ввод" caption="Фина принимает команды голосом." checked={voiceEnabled} onChange={setVoiceEnabled} />
            <ToggleLine title="Микрофон включён" caption="Приложение ждёт имя Фины, пока открыто." checked={voiceAlwaysOnEnabled} onChange={setVoiceAlwaysOnEnabled} />
            <ToggleLine title="Ответы голосом" caption="Короткие ответы можно озвучивать." checked={voiceRepliesEnabled} onChange={setVoiceRepliesEnabled} />
            <ToggleLine title="Бета-режим" caption="Экспериментальная обработка голоса." checked={voiceBetaEnabled} onChange={setVoiceBetaEnabled} />
          </div>
          <div className="app-settings-number mt-4">
            <div><b>Слушать после команды</b><small>Сколько секунд можно продолжать без повторного имени.</small></div>
            <label><input type="number" min={2} max={120} step={1} inputMode="numeric" value={voiceActiveWindowSeconds} onChange={(event) => setVoiceActiveWindowSeconds(Number(event.target.value))} /><span>сек</span></label>
          </div>
        </ModalShell>
      ) : null}

      {modal === 'fina' ? (
        <ModalShell title="Фина" caption="Помощник реагирует только на своё имя и не отвлекается на случайный шум." onClose={() => setModal(null)}>
          <div className="app-fina-rules">
            <div><b>1</b><span>Скажи «Фина»</span></div>
            <div><b>2</b><span>Назови задачу обычным языком</span></div>
            <div><b>3</b><span>Подтверди, отмени или уточни</span></div>
          </div>
          <p className="app-settings-note">До имени Фина молчит. После имени она коротко слушает продолжение и показывает действие перед важными изменениями.</p>
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
