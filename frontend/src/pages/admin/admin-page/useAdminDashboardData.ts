import { useEffect, useState } from 'react';
import { adminApi, type AdminEvent, type AdminOverview, type AdminUser } from '@/features/admin/api/admin.api';
import { errorMessage } from './adminPage.formatters';
import type { AdminLoadError } from './adminPage.types';

export function useAdminDashboardData(isAdmin: boolean) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<AdminLoadError>({});

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;
    setIsLoading(true);
    setErrors({});

    Promise.allSettled([
      adminApi.overview(),
      adminApi.users(),
      adminApi.events(),
    ])
      .then(([overviewResult, usersResult, eventsResult]) => {
        if (cancelled) return;
        const nextErrors: AdminLoadError = {};

        if (overviewResult.status === 'fulfilled') setOverview(overviewResult.value);
        else nextErrors.overview = errorMessage(overviewResult.reason);

        if (usersResult.status === 'fulfilled') setUsers(usersResult.value.users);
        else nextErrors.users = errorMessage(usersResult.reason);

        if (eventsResult.status === 'fulfilled') setEvents(eventsResult.value.events);
        else nextErrors.events = errorMessage(eventsResult.reason);

        setErrors(nextErrors);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const reloadUsers = async () => {
    const payload = await adminApi.users();
    setUsers(payload.users);
  };

  const reloadOverview = async () => {
    setOverview(await adminApi.overview());
  };

  return {
    overview,
    users,
    events,
    isLoading,
    errors,
    reloadUsers,
    reloadOverview,
  };
}
