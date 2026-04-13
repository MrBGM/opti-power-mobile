import { useQuery } from '@tanstack/react-query';

import { loadDesktopSyncBundle } from '@/storage/desktopSyncRepo';

export function useDesktopKpiBundle() {
  return useQuery({
    queryKey: ['local', 'desktop-kpi-bundle'],
    queryFn: () => loadDesktopSyncBundle(),
    staleTime: 4_000,
  });
}
