import { useMemo, useState } from 'react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { useNavigationStore } from '@/features/navigation/model/navigation.store';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';

const rewardRules = [
  ['Друг зарегистрировался', '+3 дня Premium обоим'],
  ['Друг купил Premium', '+14 дней пригласившему'],
  ['Антиабуз', 'один Telegram ID, лимиты и активность'],
];

function buildMockCode(userId?: string | null, username?: string | null) {
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
          <p className="app-hero-caption">Сейчас этот раздел доступен только админу, чтобы тестерам не мешала монетизация.</p>
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

  const referralCode = useMemo(() => buildMockCode(user?.id, user?.username), [user?.id, user?.username]);
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
          <div className="app-eyebrow">Admin-only прототип</div>
          <h1>Реферальная раздача Premium</h1>
          <p>Пока это frontend-макет. Backend позже сохранит связи, начисления и защиту от абуза.</p>
        </header>

        <section className="referral-admin-code-card">
          <div>
            <span>Твой код</span>
            <strong>{referralCode}</strong>
            <small>{copied ? 'Скопировано' : 'Можно использовать для теста будущего UX.'}</small>
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
              <div className="app-eyebrow">Будущая админка</div>
              <h2>Что понадобится в backend</h2>
            </div>
          </div>
          <div className="referral-admin-roadmap">
            <span>referralCode</span>
            <span>invitedByUserId</span>
            <span>referrals count</span>
            <span>premiumDaysBalance</span>
            <span>manual grant</span>
            <span>anti-abuse log</span>
          </div>
        </section>
      </div>
    </div>
  );
}
