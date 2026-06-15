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
    id: 'firstExpense',
    titleKey: 'learning.task.expense.title',
    captionKey: 'learning.task.expense.caption',
    command: 'Потратил на кофе',
  },
  {
    id: 'firstQuestion',
    titleKey: 'learning.task.question.title',
    captionKey: 'learning.task.question.caption',
    command: 'Сколько я потратил сегодня?',
  },
  {
    id: 'firstGoal',
    titleKey: 'learning.task.goal.title',
    captionKey: 'learning.task.goal.caption',
    command: 'Создай цель на отпуск',
  },
  {
    id: 'firstLimit',
    titleKey: 'learning.task.limit.title',
    captionKey: 'learning.task.limit.caption',
    command: 'Поставь лимит на кафе',
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
