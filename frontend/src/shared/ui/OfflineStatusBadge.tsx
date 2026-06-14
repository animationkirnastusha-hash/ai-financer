import { useEffect, useState } from 'react';
import { useI18n } from '@/shared/lib/i18n';

export function OfflineStatusBadge() {
  const { t } = useI18n();
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);

  useEffect(() => {
    const update = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!isOffline) return null;
  return <div className="offline-status-badge">{t('offline.badge')}</div>;
}
