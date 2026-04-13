import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { AlertProjection } from '@/domain/alert';
import { useLocalAlerts } from '@/hooks/useLocalAlerts';
import { formatRelativeFr } from '@/lib/formatRelativeFr';
import { updateAlertStatus } from '@/storage/alertsRepo';
import { C } from '@/theme/colors';

function severityConfig(s: AlertProjection['severity']) {
  if (s === 'critical') return { label: 'Critique',      color: C.red,   bg: C.redSoft,   icon: 'alert-circle'     as const };
  if (s === 'warning')  return { label: 'Avertissement', color: C.amber, bg: C.amberSoft, icon: 'warning'          as const };
  return                       { label: 'Info',          color: C.blue,  bg: C.blueSoft,  icon: 'information-circle' as const };
}

export function AlertsScreen() {
  const queryClient = useQueryClient();
  const { data: alerts = [], isFetching, refetch, isLoading } = useLocalAlerts();

  const onRefresh = useCallback(async () => { await refetch(); }, [refetch]);

  const setStatus = useCallback(
    async (id: string, status: AlertProjection['status']) => {
      await updateAlertStatus(id, status);
      await queryClient.invalidateQueries({ queryKey: ['local', 'alerts'] });
    },
    [queryClient]
  );

  const activeAlerts = alerts.filter((a) => a.status === 'active');
  const acknowledgedAlerts = alerts.filter((a) => a.status === 'acknowledged');
  const allShown = [...activeAlerts, ...acknowledgedAlerts];

  const renderItem = ({ item }: { item: AlertProjection }) => {
    const cfg = severityConfig(item.severity);
    return (
      <View style={[styles.card, { borderLeftColor: cfg.color }]}>
        {/* Badge + heure */}
        <View style={styles.cardTop}>
          <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon} size={12} color={cfg.color} />
            <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <Text style={styles.time}>{formatRelativeFr(item.triggeredAt)}</Text>
        </View>

        {/* Titre + equipement */}
        <Text style={styles.cardTitle}>{item.title}</Text>
        {item.equipmentName ? (
          <View style={styles.equipRow}>
            <Ionicons name="hardware-chip-outline" size={12} color={C.textMuted} />
            <Text style={styles.cardMeta}>{item.equipmentName}</Text>
          </View>
        ) : null}

        {/* Footer : statut + actions */}
        <View style={styles.cardFooter}>
          <View style={[styles.statusPill, item.status === 'acknowledged' && styles.statusPillAck]}>
            <Text style={[styles.statusPillTxt, item.status === 'acknowledged' && { color: C.amber }]}>
              {item.status === 'acknowledged' ? 'Acquittee' : 'Active'}
            </Text>
          </View>
          <View style={styles.actions}>
            {item.status === 'active' ? (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: C.amberSoft, borderColor: C.amber }]}
                onPress={() => void setStatus(item.id, 'acknowledged')}
              >
                <Text style={[styles.actionBtnTxt, { color: C.amber }]}>Acquitter</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: C.greenSoft, borderColor: C.green }]}
              onPress={() => void setStatus(item.id, 'resolved')}
            >
              <Text style={[styles.actionBtnTxt, { color: C.green }]}>Resoudre</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      {/* En-tete */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Alertes</Text>
          <Text style={styles.caption}>Alertes actives et acquittees. Les resolues sont archivees.</Text>
        </View>
        {allShown.length > 0 ? (
          <View style={styles.summaryPills}>
            {activeAlerts.length > 0 ? (
              <View style={[styles.pill, { backgroundColor: C.redSoft }]}>
                <Text style={[styles.pillTxt, { color: C.red }]}>{activeAlerts.length} active{activeAlerts.length > 1 ? 's' : ''}</Text>
              </View>
            ) : null}
            {acknowledgedAlerts.length > 0 ? (
              <View style={[styles.pill, { backgroundColor: C.amberSoft }]}>
                <Text style={[styles.pillTxt, { color: C.amber }]}>{acknowledgedAlerts.length} acquittee{acknowledgedAlerts.length > 1 ? 's' : ''}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      <FlatList
        data={allShown}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={onRefresh} tintColor={C.blue} />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="checkmark-circle-outline" size={48} color={C.green} />
            <Text style={styles.emptyTitle}>Aucune alerte active</Text>
            <Text style={styles.emptyBody}>
              {isLoading ? 'Chargement...' : 'Ajoutez des donnees demo depuis Equipements.'}
            </Text>
          </View>
        }
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 12 },
  title: { color: C.text, fontSize: 20, fontWeight: '800' },
  caption: { color: C.textSub, fontSize: 13, lineHeight: 18, marginTop: 3 },
  summaryPills: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  pill: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  pillTxt: { fontSize: 11, fontWeight: '700' },
  list: { gap: 10, paddingHorizontal: 16, paddingBottom: 24 },

  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 4,
    padding: 14,
    gap: 7,
    ...C.shadow,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  time: { color: C.textMuted, fontSize: 12 },
  cardTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
  equipRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardMeta: { color: C.textSub, fontSize: 12 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  statusPill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: C.redSoft },
  statusPillAck: { backgroundColor: C.amberSoft },
  statusPillTxt: { color: C.red, fontSize: 11, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  actionBtnTxt: { fontSize: 12, fontWeight: '700' },

  emptyWrap: { alignItems: 'center', marginTop: 60, gap: 10, paddingHorizontal: 24 },
  emptyTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  emptyBody: { color: C.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
