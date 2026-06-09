import { useEffect, useMemo, useState } from 'react';
import { referralApi, type ReferralInfoDto, type ReferralTransactionDto } from '@/features/referral/api/referral.api';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useI18n } from '@/shared/lib/i18n';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';

function formatBonus(value: number) {
  if (!value) return '0 ₽';
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value / 100);
}

function transactionText(item: ReferralTransactionDto) {
  if (item.type === 'invite_activated') return `+${item.amount} день Premium`;
  if (item.type === 'premium_purchase_days' || item.type === 'business_purchase_days') return `+${item.amount} дней Premium`;
  if (item.type === 'purchase_bonus_balance') return `+${formatBonus(item.amount)}`;
  return `+${item.amount}`;
}

export default function ReferralPage() {
  const { t } = useI18n();
  const user = useAuthStore((state) => state.user);
  const [info, setInfo] = useState<ReferralInfoDto | null>(null);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inviteText = useMemo(() => t('referral.inviteText', { code: info?.referralCode || '—' }), [info?.referralCode, t]);
  const friendsCount = info?.referrals.length ?? 0;
  const rewardsCount = info?.referralTransactions.length ?? 0;

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      setInfo(await referralApi.me());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('referral.error'));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const showCopied = () => {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const copy = async () => {
    if (!info?.referralCode) return;
    await navigator.clipboard?.writeText(info.referralCode);
    showCopied();
  };

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ text: inviteText });
      return;
    }
    await navigator.clipboard?.writeText(inviteText);
    showCopied();
  };

  const apply = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      setInfo(await referralApi.applyCode(trimmed));
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('referral.applyError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-page referral-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title={t('common.referrals')} left="back" right={['home']} />

        <header className="referral-hero app-card app-card--hero">
          <div>
            <div className="app-eyebrow">{t('referral.hero.eyebrow')}</div>
            <h1>{t('referral.hero.title')}</h1>
            <p>{t('referral.hero.caption')}</p>
          </div>
          <div className="referral-hero__stats" aria-label={t('referral.stats.label')}>
            <article><strong>{friendsCount}</strong><span>{t('referral.stats.friends')}</span></article>
            <article><strong>{rewardsCount}</strong><span>{t('referral.stats.rewards')}</span></article>
            <article><strong>{formatBonus(info?.referralBalance ?? 0)}</strong><span>{t('referral.stats.balance')}</span></article>
          </div>
        </header>

        <section className="referral-code-panel app-card">
          <div className="referral-code-panel__main">
            <span>{t('referral.code.label')}</span>
            <strong>{busy && !info ? '—' : info?.referralCode || '—'}</strong>
            <small>{copied ? t('referral.copied') : t('referral.code.caption')}</small>
          </div>
          <div className="referral-code-panel__actions">
            <button type="button" className="app-secondary-button" onClick={copy} disabled={!info?.referralCode}>{t('referral.copy')}</button>
            <button type="button" className="app-primary-button" onClick={share} disabled={!info?.referralCode}>{t('referral.share')}</button>
          </div>
        </section>

        {!info?.referrer ? (
          <section className="referral-apply-card app-card">
            <div>
              <div className="app-eyebrow">{t('referral.apply.eyebrow')}</div>
              <h2>{t('referral.apply.title')}</h2>
              <p>{t('referral.apply.caption')}</p>
            </div>
            <div className="referral-apply-card__form">
              <input value={code} onChange={(event) => setCode(event.target.value)} placeholder={t('referral.apply.placeholder')} />
              <button type="button" className="app-primary-button" onClick={apply} disabled={busy || !code.trim()}>{t('referral.apply.action')}</button>
            </div>
          </section>
        ) : null}

        {error ? <div className="app-card app-card--danger">{error}</div> : null}

        <section className="referral-benefits-grid">
          <article className="app-card referral-benefit-card">
            <b>{t('referral.rule.activation.title')}</b>
            <span>{t('referral.rule.activation.caption')}</span>
          </article>
          <article className="app-card referral-benefit-card">
            <b>{t('referral.rule.purchase.title')}</b>
            <span>{t('referral.rule.purchase.caption')}</span>
          </article>
          <article className="app-card referral-benefit-card">
            <b>{t('referral.rule.balance.title')}</b>
            <span>{t('referral.rule.balance.caption')}</span>
          </article>
        </section>

        <section className="app-card referral-list-card">
          <div className="referral-section-head">
            <div>
              <div className="app-eyebrow">{t('referral.friends.eyebrow')}</div>
              <h2>{t('referral.friends.title')}</h2>
            </div>
            <span>{friendsCount}</span>
          </div>
          <div className="referral-list">
            {(info?.referrals ?? []).length ? info!.referrals.map((friend) => (
              <article key={friend.id}>
                <b>{friend.firstName || friend.username || t('referral.friendFallback')}</b>
                <span>{friend.activated ? t('referral.friendActivated') : t('referral.friendPending')}</span>
              </article>
            )) : <div className="referral-empty">{t('referral.friends.empty')}</div>}
          </div>
        </section>

        <section className="app-card referral-list-card">
          <div className="referral-section-head">
            <div>
              <div className="app-eyebrow">{t('referral.history.eyebrow')}</div>
              <h2>{t('referral.history.title')}</h2>
            </div>
            <span>{rewardsCount}</span>
          </div>
          <div className="referral-list">
            {(info?.referralTransactions ?? []).length ? info!.referralTransactions.map((item) => (
              <article key={item.id}>
                <b>{transactionText(item)}</b>
                <span>{item.fromUser?.firstName || item.fromUser?.username || t('referral.friendFallback')}</span>
              </article>
            )) : <div className="referral-empty">{t('referral.history.empty')}</div>}
          </div>
        </section>

        <section className="app-card referral-balance-card">
          <div>
            <div className="app-eyebrow">{t('referral.balance.eyebrow')}</div>
            <h2>{formatBonus(info?.referralBalance ?? 0)}</h2>
            <p>{t('referral.balance.caption')}</p>
          </div>
          <button type="button" className="app-secondary-button" disabled>{t('referral.balance.withdrawSoon')}</button>
        </section>

        {user?.isAdmin ? <button type="button" className="app-secondary-button w-full" onClick={load}>{t('referral.refresh')}</button> : null}
      </div>
    </div>
  );
}
