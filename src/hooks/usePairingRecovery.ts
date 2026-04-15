/**
 * usePairingRecovery — récupération silencieuse du deviceToken.
 *
 * Scénario : l'utilisateur avait scanné le QR (status='pending'), mais l'app
 * a été fermée AVANT la fin du polling (avant que le desktop approuve et que le
 * mobile reçoive le deviceToken). Au redémarrage, le store a status='pending'
 * sans deviceToken → l'app semble "non liée".
 *
 * Ce hook, appelé une seule fois au montage de MainDrawer, essaie silencieusement
 * de récupérer le token si la session a été approuvée entre-temps.
 * Principe WhatsApp : pas de re-scan si la session est toujours valide.
 */

import { useEffect } from 'react';

import { fetchApprovedPairingSession } from '@/lib/pairingPoll';
import { usePairingStore } from '@/store/pairingStore';

export function usePairingRecovery() {
  const paired                = usePairingStore((s) => s.paired);
  const setLinkedWithDeviceToken = usePairingStore((s) => s.setLinkedWithDeviceToken);
  const clearPairing          = usePairingStore((s) => s.clearPairing);

  useEffect(() => {
    // Rien à récupérer si déjà lié ou pas d'appairage en cours
    if (!paired || paired.status !== 'pending') return;
    // Il faut au minimum un pairingSessionId et une URL pour interroger le sync-service
    if (!paired.pairingSessionId || !paired.cloudApiBase) return;

    const sessionId = paired.pairingSessionId;
    const apiBase   = paired.cloudApiBase;

    void (async () => {
      try {
        const { deviceToken } = await fetchApprovedPairingSession(apiBase, sessionId);
        // La session a été approuvée pendant que le mobile était fermé → on est lié !
        setLinkedWithDeviceToken(deviceToken);
      } catch {
        // Session expirée, non trouvée, ou pas encore approuvée — on ne force pas
        // la déconnexion : l'utilisateur peut toujours re-scanner depuis Paramètres.
        // On efface le "pending" seulement si la session est définitivement expirée
        // (le serveur retourne un message d'expiration explicite).
        // Pour éviter les faux positifs réseau, on laisse le store tel quel.
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Une seule fois au montage
}
