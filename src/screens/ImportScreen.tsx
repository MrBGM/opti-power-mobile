import { StyleSheet, Text, View } from 'react-native';

export function ImportScreen() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Importer données</Text>
      <Text style={styles.caption}>Aligné sur la page Import du bureau (Excel / CA8336…).</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#020617', padding: 16 },
  title: { color: '#f8fafc', fontSize: 20, fontWeight: '800' },
  caption: { color: '#94a3b8', marginTop: 8, fontSize: 14, lineHeight: 20 },
});
