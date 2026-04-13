import { StyleSheet, Text, View } from 'react-native';

export function AIInsightsScreen() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>IA / Prédictions</Text>
      <Text style={styles.caption}>Aligné sur `AIInsightsPage` du bureau.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#020617', padding: 16 },
  title: { color: '#f8fafc', fontSize: 20, fontWeight: '800' },
  caption: { color: '#94a3b8', marginTop: 8, fontSize: 14, lineHeight: 20 },
});
