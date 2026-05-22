import { useOnboardingStore } from '@/features/onboarding/model/onboarding.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useSettingsStore } from '@/features/settings/model/settings.store';

const examples = [
  'Фина, у меня есть 10000 наличными',
  'Фина, кофе 300',
  'Фина, создай цель отпуск 120000',
];

export function LaunchOnboardingSheet() {
  const isOpen = useOnboardingStore((state) => state.isOpen);
  const close = useOnboardingStore((state) => state.close);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);
  const companionName = useSettingsStore((state) => state.companionName) || 'Фина';

  if (!isOpen) return null;

  const runExample = (command: string) => {
    close();
    openAIWithCommand(command.replace(/^Фина/i, companionName));
  };

  return (
    <div className="app-onboarding" data-no-swipe="true">
      <div className="app-onboarding__sheet">
        <div className="app-onboarding__handle" />

        <div className="app-onboarding__hero">
          <div className="app-onboarding__badge">Первый запуск</div>
          <h2>Финансы голосом, без сложных меню</h2>
          <p>
            Скажи имя помощника, потом обычную команду. Я покажу действие перед изменением денег, а спорные моменты уточню коротким вопросом.
          </p>
        </div>

        <div className="app-onboarding__steps">
          <div className="app-onboarding__step">
            <span>1</span>
            <div><b>Позови помощника</b><small>По умолчанию: “{companionName}”.</small></div>
          </div>
          <div className="app-onboarding__step">
            <span>2</span>
            <div><b>Скажи задачу</b><small>Например: “у меня есть 10к наличными”.</small></div>
          </div>
          <div className="app-onboarding__step">
            <span>3</span>
            <div><b>Подтверди или уточни</b><small>После вопроса микрофон продолжит слушать.</small></div>
          </div>
        </div>

        <div className="app-onboarding__examples">
          <div className="app-onboarding__caption">Можно попробовать</div>
          {examples.map((example) => (
            <button key={example} type="button" onClick={() => runExample(example)}>
              {example.replace(/^Фина/i, companionName)}
            </button>
          ))}
        </div>

        <div className="app-onboarding__actions">
          <button
            type="button"
            className="app-onboarding__primary"
            onClick={() => {
              close();
              openAIWithCommand(`${companionName}, у меня есть 10000 наличными`);
            }}
          >
            Настроить первый баланс
          </button>
          <button
            type="button"
            className="app-onboarding__secondary"
            onClick={() => {
              close();
              navigateTo('dashboard');
            }}
          >
            Перейти на главную
          </button>
        </div>
      </div>
    </div>
  );
}
