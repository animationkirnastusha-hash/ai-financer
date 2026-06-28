import type { AdminLoadError } from './adminPage.types';

type Props = {
  isLoading: boolean;
  errors: AdminLoadError;
};

export function AdminLoadState({ isLoading, errors }: Props) {
  const hasErrors = Object.values(errors).some(Boolean);

  return (
    <>
      {isLoading ? <div className="app-card admin-load-card">Загрузка…</div> : null}
      {hasErrors ? (
        <div className="app-card admin-load-card admin-load-card--danger">
          {errors.overview ? <div>Обзор: {errors.overview}</div> : null}
          {errors.users ? <div>Пользователи: {errors.users}</div> : null}
          {errors.events ? <div>События: {errors.events}</div> : null}
        </div>
      ) : null}
    </>
  );
}
