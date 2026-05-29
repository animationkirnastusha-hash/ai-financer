import { useMemo, useState } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';

const rewardRules = [
  ['Друг зарегистрировался', '+3 дня Premium обоим'],
  ['Друг купил Premium', '+14 дней пригласившему'],
  ['Защита от накрутки', 'учитывается реальная активность и повторные регистрации'],
];

function buildReferralCode(userId?: string | null, username?: string | null) {
  const seed = username || userId || 'ADMIN';
  return `FINA-${seed.toString().replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() || 'ADMIN'}`;
}

function AdminOnlyFallback() {
  const goHome = useNavigationStore((state) => state.goHome);

  return (
    <div className="app-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title="Рефералы" left="back" right={['home']} />
        <section className="app-card app-card--hero">
          <div className="app-eyebrow">Скоро</div>
          <h1 className="app-hero-title">Рефералы скрыты</h1>
          <p className="app-hero-caption">Раздел скоро станет доступен. Сейчас можно продолжать пользоваться приложением как обычно.</p>
          <button type="button" className="app-primary-button mt-4" onClick={goHome}>На главную</button>
        </section>
      </div>
    </div>
  );
}

export default function ReferralPage() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = Boolean(user?.isAdmin);
  const [copied, setCopied] = useState(false);

  const referralCode = useMemo(() => buildReferralCode(user?.id, user?.username), [user?.id, user?.username]);
  const inviteText = `Попробуй AI-Financer. Мой код: ${referralCode}`;

  const copy = async () => {
    await navigator.clipboard?.writeText(referralCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ text: inviteText });
      return;
    }
    await navigator.clipboard?.writeText(inviteText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  if (!isAdmin) return <AdminOnlyFallback />;

  return (
    <div className="app-page referral-admin-page text-white">
      <div className="app-page__inner space-y-4">
        <ScreenTopBar title="Рефералы" left="back" right={['home', 'settings']} />

        <header className="referral-admin-hero">
          <div className="app-eyebrow">Приглашения</div>
          <h1>Реферальная раздача Premium</h1>
          <p>Приглашай друзей и получай бонусные дни Premium, когда программа станет доступна.</p>
        </header>

        <section className="referral-admin-code-card">
          <div>
            <span>Твой код</span>
            <strong>{referralCode}</strong>
            <small>{copied ? 'Скопировано' : 'Поделись кодом, когда пригласительная программа будет открыта.'}</small>
          </div>
          <div className="referral-admin-code-card__actions">
            <button type="button" className="app-secondary-button" onClick={copy}>Скопировать</button>
            <button type="button" className="app-primary-button" onClick={share}>Поделиться</button>
          </div>
        </section>

        <section className="app-card referral-admin-section">
          <div className="referral-admin-section__head">
            <div>
              <div className="app-eyebrow">Правила</div>
              <h2>Как будет работать</h2>
            </div>
          </div>
          <div className="referral-admin-rules">
            {rewardRules.map(([title, caption]) => (
              <article key={title}>
                <b>{title}</b>
                <span>{caption}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="app-card referral-admin-section">
          <div className="referral-admin-section__head">
            <div>
              <div className="app-eyebrow">Скоро</div>
              <h2>Что появится в рефералах</h2>
            </div>
          </div>
          <div className="referral-admin-roadmap">
            <span>личная ссылка</span>
            <span>история приглашений</span>
            <span>количество друзей</span>
            <span>бонусные дни Premium</span>
            <span>ручное начисление</span>
            <span>защита от накрутки</span>
          </div>
        </section>
      </div>
    </div>
  );
}
