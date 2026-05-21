import { useEffect, useMemo, useState } from 'react';
import { referralApi, type ReferralInfo } from '@/features/referral/api/referral.api';
import { ScreenTopBar } from '@/shared/ui/ScreenTopBar';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(date);
}

export default function ReferralPage() {
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    referralApi.getInfo()
      .then((payload) => {
        if (!cancelled) setReferral(payload.referral);
      })
      .catch(() => {
        if (!cancelled) setStatus('Не удалось загрузить реферальные данные');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const shareText = useMemo(() => {
    if (!referral?.referralCode) return '';
    return `Попробуй AI-Financer. Мой код: ${referral.referralCode}`;
  }, [referral?.referralCode]);

  const copyCode = async () => {
    if (!referral?.referralCode) return;
    await navigator.clipboard?.writeText(referral.referralCode);
    setStatus('Код скопирован');
  };

  const share = async () => {
    if (!shareText) return;
    if (navigator.share) {
      await navigator.share({ text: shareText });
      return;
    }
    await navigator.clipboard?.writeText(shareText);
    setStatus('Текст приглашения скопирован');
  };

  const applyCode = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setIsLoading(true);
    setStatus(null);
    try {
      const payload = await referralApi.applyCode(trimmed);
      setReferral(payload.referral);
      setCode('');
      setStatus('Код применён');
    } catch {
      setStatus('Код не найден или уже применён');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 pb-28 pt-4 text-white">
      <div className="mx-auto max-w-[620px] space-y-4">
        <ScreenTopBar title="Рефералы" left="back" right={['home']} />

        <header className="rounded-[34px] border border-white/10 bg-white/[0.045] p-5">
          <div className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">приглашения</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">Реферальная система</h1>
          <p className="mt-2 text-sm leading-6 text-white/50">Приглашай людей и смотри статус приглашений.</p>
        </header>

        <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
          <div className="text-sm text-white/42">Твой код</div>
          <div className="mt-2 break-all text-3xl font-semibold tracking-[0.08em] text-emerald-100">
            {referral?.referralCode ?? '—'}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="button" onClick={copyCode} className="rounded-[22px] bg-white/10 px-4 py-3 text-sm font-medium">Скопировать</button>
            <button type="button" onClick={share} className="rounded-[22px] bg-emerald-300/15 px-4 py-3 text-sm font-medium text-emerald-100">Поделиться</button>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-white/34">Приглашено</div>
            <div className="mt-2 text-2xl font-semibold">{referral?.referrals.length ?? 0}</div>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-white/34">Баланс</div>
            <div className="mt-2 text-2xl font-semibold">{referral?.referralBalance ?? 0}</div>
          </div>
        </section>

        <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
          <div className="font-semibold">Ввести чужой код</div>
          <div className="mt-3 flex gap-2">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Код приглашения"
              className="min-w-0 flex-1 rounded-[20px] border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/28"
            />
            <button type="button" onClick={applyCode} disabled={isLoading} className="rounded-[20px] bg-white/10 px-4 py-3 text-sm font-medium disabled:opacity-40">
              ОК
            </button>
          </div>
          {referral?.referrer ? <div className="mt-3 text-sm text-white/45">Тебя пригласил: {referral.referrer.firstName}</div> : null}
          {status ? <div className="mt-3 text-sm text-white/45">{status}</div> : null}
        </section>

        <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
          <div className="font-semibold">Приглашённые</div>
          <div className="mt-4 space-y-2">
            {referral?.referrals.length ? referral.referrals.map((item) => (
              <div key={item.id} className="rounded-[18px] bg-black/18 px-4 py-3">
                <div className="font-medium">{item.firstName}</div>
                <div className="mt-1 text-xs text-white/38">@{item.username ?? '—'} · {formatDate(item.createdAt)}</div>
              </div>
            )) : <div className="text-sm text-white/42">Пока нет приглашённых.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
