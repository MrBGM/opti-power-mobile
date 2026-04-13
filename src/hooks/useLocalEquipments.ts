import { useQuery } from '@tanstack/react-query';

import { listEquipments } from '@/storage/equipmentsRepo';

export function useLocalEquipments() {
  return useQuery({
    queryKey: ['local', 'equipments'],
    queryFn: () => listEquipments(),
    staleTime: 30_000,
  });
}
