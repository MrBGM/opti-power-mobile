import { useEffect, useState } from 'react';

import { useAuthStore } from '@/store/authStore';

/**
 * Attend la réhydratation du persist Zustand (AsyncStorage).
 *
 * Filet de sécurité : si `getItem` rejette une erreur, le middleware persist
 * ne met parfois jamais `hasHydrated` à true → spinner infini. On force
 * l’affichage après un délai raisonnable.
 */
export function useHydration(): boolean {
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist.hasHydrated());

  useEffect(() => {
    const finish = () => setHydrated(true);

    const unsub = useAuthStore.persist.onFinishHydration(finish);
    if (useAuthStore.persist.hasHydrated()) finish();

    const timeout = setTimeout(() => {
      if (!useAuthStore.persist.hasHydrated()) {
        console.warn(
          '[useHydration] persist pas prêt après 3s — poursuite sans attendre (AsyncStorage ou erreur de rehydratation)'
        );
        finish();
      }
    }, 3000);

    return () => {
      unsub();
      clearTimeout(timeout);
    };
  }, []);

  return hydrated;
}
