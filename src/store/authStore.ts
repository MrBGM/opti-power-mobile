import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AuthUser, LoginMode, UserRole } from '@/lib/authApi';

export interface AuthSession {
  user: AuthUser;
  cloudToken?: string;
  refreshToken?: string;
  mode: LoginMode;
  mustChangePassword: boolean;
}

interface AuthState {
  session: AuthSession | null;
  setSession: (s: AuthSession) => void;
  refreshSession: (cloudToken: string, refreshToken?: string) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      refreshSession: (cloudToken, refreshToken) =>
        set((state) =>
          state.session
            ? {
                session: {
                  ...state.session,
                  cloudToken,
                  ...(refreshToken != null ? { refreshToken } : {}),
                },
              }
            : {}
        ),
      clearSession: () => set({ session: null }),
    }),
    {
      name: 'opti-power-mobile-auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ session: state.session }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn('[authStore] rehydratation AsyncStorage échouée', error);
        }
      },
    }
  )
);

export function selectIsAuthenticated(s: AuthState): boolean {
  return s.session !== null;
}

export function selectUserRole(s: AuthState): UserRole | null {
  return s.session?.user.role ?? null;
}
