import { OnboardingStepShell } from '@/features/onboarding/ui/OnboardingStepShell';

const rules = [
  {
    title: 'Зажми Фину',
    text: 'Пока держишь — идёт запись. Отпустил — команда отправилась.',
  },
  {
    title: 'Свайп вверх — закрепить',
    text: 'Можно убрать палец и спокойно договорить мысль. Когда закончил — нажми Фину ещё раз.',
  },
  {
    title: 'Свайп влево — отменить',
    text: 'Если передумал или сказал не то, запись удалится и ничего не отправится.',
  },
];

const examples = [
  'кофе 300 с налички',
  'создай счёт Карта, у меня там 20000 рублей',
  'создай цель отпуск 120000',
];

export function VoiceIntroStep() {
  return (
    <OnboardingStepShell
      eyebrow="Голос"
      title="Говори через зажатие Фины"
      description="Сейчас Фина не слушает фон сама. Ты управляешь записью: зажал, сказал, отпустил. Это защищает от случайных команд и лишних списаний."
    >
      <div className="onboarding-voice-card onboarding-voice-card--manual">
        <div className="onboarding-voice-card__pulse" />
        <div>
          <strong>Без ключевой фразы</strong>
          <span>Когда ты сам зажал Фину, имя говорить не нужно. Можно сразу сказать команду.</span>
        </div>
      </div>

      <div className="onboarding-rule-list">
        {rules.map((rule) => (
          <div key={rule.title}>
            <strong>{rule.title}</strong>
            <span>{rule.text}</span>
          </div>
        ))}
      </div>

      <div className="onboarding-example-list">
        {examples.map((example) => (
          <div key={example} className="onboarding-example-item">
            <span>{example}</span>
            <small>Фина подготовит действие, а ты проверишь результат перед важными изменениями.</small>
          </div>
        ))}
      </div>
    </OnboardingStepShell>
  );
}
