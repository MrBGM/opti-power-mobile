import { createDrawerNavigator } from '@react-navigation/drawer';

import { RequireRole } from '@/components/RequireRole';
import { useDesktopEquipmentsLiveSync } from '@/hooks/useDesktopEquipmentsLiveSync';
import { usePairingRecovery } from '@/hooks/usePairingRecovery';
import { AppDrawerContent } from '@/navigation/AppDrawerContent';
import type { DrawerParamList } from '@/navigation/types';
import { AdminScreen } from '@/screens/AdminScreen';
import { AlertsScreen } from '@/screens/AlertsScreen';
import { AnalyticsScreen } from '@/screens/AnalyticsScreen';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { EquipmentsStack } from '@/navigation/EquipmentsStack';
import { PairingScreen } from '@/screens/PairingScreen';
import { ReportsScreen } from '@/screens/ReportsScreen';
import { RealtimeScreen } from '@/screens/RealtimeScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';

const Drawer = createDrawerNavigator<DrawerParamList>();

function AnalyticsGate() {
  return <AnalyticsScreen />;
}

function AdminGate() {
  return (
    <RequireRole minRole="admin">
      <AdminScreen />
    </RequireRole>
  );
}

function DesktopSyncHost() {
  useDesktopEquipmentsLiveSync();
  usePairingRecovery(); // récupère le deviceToken si l'app était fermée pendant le polling
  return null;
}

export function MainDrawer() {
  return (
    <>
      <DesktopSyncHost />
      <Drawer.Navigator
      drawerContent={(p) => <AppDrawerContent {...p} />}
      initialRouteName="Dashboard"
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#0f172a',
        headerTitleStyle: { fontWeight: '700', color: '#0f172a' },
        headerShadowVisible: false,
        drawerStyle: { backgroundColor: '#ffffff', width: 288 },
        sceneStyle: { backgroundColor: '#f8fafc' },
      }}
    >
      <Drawer.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Tableau de bord' }} />
      <Drawer.Screen name="Equipments" component={EquipmentsStack} options={{ title: 'Équipements' }} />
      <Drawer.Screen name="Analytics" component={AnalyticsGate} options={{ title: 'Analyses' }} />
      <Drawer.Screen name="Alerts" component={AlertsScreen} options={{ title: 'Alertes' }} />
      <Drawer.Screen name="Reports"   component={ReportsScreen}  options={{ title: 'Rapports' }} />
      <Drawer.Screen name="Realtime"  component={RealtimeScreen} options={{ title: 'Temps réel' }} />
      <Drawer.Screen name="Profile" component={ProfileScreen} options={{ title: 'Mon profil' }} />
      <Drawer.Screen name="Admin" component={AdminGate} options={{ title: 'Administration' }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} options={{ title: 'Paramètres' }} />
      <Drawer.Screen
        name="Pairing"
        component={PairingScreen}
        options={{ title: 'Appairage', drawerItemStyle: { display: 'none' } }}
      />
    </Drawer.Navigator>
    </>
  );
}
