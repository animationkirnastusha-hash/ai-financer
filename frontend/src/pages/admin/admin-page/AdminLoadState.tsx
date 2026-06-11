import type { AdminLoadError } from './adminPage.types';

type Props = {
  isLoading: boolean;
  errors: AdminLoadError;
};

export function AdminLoadState({ isLoading, errors }: Props) {
  const hasErrors = Object.values(errors).some(Boolean);

  return (
    <>
      {isLoading ? <div className="app-card text-sm text-white/50">Загрузка…</div> : null}
      {hasErrors ? (
        <div className="app-card border-red-400/20 bg-red-500/10 text-sm text-red-100">
          {errors.overview ? <div>Обзор: {errors.overview}</div> : null}
          {errors.users ? <div>Пользователи: {errors.users}</div> : null}
          {errors.events ? <div>События: {errors.events}</div> : null}
        </div>
      ) : null}
    </>
  );
}
