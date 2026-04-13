import { StyleSheet, Text, View } from 'react-native';

export function AdminScreen() {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Administration</Text>
      <Text style={styles.caption}>Rôle admin uniquement — aligné sur `AdminPage` desktop.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#020617', padding: 16 },
  title: { color: '#f8fafc', fontSize: 20, fontWeight: '800' },
  caption: { color: '#94a3b8', marginTop: 8, fontSize: 14, lineHeight: 20 },
});
