import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '@/theme/colors';

export function AdminScreen() {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconBox}>
        <Ionicons name="shield-checkmark-outline" size={40} color={C.red} />
      </View>
      <Text style={styles.title}>Administration</Text>
      <Text style={styles.caption}>Rôle admin uniquement — aligné sur AdminPage desktop.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 12 },
  iconBox: { width: 72, height: 72, borderRadius: 20, backgroundColor: C.redSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { color: C.text, fontSize: 20, fontWeight: '800' },
  caption: { color: C.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
