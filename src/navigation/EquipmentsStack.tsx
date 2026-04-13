import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { EquipmentsStackParamList } from '@/navigation/types';
import { EquipmentDetailScreen } from '@/screens/EquipmentDetailScreen';
import { EquipmentsScreen } from '@/screens/EquipmentsScreen';

const Stack = createNativeStackNavigator<EquipmentsStackParamList>();

export function EquipmentsStack() {
  return (
    <Stack.Navigator
      initialRouteName="EquipmentsList"
      screenOptions={{
        headerStyle: { backgroundColor: '#0f172a' },
        headerTintColor: '#f8fafc',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: '#020617' },
      }}
    >
      <Stack.Screen name="EquipmentsList" component={EquipmentsScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="EquipmentDetail"
        component={EquipmentDetailScreen}
        options={{ title: 'Équipement', headerBackTitle: 'Liste' }}
      />
    </Stack.Navigator>
  );
}
