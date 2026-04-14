import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { EquipmentsStackParamList } from '@/navigation/types';
import { EquipmentDetailScreen } from '@/screens/EquipmentDetailScreen';
import { EquipmentsScreen } from '@/screens/EquipmentsScreen';
import { C } from '@/theme/colors';

const Stack = createNativeStackNavigator<EquipmentsStackParamList>();

export function EquipmentsStack() {
  return (
    <Stack.Navigator
      initialRouteName="EquipmentsList"
      screenOptions={{
        headerStyle: { backgroundColor: C.surface },
        headerTintColor: C.blue,
        headerTitleStyle: { fontWeight: '700', color: C.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: C.bg },
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
