import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { UserRole } from '@/lib/authApi';
import { useAuthStore } from '@/store/authStore';

const ROLE: Record<UserRole, number> = {
  viewer: 0,
  operator: 1,
  manager: 2,
  admin: 3,
};

export function RequireRole({ minRole, children }: { minRole: UserRole; children: ReactNode }) {
  const r = (useAuthStore((s) => s.session?.user.role) ?? 'viewer') as UserRole;
  if (ROLE[r] < ROLE[minRole]) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Accès refusé</Text>
        <Text style={styles.caption}>Votre rôle ne permet pas d’accéder à cette page (comme sur le bureau).</Text>
      </View>
    );
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#020617', padding: 16, justifyContent: 'center' },
  title: { color: '#f87171', fontSize: 18, fontWeight: '800' },
  caption: { color: '#94a3b8', marginTop: 8, fontSize: 14, lineHeight: 20 },
});
