import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { AlertProjection } from '@/domain/alert';
import { useAppLayout } from '@/hooks/useAppLayout';
import { useLocalAlerts } from '@/hooks/useLocalAlerts';
import { useLocalEquipments } from '@/hooks/useLocalEquipments';
import { formatRelativeFr } from '@/lib/formatRelativeFr';
import { updateAlertStatus } from '@/storage/alertsRepo';
import { C } from '@/theme/colors';

function severityConfig(s: AlertProjection['severity']) {
  if (s === 'critical') return { label: 'Critique',      color: C.red,   bg: C.redSoft,   icon: 'alert-circle'       as const };
  if (s === 'warning')  return { label: 'Avertissement', color: C.amber, bg: C.amberSoft, icon: 'warning'            as const };
  return                       { label: 'Info',          color: C.blue,  bg: C.blueSoft,  icon: 'information-circle' as const };
}

export function AlertsScreen() {
  const layout = useAppLayout();
  const queryClient = useQueryClient();
  const { data: alerts = [], isFetching, refetch, isLoading } = useLocalAlerts();
  const { data: equipments = [] } = useLocalEquipments();

  const [selectedEquipId, setSelectedEquipId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const onRefresh = useCallback(async () => { await refetch(); }, [refetch]);

  const setStatus = useCallback(
    async (id: string, status: AlertProjection['status']) => {
      await updateAlertStatus(id, status);
      await queryClient.invalidateQueries({ queryKey: ['local', 'alerts'] });
    },
    [queryClient]
  );

  // Filter by equipment when selected
  const allNonResolved = alerts.filter((a) => a.status !== 'resolved');
  const filtered = selectedEquipId
    ? allNonResolved.filter((a) => a.equipmentId === selectedEquipId)
    : allNonResolved;

  const activeAlerts = filtered.filter((a) => a.status === 'active');
  const acknowledgedAlerts = filtered.filter((a) => a.status === 'acknowledged');
  const allShown = [...activeAlerts, ...acknowledgedAlerts];

  const selectedEquip = equipments.find((e) => e.id === selectedEquipId);

  // Equipments that actually have alerts
  const equipsWithAlerts = equipments.filter((e) =>
    allNonResolved.some((a) => a.equipmentId === e.id)
  );

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

        {/* Titre */}
        <Text style={styles.cardTitle}>{item.title}</Text>

        {/* Equipement — toujours affiché si pas filtré */}
        {!selectedEquipId && item.equipmentName ? (
          <View style={styles.equipRow}>
            <Ionicons name="hardware-chip-outline" size={12} color={C.textMuted} />
            <Text style={styles.cardMeta}>{item.equipmentName}</Text>
          </View>
        ) : null}

        {/* Footer */}
        <View style={styles.cardFooter}>
          <View style={[styles.statusPill, item.status === 'acknowledged' && styles.statusPillAck]}>
            <Text style={[styles.statusPillTxt, item.status === 'acknowledged' && { color: C.amber }]}>
              {item.status === 'acknowledged' ? 'Acquittée' : 'Active'}
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
              <Text style={[styles.actionBtnTxt, { color: C.green }]}>Résoudre</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      {/* En-tête */}
      <View style={[styles.header, { paddingHorizontal: layout.padH }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { fontSize: layout.fontTitle }]}>Alertes</Text>
          <Text style={styles.caption}>
            {selectedEquip
              ? `Alertes de ${selectedEquip.name}`
              : 'Toutes les alertes actives et acquittées'}
          </Text>
        </View>
        {/* Compteurs */}
        <View style={styles.summaryPills}>
          {activeAlerts.length > 0 ? (
            <View style={[styles.pill, { backgroundColor: C.redSoft }]}>
              <Text style={[styles.pillTxt, { color: C.red }]}>
                {activeAlerts.length} active{activeAlerts.length > 1 ? 's' : ''}
              </Text>
            </View>
          ) : null}
          {acknowledgedAlerts.length > 0 ? (
            <View style={[styles.pill, { backgroundColor: C.amberSoft }]}>
              <Text style={[styles.pillTxt, { color: C.amber }]}>
                {acknowledgedAlerts.length} acquittée{acknowledgedAlerts.length > 1 ? 's' : ''}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Sélecteur d'équipement */}
      <View style={[styles.filterBar, { paddingHorizontal: layout.padH }]}>
        <Pressable
          onPress={() => setPickerOpen(true)}
          style={({ pressed }) => [styles.filterBtn, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="hardware-chip-outline" size={14} color={C.blue} />
          <Text style={styles.filterBtnText} numberOfLines={1}>
            {selectedEquip ? selectedEquip.name : 'Tous les équipements'}
          </Text>
          <Ionicons name="chevron-down" size={12} color={C.textMuted} />
        </Pressable>
        {selectedEquipId ? (
          <Pressable
            onPress={() => setSelectedEquipId(null)}
            style={styles.clearBtn}
          >
            <Ionicons name="close-circle" size={16} color={C.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={allShown}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingHorizontal: layout.padH }]}
        refreshControl={
          <RefreshControl refreshing={isFetching} onRefresh={onRefresh} tintColor={C.blue} />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="checkmark-circle-outline" size={52} color={C.green} />
            <Text style={styles.emptyTitle}>
              {selectedEquip ? `Aucune alerte pour ${selectedEquip.name}` : 'Aucune alerte active'}
            </Text>
            <Text style={styles.emptyBody}>
              {isLoading ? 'Chargement...' : selectedEquipId
                ? 'Cet équipement ne présente aucune alerte en cours.'
                : 'Tous les équipements sont en bonne santé.'}
            </Text>
          </View>
        }
        renderItem={renderItem}
      />

      {/* Modal sélection équipement */}
      <Modal visible={pickerOpen} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={[styles.pickerCard, { marginHorizontal: layout.padH }]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.pickerTitle}>Filtrer par équipement</Text>
            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              {/* Option "Tous" */}
              <Pressable
                onPress={() => { setSelectedEquipId(null); setPickerOpen(false); }}
                style={({ pressed }) => [
                  styles.pickerRow,
                  !selectedEquipId && styles.pickerRowSelected,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Ionicons name="list-outline" size={16} color={!selectedEquipId ? C.blue : C.textMuted} />
                <Text style={[styles.pickerRowText, !selectedEquipId && styles.pickerRowTextActive]}>
                  Tous les équipements
                </Text>
                {/* total alertes */}
                <View style={[styles.alertCountBadge, { backgroundColor: C.redSoft }]}>
                  <Text style={[styles.alertCountTxt, { color: C.red }]}>{allNonResolved.length}</Text>
                </View>
                {!selectedEquipId ? <Ionicons name="checkmark" size={16} color={C.blue} /> : null}
              </Pressable>

              {/* Equipements avec alertes en premier, puis tous les autres */}
              {equipments.length === 0 ? (
                <Text style={styles.pickerEmpty}>Aucun équipement synchronisé</Text>
              ) : (
                equipments.map((eq) => {
                  const count = allNonResolved.filter((a) => a.equipmentId === eq.id).length;
                  const isSelected = selectedEquipId === eq.id;
                  return (
                    <Pressable
                      key={eq.id}
                      onPress={() => { setSelectedEquipId(eq.id); setPickerOpen(false); }}
                      style={({ pressed }) => [
                        styles.pickerRow,
                        isSelected && styles.pickerRowSelected,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <View style={styles.pickerAvatar}>
                        <Text style={styles.pickerAvatarTxt}>{eq.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.pickerRowText, isSelected && styles.pickerRowTextActive]}>
                          {eq.name}
                        </Text>
                        {eq.site ? <Text style={styles.pickerRowSub}>{eq.site}</Text> : null}
                      </View>
                      {count > 0 ? (
                        <View style={[styles.alertCountBadge, { backgroundColor: C.redSoft }]}>
                          <Text style={[styles.alertCountTxt, { color: C.red }]}>{count}</Text>
                        </View>
                      ) : (
                        <Ionicons name="checkmark-circle-outline" size={14} color={C.green} />
                      )}
                      {isSelected ? <Ionicons name="checkmark" size={16} color={C.blue} /> : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
  },
  title: { color: C.text, fontWeight: '800' },
  caption: { color: C.textSub, fontSize: 13, lineHeight: 18, marginTop: 3 },
  summaryPills: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 4 },
  pill: { borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  pillTxt: { fontSize: 11, fontWeight: '700' },

  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
  },
  filterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...C.shadow,
  },
  filterBtnText: { flex: 1, color: C.blue, fontSize: 13, fontWeight: '700' },
  clearBtn: { padding: 4 },

  list: { gap: 10, paddingBottom: 24, paddingTop: 4 },

  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    borderLeftWidth: 4,
    padding: 14,
    gap: 8,
    ...C.shadow,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  time: { color: C.textMuted, fontSize: 12 },
  cardTitle: { color: C.text, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  equipRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardMeta: { color: C.textSub, fontSize: 12 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  statusPill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: C.redSoft },
  statusPillAck: { backgroundColor: C.amberSoft },
  statusPillTxt: { color: C.red, fontSize: 11, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  actionBtnTxt: { fontSize: 12, fontWeight: '700' },

  emptyWrap: { alignItems: 'center', marginTop: 60, gap: 12, paddingHorizontal: 24 },
  emptyTitle: { color: C.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyBody: { color: C.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'center', padding: 16 },
  pickerCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    ...C.shadowMd,
  },
  pickerTitle: {
    color: C.text,
    fontWeight: '800',
    fontSize: 16,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSub,
  },
  pickerRowSelected: { backgroundColor: C.blueSoft },
  pickerRowText: { fontSize: 14, color: C.text, flex: 1 },
  pickerRowTextActive: { fontWeight: '700', color: C.blue },
  pickerRowSub: { fontSize: 11, color: C.textMuted, marginTop: 1 },
  pickerEmpty: { color: C.textMuted, textAlign: 'center', padding: 24, fontSize: 13 },
  pickerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: C.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerAvatarTxt: { color: C.blue, fontSize: 12, fontWeight: '800' },
  alertCountBadge: { borderRadius: 99, paddingHorizontal: 7, paddingVertical: 2 },
  alertCountTxt: { fontSize: 11, fontWeight: '800' },
});
