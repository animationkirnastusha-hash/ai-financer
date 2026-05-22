import { useState } from 'react';
import { useOnboardingStore } from '@/features/onboarding/model/onboarding.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';

const examples = [
  'Фина, кофе 300',
  'Фина, создай цель отпуск 120000',
  'Фина, сделай карту основной',
];

export function LaunchOnboardingSheet() {
  const isOpen = useOnboardingStore((state) => state.isOpen);
  const close = useOnboardingStore((state) => state.close);
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);
  const companionName = useSettingsStore((state) => state.companionName);
  const setCompanionName = useSettingsStore((state) => state.setCompanionName);
  const setVoicePermissionPrompted = useSettingsStore((state) => state.setVoicePermissionPrompted);
  const setVoiceAlwaysOnEnabled = useSettingsStore((state) => state.setVoiceAlwaysOnEnabled);
  const setVoiceEnabled = useSettingsStore((state) => state.setVoiceEnabled);
  const setVoiceBetaEnabled = useSettingsStore((state) => state.setVoiceBetaEnabled);
  const [draftName, setDraftName] = useState(companionName || 'Фина');

  if (!isOpen) return null;

  const normalizedName = draftName.trim() || 'Фина';

  const finish = (enableVoice: boolean) => {
    setCompanionName(normalizedName);
    setVoiceEnabled(true);
    setVoiceBetaEnabled(true);
    if (enableVoice) {
      setVoiceAlwaysOnEnabled(true);
      setVoicePermissionPrompted(false);
    }
    close();
  };

  const runExample = (command: string) => {
    finish(false);
    openAIWithCommand(command.replace(/^Фина/i, normalizedName));
  };

  return (
    <div className="fixed inset-0 z-[140] bg-black/72 px-3 backdrop-blur-sm" data-no-swipe="true">
      <div className="flex h-full items-end">
        <div className="mx-auto mb-3 flex max-h-[92dvh] w-full max-w-[560px] flex-col rounded-[34px] border border-white/10 bg-[#0b1016] text-white shadow-2xl">
          <div className="shrink-0 px-4 pt-4">
            <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/15" />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            <div className="rounded-[30px] border border-emerald-200/10 bg-emerald-200/[0.04] p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-emerald-100/55">Первый запуск</div>
              <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-[-0.04em]">
                Это голосовое финансовое приложение.
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/58">
                Сначала скажи имя помощника, потом команду. Приложение подготовит действие, покажет подтверждение или задаст короткий вопрос.
              </p>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="app-check-row">
                <b>1. Имя помощника</b>
                <span>По умолчанию — Фина. Можно изменить сейчас или позже в настройках.</span>
              </div>
              <div className="app-check-row">
                <b>2. Команда обычным языком</b>
                <span>Например: “{normalizedName}, кофе 300” или “{normalizedName}, создай цель отпуск 120000”.</span>
              </div>
              <div className="app-check-row">
                <b>3. Проверка перед действием</b>
                <span>Если действие рискованное или неполное, помощник ждёт подтверждение или уточнение и продолжает слушать.</span>
              </div>
            </div>

            <label className="voice-first-intro__field">
              <span>Имя помощника</span>
              <input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="Фина"
                maxLength={24}
              />
            </label>

            <div className="mt-4 grid gap-2">
              {examples.map((example) => (
                <button key={example} type="button" className="app-list-button" onClick={() => runExample(example)}>
                  <span>{example.replace(/^Фина/i, normalizedName)}</span>
                  <small>Нажми, чтобы попробовать текстом</small>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2 border-t border-white/10 p-4">
            <button type="button" className="app-primary-button w-full" onClick={() => finish(true)}>
              Продолжить и включить голос
            </button>
            <button type="button" className="app-secondary-button w-full" onClick={() => finish(false)}>
              Продолжить без микрофона
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
