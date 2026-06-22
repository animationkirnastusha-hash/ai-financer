import type { SubscriptionStatusDto } from '@/features/subscription/api/subscription.api';
import { Drawer } from '@/shared/ui/Drawer';
import { useI18n } from '@/shared/lib/i18n';

type Props = {
  open: boolean;
  subscription: SubscriptionStatusDto | null;
  onClose: () => void;
  layer?: number;
};

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' }).format(date);
}

export function StoreLimitsSheet({ open, subscription, onClose, layer }: Props) {
  const { t } = useI18n();
  const usage = subscription?.usage;
  const packageCredits = subscription?.packageCredits;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t('store.limits.sheetTitle')}
      subtitle={t('store.limits.sheetCaption')}
      className="store-limits-sheet"
      bodyClassName="store-limits-sheet__body"
      layer={layer}
    >
      <div className="store-limits-list">
        <article>
          <span>{t('store.limits.voiceToday')}</span>
          <strong>{usage ? `${usage.voiceCommandsToday.remaining} / ${usage.voiceCommandsToday.limit}` : '—'}</strong>
        </article>
        <article>
          <span>{t('store.limits.receipts')}</span>
          <strong>{packageCredits ? packageCredits.receiptScans.remaining : usage?.receiptScansThisMonth.remaining ?? '—'}</strong>
        </article>
        <article>
          <span>{t('store.limits.analysis')}</span>
          <strong>{packageCredits ? packageCredits.advancedReports.remaining : usage?.advancedReportsThisMonth.remaining ?? '—'}</strong>
        </article>
        <article>
          <span>{t('store.limits.reports')}</span>
          <strong>{packageCredits?.reports.remaining ?? 0}</strong>
        </article>
      </div>

      <section className="store-active-packs">
        <div className="store-section-heading store-section-heading--compact">
          <div>
            <span className="app-eyebrow">{t('store.limits.activePacks')}</span>
            <h3>{t('store.limits.activePacksTitle')}</h3>
          </div>
        </div>
        {packageCredits?.activePacks?.length ? (
          <div className="store-active-pack-list">
            {packageCredits.activePacks.map((pack) => (
              <article key={pack.id}>
                <strong>{pack.title}</strong>
                <span>{t('store.limits.packExpires', { date: formatDate(pack.expiresAt) })}</span>
              </article>
            ))}
          </div>
        ) : (
          <p className="store-limits-empty">{t('store.limits.noPacks')}</p>
        )}
      </section>
    </Drawer>
  );
}
