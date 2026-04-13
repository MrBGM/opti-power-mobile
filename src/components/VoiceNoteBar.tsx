/**
 * Barre d'enregistrement vocal flottante (theme clair).
 * - Affichée en bas de l'écran Rapports
 * - Tap micro → enregistrement audio
 * - Après arrêt : modal transcription + structuration + images
 * - Sauvegarde en SQLite (table voice_reports)
 */
import { useEffect, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { fmtDuration, structuredReportIsEmpty, structureTranscription } from '@/lib/reportStructurer';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { saveVoiceReport } from '@/storage/voiceReportsRepo';
import type { StructuredReport } from '@/storage/voiceReportsRepo';
import { C } from '@/theme/colors';

interface Equipment {
  id: string;
  name: string;
  site?: string | null;
}

interface Props {
  equipments: Equipment[];
  onSaved?: () => void;
}

function genId(): string {
  return `vr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function RecordingDot() {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.2, duration: 600, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return <Animated.View style={[styles.recDot, { opacity: anim }]} />;
}

function StructuredSection({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.structSection}>
      <Text style={[styles.structLabel, { color }]}>{title}</Text>
      {items.map((item, i) => (
        <View key={i} style={styles.structItem}>
          <Text style={[styles.structBullet, { color }]}>•</Text>
          <Text style={styles.structItemText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

export function VoiceNoteBar({ equipments, onSaved }: Props) {
  const recorder = useVoiceRecorder();

  const [modalVisible, setModalVisible] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [structured, setStructured] = useState<StructuredReport | null>(null);
  const [selectedEquip, setSelectedEquip] = useState<Equipment | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [showEquipList, setShowEquipList] = useState(false);
  const [imageUris, setImageUris] = useState<string[]>([]);
  const durationRef = useRef(0);

  async function handleMicPress() {
    if (recorder.state === 'recording') {
      const uri = await recorder.stopRecording();
      durationRef.current = recorder.durationMs;
      setTranscription('');
      setStructured(null);
      setSavedOk(false);
      setImageUris([]);
      if (uri) setModalVisible(true);
    } else if (recorder.state === 'idle' || recorder.state === 'stopped') {
      await recorder.startRecording();
    }
  }

  async function pickFromGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setImageUris((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
    }
  }

  async function pickFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) {
      setImageUris((prev) => [...prev, result.assets[0].uri]);
    }
  }

  function removeImage(uri: string) {
    setImageUris((prev) => prev.filter((u) => u !== uri));
  }

  function handleStructure() {
    if (!transcription.trim()) return;
    setStructured(structureTranscription(transcription));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const struct = structured ?? structureTranscription(transcription);
      await saveVoiceReport({
        id: genId(),
        equipmentId: selectedEquip?.id ?? null,
        equipmentName: selectedEquip?.name ?? null,
        audioUri: recorder.audioUri,
        transcription,
        structuredJson: struct,
        durationMs: recorder.durationMs || durationRef.current,
        imageUris,
        status: 'saved',
        createdAt: now,
        updatedAt: now,
      });
      setSavedOk(true);
      setTimeout(() => {
        setModalVisible(false);
        recorder.resetRecorder();
        setTranscription('');
        setStructured(null);
        setSelectedEquip(null);
        setImageUris([]);
        setSavedOk(false);
        onSaved?.();
      }, 1200);
    } catch { /* silencieux */ } finally {
      setSaving(false);
    }
  }

  function handleCloseModal() {
    setModalVisible(false);
    recorder.resetRecorder();
    setTranscription('');
    setStructured(null);
    setSelectedEquip(null);
    setImageUris([]);
    setSavedOk(false);
  }

  const isRecording = recorder.state === 'recording';
  const isPlaying = recorder.state === 'playing';

  return (
    <>
      {/* ── Barre fixe en bas ───────────────────────────────────── */}
      <View style={styles.bar}>
        <View style={styles.barInner}>
          <View style={styles.barLeft}>
            {isRecording ? (
              <>
                <RecordingDot />
                <Text style={styles.barTimerText}>{fmtDuration(recorder.durationMs)}</Text>
                <Text style={styles.barHint}>Enregistrement en cours...</Text>
              </>
            ) : (
              <Text style={styles.barHint}>
                {recorder.state === 'stopped'
                  ? 'Enregistrement prêt'
                  : 'Appuie pour enregistrer une note vocale'}
              </Text>
            )}
          </View>

          {recorder.state === 'stopped' && recorder.audioUri ? (
            <Pressable
              onPress={() => setModalVisible(true)}
              style={({ pressed }) => [styles.openBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.openBtnText}>Ouvrir</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={handleMicPress}
            style={({ pressed }) => [
              styles.micBtn,
              isRecording && styles.micBtnRecording,
              pressed && { opacity: 0.8 },
            ]}
          >
            {isRecording ? (
              <Ionicons name="stop" size={18} color={C.red} />
            ) : (
              <Ionicons name="mic" size={20} color={C.blue} />
            )}
          </Pressable>
        </View>

        {recorder.error ? (
          <Text style={styles.barError}>{recorder.error}</Text>
        ) : null}
      </View>

      {/* ── Modal ───────────────────────────────────────────────── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseModal}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* En-tête */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Note vocale</Text>
              <Pressable onPress={handleCloseModal} style={styles.closeBtn}>
                <Ionicons name="close" size={18} color={C.textMuted} />
              </Pressable>
            </View>

            {/* Durée + lecture */}
            <View style={styles.audioRow}>
              <View style={styles.audioPill}>
                <Ionicons name="mic" size={14} color={C.cyan} />
                <Text style={styles.audioPillText}>
                  {fmtDuration(recorder.durationMs || durationRef.current)}
                </Text>
              </View>
              <Pressable
                onPress={isPlaying ? recorder.stopPlayback : recorder.playRecording}
                style={({ pressed }) => [styles.playBtn, pressed && { opacity: 0.8 }]}
                disabled={!recorder.audioUri}
              >
                <Ionicons name={isPlaying ? 'stop-circle' : 'play-circle'} size={16} color="#fff" />
                <Text style={styles.playBtnText}>{isPlaying ? 'Stop' : 'Écouter'}</Text>
              </Pressable>
            </View>

            {/* Sélection équipement */}
            <Text style={styles.fieldLabel}>Équipement concerné (optionnel)</Text>
            <Pressable
              onPress={() => setShowEquipList((v) => !v)}
              style={styles.equipSelector}
            >
              <Text style={styles.equipSelectorText}>
                {selectedEquip ? selectedEquip.name : 'Sélectionner un équipement...'}
              </Text>
              <Ionicons name={showEquipList ? 'chevron-up' : 'chevron-down'} size={14} color={C.textMuted} />
            </Pressable>

            {showEquipList && (
              <View style={styles.equipList}>
                <Pressable
                  onPress={() => { setSelectedEquip(null); setShowEquipList(false); }}
                  style={styles.equipItem}
                >
                  <Text style={styles.equipItemText}>-- Aucun --</Text>
                </Pressable>
                {equipments.map((eq) => (
                  <Pressable
                    key={eq.id}
                    onPress={() => { setSelectedEquip(eq); setShowEquipList(false); }}
                    style={[styles.equipItem, selectedEquip?.id === eq.id && styles.equipItemSelected]}
                  >
                    <Text style={styles.equipItemText}>{eq.name}</Text>
                    {eq.site ? <Text style={styles.equipItemSite}>{eq.site}</Text> : null}
                    {selectedEquip?.id === eq.id ? (
                      <Ionicons name="checkmark" size={14} color={C.blue} />
                    ) : null}
                  </Pressable>
                ))}
              </View>
            )}

            {/* Transcription */}
            <Text style={styles.fieldLabel}>Transcription / observations</Text>
            <TextInput
              value={transcription}
              onChangeText={(v) => { setTranscription(v); setStructured(null); }}
              placeholder="Tape ou colle ici la transcription de ta note vocale..."
              placeholderTextColor={C.textMuted}
              multiline
              textAlignVertical="top"
              style={styles.transcriptionInput}
            />

            {/* Bouton structurer */}
            <Pressable
              onPress={handleStructure}
              disabled={!transcription.trim()}
              style={({ pressed }) => [
                styles.structureBtn,
                !transcription.trim() && styles.structureBtnDisabled,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Ionicons name="sparkles" size={14} color={C.purple} />
              <Text style={styles.structureBtnText}>Structurer le rapport</Text>
            </Pressable>

            {/* Rapport structuré */}
            {structured && !structuredReportIsEmpty(structured) && (
              <View style={styles.structuredBlock}>
                <Text style={styles.structuredTitle}>Rapport structuré</Text>
                <StructuredSection title="Observations" items={structured.observations} color={C.cyan} />
                <StructuredSection title="Anomalies détectées" items={structured.anomalies} color={C.red} />
                <StructuredSection title="Données énergétiques" items={structured.consumption} color={C.green} />
                <StructuredSection title="Actions recommandées" items={structured.actions} color={C.amber} />
              </View>
            )}

            {/* Photos */}
            <Text style={styles.fieldLabel}>Photos jointes</Text>
            <View style={styles.imageActions}>
              <Pressable
                onPress={pickFromGallery}
                style={({ pressed }) => [styles.imageActionBtn, pressed && { opacity: 0.8 }]}
              >
                <Ionicons name="images-outline" size={16} color={C.blue} />
                <Text style={styles.imageActionTxt}>Galerie</Text>
              </Pressable>
              <Pressable
                onPress={pickFromCamera}
                style={({ pressed }) => [styles.imageActionBtn, pressed && { opacity: 0.8 }]}
              >
                <Ionicons name="camera-outline" size={16} color={C.blue} />
                <Text style={styles.imageActionTxt}>Caméra</Text>
              </Pressable>
            </View>

            {imageUris.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbRow}>
                {imageUris.map((uri) => (
                  <View key={uri} style={styles.thumbWrap}>
                    <Image source={{ uri }} style={styles.thumb} />
                    <Pressable
                      onPress={() => removeImage(uri)}
                      style={styles.thumbRemove}
                    >
                      <Ionicons name="close-circle" size={18} color={C.red} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Sauvegarder */}
            <Pressable
              onPress={handleSave}
              disabled={saving || savedOk || !transcription.trim()}
              style={({ pressed }) => [
                styles.saveBtn,
                (saving || !transcription.trim()) && styles.saveBtnDisabled,
                savedOk && styles.saveBtnOk,
                pressed && { opacity: 0.8 },
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name={savedOk ? 'checkmark-circle' : 'save-outline'} size={16} color="#fff" />
                  <Text style={styles.saveBtnText}>
                    {savedOk ? 'Sauvegardé !' : 'Sauvegarder le rapport'}
                  </Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Barre
  bar: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    ...C.shadow,
  },
  barInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.red },
  barTimerText: { color: C.red, fontSize: 14, fontWeight: '700' },
  barHint: { color: C.textMuted, fontSize: 12, flex: 1 },
  barError: { color: C.red, fontSize: 11, marginTop: 4 },

  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  micBtnRecording: {
    backgroundColor: C.redSoft,
    borderColor: '#fca5a5',
  },

  openBtn: {
    backgroundColor: C.blue,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  openBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Modal
  modalRoot: { flex: 1, backgroundColor: C.bg },
  modalScroll: { flex: 1 },
  modalContent: { padding: 20, paddingBottom: 48, gap: 14 },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modalTitle: { color: C.text, fontSize: 18, fontWeight: '800' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Audio
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  audioPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.cyanSoft,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  audioPillText: { color: C.cyan, fontSize: 13, fontWeight: '700' },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.blue,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  playBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Champs
  fieldLabel: { color: C.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  equipSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  equipSelectorText: { color: C.text, fontSize: 14, flex: 1 },

  equipList: {
    backgroundColor: C.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  equipItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  equipItemSelected: { backgroundColor: C.blueSoft },
  equipItemText: { color: C.text, fontSize: 14, flex: 1 },
  equipItemSite: { color: C.textMuted, fontSize: 11 },

  transcriptionInput: {
    backgroundColor: C.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: C.text,
    fontSize: 14,
    minHeight: 120,
    lineHeight: 20,
  },

  // Structurer
  structureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.purpleSoft,
    borderRadius: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#ddd6fe',
  },
  structureBtnDisabled: { opacity: 0.4 },
  structureBtnText: { color: C.purple, fontWeight: '700', fontSize: 14 },

  // Rapport structuré
  structuredBlock: {
    backgroundColor: C.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    gap: 12,
  },
  structuredTitle: { color: C.text, fontWeight: '800', fontSize: 14, marginBottom: 2 },
  structSection: { gap: 6 },
  structLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  structItem: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  structBullet: { fontSize: 14, lineHeight: 20 },
  structItemText: { color: C.textSub, fontSize: 13, lineHeight: 19, flex: 1 },

  // Images
  imageActions: { flexDirection: 'row', gap: 10 },
  imageActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.blueSoft,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  imageActionTxt: { color: C.blue, fontSize: 13, fontWeight: '700' },
  thumbRow: { flexDirection: 'row' },
  thumbWrap: { marginRight: 8, position: 'relative' },
  thumb: { width: 80, height: 80, borderRadius: 10, backgroundColor: C.surface2 },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: C.surface,
    borderRadius: 10,
  },

  // Sauvegarder
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.green,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnOk: { backgroundColor: C.greenText },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
