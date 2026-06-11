import type { AdminUser } from '@/features/admin/api/admin.api';
import { formatDate, formatSubscriptionDate } from './adminPage.formatters';

type Props = {
  users: AdminUser[];
  resettingUserId: string | null;
  subscriptionBusy: string | null;
  subscriptionDays: Record<string, string>;
  onSubscriptionDaysChange: (userId: string, value: string) => void;
  onResetUser: (userId: string, mode: 'finance' | 'full') => void;
  onGrantSubscription: (userId: string, product: 'premium' | 'business', lifetime?: boolean) => void;
  onRevokeSubscription: (userId: string, product: 'premium' | 'business') => void;
  onRestartTrial: (userId: string) => void;
};

export function AdminUsersPanel({
  users,
  resettingUserId,
  subscriptionBusy,
  subscriptionDays,
  onSubscriptionDaysChange,
  onResetUser,
  onGrantSubscription,
  onRevokeSubscription,
  onRestartTrial,
}: Props) {
  return (
    <section className="space-y-3">
      {users.map((item) => (
        <div key={item.id} className="app-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-semibold">{item.firstName} {item.lastName ?? ''}</div>
              <div className="mt-1 text-xs text-white/42">@{item.username ?? '—'} · {item.telegramId}</div>
            </div>
            <div className="rounded-full bg-white/8 px-3 py-1 text-xs text-white/60">{item.tier}</div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-white/55">
            <div className="rounded-[16px] bg-black/18 p-2">Счета<br /><b className="text-white">{item._count.accounts}</b></div>
            <div className="rounded-[16px] bg-black/18 p-2">Операции<br /><b className="text-white">{item._count.transactions}</b></div>
            <div className="rounded-[16px] bg-black/18 p-2">Рефералы<br /><b className="text-white">{item._count.referrals}</b></div>
          </div>

          <div className="mt-3 text-xs text-white/38">Создан: {formatDate(item.createdAt)} · активность: {formatDate(item.lastActiveAt)}</div>

          <div className="mt-3 rounded-[20px] border border-white/8 bg-black/18 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-white/80">Доступ</div>
                <div className="mt-1 text-[11px] text-white/40">
                  Premium: {item.subscription?.premiumLifetime ? 'навсегда' : formatSubscriptionDate(item.subscription?.premiumUntil)} · Business: {item.subscription?.businessLifetime ? 'навсегда' : formatSubscriptionDate(item.subscription?.businessUntil)}
                </div>
              </div>
              <button
                type="button"
                className="rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2 text-[11px] font-semibold text-white/70"
                disabled={subscriptionBusy !== null}
                onClick={() => onRestartTrial(item.id)}
              >
                {subscriptionBusy === `${item.id}:trial` ? 'Включаю…' : 'Триал'}
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <input
                value={subscriptionDays[item.id] ?? '30'}
                onChange={(event) => onSubscriptionDaysChange(item.id, event.target.value)}
                inputMode="numeric"
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2 text-xs text-white outline-none"
              />
              <span className="text-[11px] text-white/38">дней</span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-[11px] font-semibold text-emerald-100" disabled={subscriptionBusy !== null} onClick={() => onGrantSubscription(item.id, 'premium')}>Premium</button>
              <button type="button" className="rounded-2xl border border-sky-300/20 bg-sky-400/10 px-3 py-2 text-[11px] font-semibold text-sky-100" disabled={subscriptionBusy !== null} onClick={() => onGrantSubscription(item.id, 'business')}>Business</button>
              <button type="button" className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-[11px] font-semibold text-emerald-100" disabled={subscriptionBusy !== null} onClick={() => onGrantSubscription(item.id, 'premium', true)}>Premium навсегда</button>
              <button type="button" className="rounded-2xl border border-sky-300/20 bg-sky-400/10 px-3 py-2 text-[11px] font-semibold text-sky-100" disabled={subscriptionBusy !== null} onClick={() => onGrantSubscription(item.id, 'business', true)}>Business навсегда</button>
              <button type="button" className="rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2 text-[11px] font-semibold text-white/60" disabled={subscriptionBusy !== null} onClick={() => onRevokeSubscription(item.id, 'premium')}>Снять Premium</button>
              <button type="button" className="rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2 text-[11px] font-semibold text-white/60" disabled={subscriptionBusy !== null} onClick={() => onRevokeSubscription(item.id, 'business')}>Снять Business</button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="block w-full rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2.5 text-center text-xs font-bold text-white/88 transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-55"
              disabled={resettingUserId !== null}
              onClick={() => onResetUser(item.id, 'finance')}
            >
              {resettingUserId === item.id + ':finance' ? 'Сбрасываю…' : 'Сбросить финансы'}
            </button>
            <button
              type="button"
              className="block w-full rounded-2xl border border-rose-300/25 bg-rose-500/10 px-3 py-2.5 text-center text-xs font-bold text-rose-100 transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-55"
              disabled={resettingUserId !== null}
              onClick={() => onResetUser(item.id, 'full')}
            >
              {resettingUserId === item.id + ':full' ? 'Обнуляю…' : 'Обнулить всё'}
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
