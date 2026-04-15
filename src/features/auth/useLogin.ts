import { useMutation } from '@tanstack/react-query';

import { loginCloud } from '@/lib/authApi';
import { useAuthStore } from '@/store/authStore';
import { usePairingStore } from '@/store/pairingStore';

export function useLogin() {
  const setSession  = useAuthStore((s) => s.setSession);
  const pairedState = usePairingStore.getState;

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      loginCloud(email, password),
    onSuccess: (result) => {
      if (result.success && result.user && result.cloudToken) {
        setSession({
          user: result.user,
          cloudToken: result.cloudToken,
          refreshToken: result.refreshToken,
          mode: 'cloud',
          mustChangePassword: false,
        });

        // Déclarer la connexion mobile au sync-service (best-effort)
        // Permet au desktop de loger cette connexion dans auth_audit_log.
        const paired = pairedState().paired;
        if (paired?.status === 'linked' && paired.deviceToken && paired.cloudApiBase) {
          const syncUrl = paired.cloudApiBase.replace(/\/$/, '');
          fetch(`${syncUrl}/v1/audit/mobile-login`, {
            method: 'POST',
            headers: {
              'Content-Type':  'application/json',
              'Authorization': `Bearer ${paired.deviceToken}`,
            },
            body: JSON.stringify({
              email:    result.user.email,
              fullName: result.user.fullName,
              role:     result.user.role,
              platform: 'mobile',
            }),
          }).catch(() => { /* non bloquant — best-effort */ });
        }
      }
    },
  });
}
