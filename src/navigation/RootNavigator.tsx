import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useHydration } from '@/hooks/useHydration';
import { MainDrawer } from '@/navigation/MainDrawer';
import type { AuthStackParamList } from '@/navigation/types';
import { LoginScreen } from '@/screens/LoginScreen';
import { PairingScreen } from '@/screens/PairingScreen';
import { useAuthStore } from '@/store/authStore';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export type { AuthStackParamList } from '@/navigation/types';

export function RootNavigator() {
  const hydrated = useHydration();
  const session = useAuthStore((s) => s.session);

  if (!hydrated) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  return (
    <Stack.Navigator key={session ? 'in' : 'out'} screenOptions={{ headerShown: false }}>
      {session ? (
        <Stack.Screen name="Main" component={MainDrawer} />
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Pairing" component={PairingScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: '#020617', alignItems: 'center', justifyContent: 'center' },
});
