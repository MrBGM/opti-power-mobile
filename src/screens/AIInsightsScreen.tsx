import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { C } from '@/theme/colors';

export function AIInsightsScreen() {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconBox}>
        <Ionicons name="bulb-outline" size={40} color={C.purple} />
      </View>
      <Text style={styles.title}>IA / Prédictions</Text>
      <Text style={styles.caption}>Aligné sur AIInsightsPage du bureau — disponible dans une prochaine version.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 12 },
  iconBox: { width: 72, height: 72, borderRadius: 20, backgroundColor: C.purpleSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { color: C.text, fontSize: 20, fontWeight: '800' },
  caption: { color: C.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
