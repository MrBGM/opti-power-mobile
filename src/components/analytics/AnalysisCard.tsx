import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { C } from '@/theme/colors';

type Props = {
  title: string;
  subtitle?: string;
  hint?: string;
  right?: ReactNode;
  children: ReactNode;
};

export function AnalysisCard({ title, subtitle, hint, right, children }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <View style={styles.titleBlock}>
          <View style={styles.titleLine}>
            <Text style={styles.title}>{title}</Text>
            {hint ? (
              <Pressable
                hitSlop={10}
                onPress={() => Alert.alert(title, hint)}
                accessibilityLabel={`Aide : ${title}`}
              >
                <Ionicons name="information-circle-outline" size={16} color={C.textMuted} />
              </Pressable>
            ) : null}
          </View>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: C.surface,
    overflow: 'hidden',
    ...C.shadowCard,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 10,
    backgroundColor: '#fafbfc',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  titleBlock: { flex: 1, minWidth: 0 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: C.text, fontSize: 16, fontWeight: '800', flexShrink: 1, letterSpacing: -0.2 },
  subtitle: { color: C.textMuted, fontSize: 12, marginTop: 4, lineHeight: 17 },
  right: { flexShrink: 0 },
  body: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 16 },
});
