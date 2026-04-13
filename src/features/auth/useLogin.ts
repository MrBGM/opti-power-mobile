import { useMutation } from '@tanstack/react-query';

import { loginCloud } from '@/lib/authApi';
import { useAuthStore } from '@/store/authStore';

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);

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
      }
    },
  });
}
