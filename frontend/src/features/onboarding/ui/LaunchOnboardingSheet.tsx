import { useEffect } from 'react';
import { useOnboardingStore } from '@/features/onboarding/model/onboarding.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { CompanionButton } from '@/shared/ui/CompanionButton';

const steps = [
  ['1', 'Позови Фину', 'Скажи “Фина”, затем финансовую задачу обычным языком.'],
  ['2', 'Проверь действие', 'Счета, операции и цели не меняются без понятного превью.'],
  ['3', 'Ответь коротко', 'Можно сказать: “да”, “отмени”, “на карту”, “создай наличку”.'],
];

const examples = [
  'Фина, у меня есть 10к наличными',
  'Фина, кофе 350 с карты',
  'Фина, создай цель отпуск 120000',
];

export function LaunchOnboardingSheet() {
  const isOpen = useOnboardingStore((state) => state.isOpen);
  const close = useOnboardingStore((state) => state.close);
  const navigateTo = useNavigationStore((state) => state.navigateTo);
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);

  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add('ai-any-modal-open');
    document.documentElement.classList.add('ai-any-modal-open');
    return () => {
      document.body.classList.remove('ai-any-modal-open');
      document.documentElement.classList.remove('ai-any-modal-open');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const runExample = (command: string) => {
    close();
    openAIWithCommand(command);
  };

  return (
    <div className="app-modal-backdrop px-3" data-no-swipe="true" data-ai-core-modal="true">
      <div className="app-modal-sheet app-launch-onboarding max-w-[560px]" data-no-swipe="true" data-ai-core-modal="true">
        <div className="app-modal-handle" />

        <div className="app-modal-body space-y-4">
          <section className="app-onboarding-hero">
            <div className="app-onboarding-hero__avatar" aria-hidden="true">
              <CompanionButton mood="success" size="md" label="Фина" />
            </div>
            <div className="app-eyebrow">Первый запуск</div>
            <h2>Познакомься с Финой</h2>
            <p>
              Фина — голосовой финансовый помощник. Она слушает после своего имени,
              понимает обычные команды и просит подтверждение перед важными действиями.
            </p>
          </section>

          <section className="grid gap-3">
            {steps.map(([step, title, description]) => (
              <div key={step} className="app-onboarding-step">
                <div>{step}</div>
                <span><b>{title}</b><small>{description}</small></span>
              </div>
            ))}
          </section>

          <section className="app-onboarding-examples">
            <div className="app-eyebrow">Можно попробовать сразу</div>
            <div className="mt-3 grid gap-2">
              {examples.map((example) => (
                <button key={example} type="button" onClick={() => runExample(example)} className="app-list-button">
                  <span>{example}</span>
                  <small>Фина откроет превью и попросит подтверждение</small>
                </button>
              ))}
            </div>
          </section>
        </div>

        <footer className="app-modal-footer">
          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => {
                close();
                openAIWithCommand('Фина, создай первый счет');
              }}
              className="app-primary-button w-full"
            >
              Начать с Финой
            </button>
            <button
              type="button"
              onClick={() => {
                close();
                navigateTo('dashboard');
              }}
              className="app-secondary-button w-full"
            >
              Сначала посмотреть главную
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
