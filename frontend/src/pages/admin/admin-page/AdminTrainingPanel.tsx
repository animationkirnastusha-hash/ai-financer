import type { Dispatch, SetStateAction } from 'react';
import type { AdminAITrainingExample } from '@/features/admin/api/admin.api';
import { formatDate } from './adminPage.formatters';

type Props = {
  trainingExamples: AdminAITrainingExample[];
  trainingDrafts: Record<string, string>;
  trainingBusyId: string | null;
  isTrainingLoading: boolean;
  setTrainingDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  onReload: () => void;
  onSave: (exampleId: string, success: boolean) => void;
};

export function AdminTrainingPanel({
  trainingExamples,
  trainingDrafts,
  trainingBusyId,
  isTrainingLoading,
  setTrainingDrafts,
  onReload,
  onSave,
}: Props) {
  return (
    <section className="admin-ai-training space-y-3">
      <div className="app-card admin-ai-training__hero">
        <div>
          <div className="app-eyebrow">Разбор Фины</div>
          <h2>Ошибки и уточнения</h2>
          <p>Здесь собираются команды, где Фина ошиблась, попросила уточнение или подготовила действие на проверку.</p>
        </div>
        <button type="button" className="app-secondary-button" onClick={onReload} disabled={isTrainingLoading}>
          {isTrainingLoading ? 'Обновляю…' : 'Обновить'}
        </button>
      </div>

      {isTrainingLoading && !trainingExamples.length ? <div className="app-card text-sm text-white/50">Загрузка…</div> : null}

      {trainingExamples.length ? trainingExamples.map((item) => (
        <article key={item.id} className="app-card admin-ai-training__item">
          <div className="admin-ai-training__top">
            <span className={item.success ? 'admin-ai-training__badge is-success' : 'admin-ai-training__badge is-warning'}>
              {item.success ? 'Размечено' : 'Нужно проверить'}
            </span>
            <small>{formatDate(item.createdAt)}</small>
          </div>

          <div className="admin-ai-training__block">
            <span>Команда</span>
            <p>{item.input}</p>
          </div>

          {item.aiOutput ? (
            <div className="admin-ai-training__block">
              <span>Ответ Фины</span>
              <pre>{item.aiOutput}</pre>
            </div>
          ) : null}

          {item.error ? (
            <div className="admin-ai-training__error">{item.error}</div>
          ) : null}

          <label className="admin-ai-training__editor">
            <span>Как должно быть</span>
            <textarea
              value={trainingDrafts[item.id] ?? ''}
              onChange={(event) => setTrainingDrafts((state) => ({ ...state, [item.id]: event.target.value }))}
              rows={4}
              placeholder="Коротко опиши правильное действие или ответ."
            />
          </label>

          <div className="admin-ai-training__actions">
            <button
              type="button"
              className="app-secondary-button"
              disabled={trainingBusyId === item.id}
              onClick={() => onSave(item.id, false)}
            >
              Сохранить как ошибку
            </button>
            <button
              type="button"
              className="app-primary-button"
              disabled={trainingBusyId === item.id}
              onClick={() => onSave(item.id, true)}
            >
              Отметить исправленным
            </button>
          </div>
        </article>
      )) : (
        <div className="app-card text-sm text-white/50">Пока нет примеров для разбора.</div>
      )}
    </section>
  );
}
