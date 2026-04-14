import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

type Props = {
  isWide: boolean;
  gap: number;
  children: ReactNode;
};

/** Deux colonnes sur grand écran (tablette / paysage), une colonne sur téléphone. */
export function AnalyticsSplitRow({ isWide, gap, children }: Props) {
  const list = React.Children.toArray(children).filter(Boolean) as ReactNode[];
  if (list.length === 0) return null;
  if (isWide && list.length >= 2) {
    return (
      <View style={[styles.row, { gap }]}>
        {list.map((child, i) => (
          <View key={i} style={styles.col}>
            {child}
          </View>
        ))}
      </View>
    );
  }
  return <View style={{ gap: gap }}>{list}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch' },
  col: { flex: 1, minWidth: 0 },
});
