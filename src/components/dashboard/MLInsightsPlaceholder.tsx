import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';

import type { DrawerParamList } from '@/navigation/types';

type Nav = DrawerNavigationProp<DrawerParamList>;

/** Placeholder RN du widget ML bureau — navigation vers l’écran IA (Phase roadmap blueprint). */
export function MLInsightsPlaceholder() {
  const navigation = useNavigation<Nav>();

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.iconWrap}>
          <Ionicons name="bulb-outline" size={22} color="#a78bfa" />
        </View>
        <Text style={styles.title}>IA / Prédictions</Text>
      </View>
      <Text style={styles.body}>
        Analyse prédictive et recommandations : données issues des projections locales et de la sync E2E
        (blueprint §12–14). Graphes avancés possibles en WebView ou natif selon Phase C.
      </Text>
      <Pressable
        onPress={() => navigation.navigate('AIInsights')}
        style={({ pressed }) => [styles.link, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.linkText}>Ouvrir l’écran IA</Text>
        <Ionicons name="chevron-forward" size={18} color="#818cf8" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.25)',
    padding: 14,
    minWidth: 280,
    gap: 10,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(129,140,248,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#e2e8f0', fontSize: 17, fontWeight: '700', flex: 1 },
  body: { color: '#94a3b8', fontSize: 13, lineHeight: 19 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  linkText: { color: '#818cf8', fontSize: 14, fontWeight: '600' },
});
