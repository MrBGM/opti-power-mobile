import { useQuery } from '@tanstack/react-query';

import { listAlerts } from '@/storage/alertsRepo';

/** Alertes non résolues (projection locale, blueprint §6.3). */
export function useLocalAlerts() {
  return useQuery({
    queryKey: ['local', 'alerts', 'active'],
    queryFn: () => listAlerts({ excludeStatus: ['resolved'] }),
    staleTime: 15_000,
  });
}
