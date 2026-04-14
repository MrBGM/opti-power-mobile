import { Ionicons } from '@expo/vector-icons';
import { DrawerContentScrollView, type DrawerContentComponentProps } from '@react-navigation/drawer';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppBrandLogo } from '@/components/branding/AppBrandLogo';
import type { DrawerParamList } from '@/navigation/types';
import type { UserRole } from '@/lib/authApi';
import { useAuthStore } from '@/store/authStore';
import { C } from '@/theme/colors';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  viewer: 0,
  operator: 1,
  manager: 2,
  admin: 3,
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrateur',
  manager: 'Superviseur',
  operator: 'Technicien',
  viewer: 'Lecteur',
};

type Item = {
  name: keyof DrawerParamList;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  minRole?: UserRole;
};

const ITEMS: Item[] = [
  { name: 'Dashboard',  label: 'Tableau de bord', icon: 'home-outline' },
  { name: 'Equipments', label: 'Équipements',      icon: 'flash-outline' },
  { name: 'Analytics',  label: 'Analyses',          icon: 'bar-chart-outline' },
  { name: 'Alerts',     label: 'Alertes',            icon: 'warning-outline' },
  { name: 'Reports',    label: 'Rapports',           icon: 'document-text-outline' },
  { name: 'Profile',    label: 'Mon profil',         icon: 'person-circle-outline' },
];

export function AppDrawerContent(props: DrawerContentComponentProps) {
  const session = useAuthStore((s) => s.session);
  const clearSession = useAuthStore((s) => s.clearSession);
  const role = (session?.user.role ?? 'viewer') as UserRole;
  const isAdmin = role === 'admin';

  const activeRoute = props.state.routes[props.state.index]?.name;

  const visible = ITEMS.filter((it) => {
    if (!it.minRole) return true;
    return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[it.minRole];
  });

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={styles.scroll}
      style={{ backgroundColor: C.surface }}
    >
      {/* Logo */}
      <View style={styles.header}>
        <View style={styles.logoBox}>
          <AppBrandLogo size={36} overscan={1.14} />
        </View>
        <Text style={styles.headerTitle}>Opti Power</Text>
      </View>

      {/* Navigation principale */}
      <View style={styles.nav}>
        {visible.map((it) => {
          const active = activeRoute === it.name;
          return (
            <Pressable
              key={it.name}
              onPress={() => props.navigation.navigate(it.name)}
              style={({ pressed }) => [
                styles.row,
                active && styles.rowActive,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Ionicons
                name={it.icon}
                size={20}
                color={active ? C.blue : C.textMuted}
              />
              <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>
                {it.label}
              </Text>
              {active && <View style={styles.activeDot} />}
            </Pressable>
          );
        })}
      </View>

      {/* Pied de page */}
      <View style={styles.footer}>
        {isAdmin ? (
          <Pressable
            onPress={() => props.navigation.navigate('Admin')}
            style={({ pressed }) => [
              styles.row,
              styles.adminRow,
              activeRoute === 'Admin' && styles.rowActive,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color={C.red} />
            <Text style={[styles.rowLabel, { color: C.red }]}>Administration</Text>
            <View style={styles.adminBadge}>
              <Text style={styles.adminBadgeTxt}>ADMIN</Text>
            </View>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => props.navigation.navigate('Settings')}
          style={({ pressed }) => [
            styles.row,
            activeRoute === 'Settings' && styles.rowActive,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons
            name="settings-outline"
            size={20}
            color={activeRoute === 'Settings' ? C.blue : C.textMuted}
          />
          <Text style={[styles.rowLabel, activeRoute === 'Settings' && styles.rowLabelActive]}>
            Paramètres
          </Text>
        </Pressable>

        <Pressable
          onPress={() => clearSession()}
          style={({ pressed }) => [styles.row, styles.logoutRow, pressed && { opacity: 0.9 }]}
        >
          <Ionicons name="log-out-outline" size={20} color={C.red} />
          <Text style={styles.logoutText}>Déconnexion</Text>
        </Pressable>
      </View>

      {/* Carte utilisateur */}
      {session ? (
        <View style={styles.userCard}>
          <View style={[styles.avatar, isAdmin ? { backgroundColor: C.red } : { backgroundColor: C.blue }]}>
            <Text style={styles.avatarText}>
              {session.user.fullName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.userName} numberOfLines={1}>
              {session.user.fullName}
            </Text>
            <Text style={styles.userRole} numberOfLines={1}>
              {ROLE_LABELS[role] ?? role}
            </Text>
          </View>
        </View>
      ) : null}
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingBottom: 16 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  logoBox: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  headerTitle: { color: C.text, fontSize: 16, fontWeight: '800' },

  nav: { paddingTop: 8, paddingHorizontal: 8, gap: 2, flex: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  rowActive: { backgroundColor: C.blueSoft },
  rowLabel: { color: C.textSub, fontSize: 14, fontWeight: '600', flex: 1 },
  rowLabelActive: { color: C.blue, fontWeight: '700' },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.blue,
  },

  footer: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 2,
  },
  adminRow: {
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: C.redSoft,
  },
  adminBadge: {
    backgroundColor: C.red,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  adminBadgeTxt: { color: '#fff', fontSize: 9, fontWeight: '800' },
  logoutRow: {},
  logoutText: { color: C.red, fontWeight: '700', fontSize: 14, flex: 1 },

  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 12,
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: C.surface2,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  userName: { color: C.text, fontWeight: '700', fontSize: 14 },
  userRole: { color: C.textMuted, fontSize: 11, marginTop: 2 },
});
