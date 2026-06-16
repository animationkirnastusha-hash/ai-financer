import { useMemo } from 'react';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { useLearningProgressStore, type LearningProgressStep } from '@/features/onboarding/model/learning-progress.store';
import { useI18n, type I18nKey } from '@/shared/lib/i18n';

type LearningTask = {
  id: LearningProgressStep;
  titleKey: I18nKey;
  captionKey: I18nKey;
  command: string;
};

const tasks: LearningTask[] = [
  {
    id: 'firstQuestion',
    titleKey: 'learning.task.help.title',
    captionKey: 'learning.task.help.caption',
    command: 'Как с тобой работать?',
  },
  {
    id: 'firstExpense',
    titleKey: 'learning.task.account.title',
    captionKey: 'learning.task.account.caption',
    command: 'Создай первый счёт',
  },
  {
    id: 'firstGoal',
    titleKey: 'learning.task.firstStep.title',
    captionKey: 'learning.task.firstStep.caption',
    command: 'Что лучше сделать первым?',
  },
];

export function ProductLearningCard() {
  const { t } = useI18n();
  const openAIWithCommand = useNavigationStore((state) => state.openAIWithCommand);
  const completed = useLearningProgressStore((state) => state.completed);
  const isDismissed = useLearningProgressStore((state) => state.isDismissed);
  const mark = useLearningProgressStore((state) => state.mark);
  const dismiss = useLearningProgressStore((state) => state.dismiss);

  const completedCount = useMemo(() => tasks.filter((task) => completed[task.id]).length, [completed]);
  const isComplete = completedCount >= tasks.length;

  if (isDismissed) return null;

  const startTask = (task: LearningTask) => {
    mark(task.id);
    openAIWithCommand(task.command);
  };

  return (
    <section className="app-card product-learning-card">
      <div className="product-learning-card__head">
        <div>
          <div className="app-eyebrow">{isComplete ? t('learning.done.eyebrow') : t('learning.eyebrow')}</div>
          <h2>{isComplete ? t('learning.done.title') : t('learning.title')}</h2>
          <p>{isComplete ? t('learning.done.caption') : t('learning.caption')}</p>
        </div>
        <button type="button" className="product-learning-card__close" onClick={dismiss} aria-label={t('common.close')}>×</button>
      </div>

      {!isComplete ? (
        <>
          <div className="product-learning-card__progress" aria-hidden="true">
            <span style={{ width: `${Math.round((completedCount / tasks.length) * 100)}%` }} />
          </div>
          <div className="product-learning-card__tasks">
            {tasks.map((task) => (
              <button
                key={task.id}
                type="button"
                className="product-learning-task"
                data-complete={completed[task.id] ? 'true' : 'false'}
                onClick={() => startTask(task)}
              >
                <span>{completed[task.id] ? '✓' : '•'}</span>
                <b>{t(task.titleKey)}</b>
                <small>{t(task.captionKey)}</small>
              </button>
            ))}
          </div>
        </>
      ) : (
        <button type="button" className="app-secondary-button app-secondary-button--compact" onClick={dismiss}>
          {t('learning.done.action')}
        </button>
      )}
    </section>
  );
}
