import { FormEvent, useEffect, useState } from 'react';
import type { AdminUser } from '@/features/admin/api/admin.api';
import { useI18n } from '@/shared/lib/i18n';
import { formatDate } from './adminPage.formatters';

type Props = {
  users: AdminUser[];
  searchQuery: string;
  resettingUserId: string | null;
  onSearch: (query: string) => void;
  onResetUser: (userId: string, mode: 'finance' | 'full') => void;
};

function userName(user: AdminUser) {
  return `${user.firstName} ${user.lastName ?? ''}`.trim() || user.username || user.publicId;
}

export function AdminUsersPanel({
  users,
  searchQuery,
  resettingUserId,
  onSearch,
  onResetUser,
}: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState(searchQuery);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setQuery(searchQuery);
  }, [searchQuery]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch(query.trim());
  };

  const copyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      window.setTimeout(() => setCopied((current) => (current === value ? null : current)), 1300);
    } catch {
      setCopied(null);
    }
  };

  return (
    <section className="admin-users-panel">
      <form className="app-card admin-users-search" onSubmit={submitSearch}>
        <div>
          <div className="app-eyebrow">{t('admin.users.search.eyebrow')}</div>
          <h2>{t('admin.users.search.title')}</h2>
          <p>{t('admin.users.search.caption')}</p>
        </div>
        <div className="admin-users-search__controls">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('admin.users.search.placeholder')}
            inputMode="search"
          />
          <button type="submit">{t('admin.users.search.action')}</button>
        </div>
      </form>

      {!searchQuery ? (
        <div className="app-card admin-users-empty">
          <b>{t('admin.users.empty.title')}</b>
          <span>{t('admin.users.empty.caption')}</span>
        </div>
      ) : null}

      {searchQuery && users.length === 0 ? (
        <div className="app-card admin-users-empty">
          <b>{t('admin.users.noResults.title')}</b>
          <span>{t('admin.users.noResults.caption')}</span>
        </div>
      ) : null}

      <div className="admin-users-list">
        {users.map((item) => (
          <article key={item.id} className="app-card admin-user-card">
            <div className="admin-user-card__head">
              <div className="admin-user-card__identity">
                <strong>{userName(item)}</strong>
                <span>@{item.username ?? '—'} · Telegram {item.telegramId}</span>
              </div>
              <div className="admin-user-card__badges">
                <button type="button" onClick={() => void copyValue(item.publicId)}>
                  ID {item.publicId}
                  <small>{copied === item.publicId ? t('common.copied') : t('common.copy')}</small>
                </button>
                <em>{item.tier}</em>
              </div>
            </div>

            <div className="admin-user-card__meta">
              <button type="button" onClick={() => void copyValue(item.telegramId)}>{t('admin.users.copyTelegram')}</button>
              <span>{t('admin.users.created')}: {formatDate(item.createdAt)}</span>
              <span>{t('admin.users.activity')}: {formatDate(item.lastActiveAt)}</span>
            </div>

            <div className="admin-user-stats">
              <div><span>{t('admin.users.accounts')}</span><b>{item._count.accounts}</b></div>
              <div><span>{t('admin.users.transactions')}</span><b>{item._count.transactions}</b></div>
              <div><span>{t('admin.users.referrals')}</span><b>{item._count.referrals}</b></div>
            </div>

            <div className="admin-user-actions admin-user-actions--danger">
              <button type="button" disabled={resettingUserId !== null} onClick={() => onResetUser(item.id, 'finance')}>
                {resettingUserId === item.id + ':finance' ? t('admin.users.reset.finance.loading') : t('admin.users.reset.finance')}
              </button>
              <button type="button" disabled={resettingUserId !== null} onClick={() => onResetUser(item.id, 'full')}>
                {resettingUserId === item.id + ':full' ? t('admin.users.reset.full.loading') : t('admin.users.reset.full')}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
