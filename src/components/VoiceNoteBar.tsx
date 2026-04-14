/**
 * Barre d'enregistrement vocal flottante (theme clair).
 * - Affichée en bas de l'écran Rapports
 * - Tap micro → enregistrement audio
 * - Après arrêt : modal transcription + structuration + images
 * - Sauvegarde en SQLite (table voice_reports)
 */
import { useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';
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
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { MaintenanceReportCharts } from '@/components/MaintenanceReportCharts';
import { fmtDuration, structuredReportIsEmpty, structureTranscription } from '@/lib/reportStructurer';
import { structureTranscriptionSmart } from '@/lib/reportLlmStructure';
import { transcribeAudio } from '@/lib/whisperTranscribe';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { saveVoiceReport } from '@/storage/voiceReportsRepo';
import type { StructuredReport } from '@/storage/voiceReportsRepo';
import { resolveTranscribeKey, useServerConfigStore } from '@/store/serverConfigStore';
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

type AudioSegment = { uri: string; durationMs: number };

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
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const recorder = useVoiceRecorder();
  const transcribeProvider = useServerConfigStore((s) => s.transcribeProvider);
  const activeApiKey = resolveTranscribeKey(transcribeProvider);

  const [modalVisible, setModalVisible] = useState(false);
  const [audioSegments, setAudioSegments] = useState<AudioSegment[]>([]);
  const [transcription, setTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isStructuring, setIsStructuring] = useState(false);
  const [structureError, setStructureError] = useState<string | null>(null);
  const [structureSource, setStructureSource] = useState<'llm' | 'local' | null>(null);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [structured, setStructured] = useState<StructuredReport | null>(null);
  const [selectedEquip, setSelectedEquip] = useState<Equipment | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [showEquipList, setShowEquipList] = useState(false);
  const [imageUris, setImageUris] = useState<string[]>([]);
  const durationRef = useRef(0);
  const segmentSoundRef = useRef<Audio.Sound | null>(null);
  const [playingSegmentUri, setPlayingSegmentUri] = useState<string | null>(null);
  /** True entre « Complément audio » et la fin de transcription du nouveau clip. */
  const [supplementMode, setSupplementMode] = useState(false);

  useEffect(() => {
    const uri = recorder.audioUri;
    if (!modalVisible || !uri || recorder.state !== 'stopped') return;
    setAudioSegments((prev) => {
      if (prev.length > 0) return prev;
      return [{ uri, durationMs: recorder.durationMs || durationRef.current }];
    });
  }, [modalVisible, recorder.audioUri, recorder.state, recorder.durationMs]);

  useEffect(() => {
    return () => {
      void segmentSoundRef.current?.unloadAsync().catch(() => {});
      segmentSoundRef.current = null;
    };
  }, []);

  async function stopSegmentPlayback() {
    if (segmentSoundRef.current) {
      await segmentSoundRef.current.stopAsync().catch(() => {});
      await segmentSoundRef.current.unloadAsync().catch(() => {});
      segmentSoundRef.current = null;
    }
    setPlayingSegmentUri(null);
  }

  async function playSegment(uri: string) {
    if (!uri) return;
    try {
      await recorder.stopPlayback();
      await stopSegmentPlayback();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri });
      segmentSoundRef.current = sound;
      setPlayingSegmentUri(uri);
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((st) => {
        if (st.isLoaded && st.didJustFinish) {
          void sound.unloadAsync().catch(() => {});
          if (segmentSoundRef.current === sound) segmentSoundRef.current = null;
          setPlayingSegmentUri(null);
        }
      });
    } catch {
      setPlayingSegmentUri(null);
    }
  }

  async function handleMicPress() {
    if (recorder.state === 'recording') {
      const uri = await recorder.stopRecording();
      durationRef.current = recorder.durationMs;

      if (supplementMode && modalVisible) {
        if (!uri) {
          setSupplementMode(false);
          return;
        }
        setSupplementMode(false);
        setAudioSegments((prev) => [...prev, { uri, durationMs: recorder.durationMs || durationRef.current }]);
        setStructured(null);
        setStructureSource(null);
        if (activeApiKey) {
          setIsTranscribing(true);
          const result = await transcribeAudio(uri, { provider: transcribeProvider, apiKey: activeApiKey }, 'fr');
          setIsTranscribing(false);
          if ('text' in result && result.text) {
            setTranscription((t) => (t.trim() ? `${t.trim()}\n\n--- Complément audio ---\n\n` : '') + result.text);
          } else {
            setTranscribeError(result.error ?? 'Erreur de transcription du complément');
          }
        }
        return;
      }

      setTranscription('');
      setStructured(null);
      setSavedOk(false);
      setImageUris([]);
      setTranscribeError(null);
      if (uri) {
        setAudioSegments([{ uri, durationMs: durationRef.current }]);
        setModalVisible(true);
        if (activeApiKey) {
          setIsTranscribing(true);
          const result = await transcribeAudio(uri, { provider: transcribeProvider, apiKey: activeApiKey }, 'fr');
          setIsTranscribing(false);
          if ('text' in result && result.text) {
            setTranscription(result.text);
          } else {
            setTranscribeError(result.error ?? 'Erreur de transcription');
          }
        }
      }
    } else if (recorder.state === 'idle' || recorder.state === 'stopped') {
      if (modalVisible && !supplementMode) return;
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

  async function handleStructure() {
    if (!transcription.trim()) return;
    setStructureError(null);
    setIsStructuring(true);
    setStructureSource(null);
    try {
      const opts = activeApiKey
        ? { provider: transcribeProvider, apiKey: activeApiKey }
        : null;
      const { report, source } = await structureTranscriptionSmart(transcription, opts);
      setStructured(report);
      setStructureSource(source);
    } catch {
      setStructured(structureTranscription(transcription));
      setStructureSource('local');
      setStructureError('Structuration IA indisponible — version locale appliquée.');
    } finally {
      setIsStructuring(false);
    }
  }

  async function handleAppendAudioSupplement() {
    if (!activeApiKey) {
      setTranscribeError('Ajoutez EXPO_PUBLIC_GROQ_API_KEY ou EXPO_PUBLIC_OPENAI_API_KEY pour transcrire un complément audio.');
      return;
    }
    if (isTranscribing || isStructuring) return;
    await stopSegmentPlayback();
    await recorder.stopPlayback();
    setTranscribeError(null);
    setStructured(null);
    setStructureSource(null);
    setSupplementMode(true);
    await recorder.resetRecorder();
    await recorder.startRecording();
  }

  async function handleSave() {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const struct = structured ?? structureTranscription(transcription);
      const segs = audioSegments.length > 0 ? audioSegments : (recorder.audioUri ? [{ uri: recorder.audioUri, durationMs: recorder.durationMs || durationRef.current }] : []);
      const totalDur = segs.reduce((a, s) => a + s.durationMs, 0) || recorder.durationMs || durationRef.current;
      await saveVoiceReport({
        id: genId(),
        equipmentId: selectedEquip?.id ?? null,
        equipmentName: selectedEquip?.name ?? null,
        audioUri: segs[0]?.uri ?? recorder.audioUri,
        extraAudioUris: segs.slice(1).map((s) => s.uri),
        transcription,
        structuredJson: struct,
        durationMs: totalDur,
        imageUris,
        status: 'saved',
        createdAt: now,
        updatedAt: now,
      });
      setSavedOk(true);
      setTimeout(() => {
        setModalVisible(false);
        recorder.resetRecorder();
        void stopSegmentPlayback();
        setAudioSegments([]);
        setTranscription('');
        setStructured(null);
        setSelectedEquip(null);
        setImageUris([]);
        setSavedOk(false);
        setTranscribeError(null);
        setStructureError(null);
        setStructureSource(null);
        setSupplementMode(false);
        onSaved?.();
      }, 1200);
    } catch { /* silencieux */ } finally {
      setSaving(false);
    }
  }

  function handleCloseModal() {
    setModalVisible(false);
    void stopSegmentPlayback();
    recorder.resetRecorder();
    setAudioSegments([]);
    setTranscription('');
    setStructured(null);
    setSelectedEquip(null);
    setImageUris([]);
    setSavedOk(false);
    setTranscribeError(null);
    setStructureError(null);
    setStructureSource(null);
    setSupplementMode(false);
  }

  const isRecording = recorder.state === 'recording';
  const isPlaying = recorder.state === 'playing';

  const displaySegments: AudioSegment[] =
    audioSegments.length > 0
      ? audioSegments
      : recorder.audioUri && recorder.state === 'stopped'
        ? [{ uri: recorder.audioUri, durationMs: recorder.durationMs || durationRef.current }]
        : [];
  const totalSegDur = displaySegments.reduce((a, s) => a + s.durationMs, 0);

  const hasDraftAudio = recorder.state === 'stopped' && Boolean(recorder.audioUri);

  return (
    <>
      {/* ── Micro flottant (FAB) — ne masque plus la liste des rapports ── */}
      <View style={[styles.fabWrap, { paddingBottom: Math.max(insets.bottom + 12, 20) }]} pointerEvents="box-none">
        {isRecording ? (
          <View style={styles.recPill}>
            <RecordingDot />
            <Text style={styles.recPillTime}>{fmtDuration(recorder.durationMs)}</Text>
            <Text style={styles.recPillHint} numberOfLines={1}>
              {supplementMode && modalVisible ? 'Complément — Stop' : 'Enregistrement…'}
            </Text>
          </View>
        ) : null}

        {recorder.error ? (
          <Text style={styles.fabError} numberOfLines={2}>{recorder.error}</Text>
        ) : null}

        <Pressable
          onPress={hasDraftAudio ? () => setModalVisible(true) : handleMicPress}
          style={({ pressed }) => [
            styles.fabMain,
            isRecording && styles.fabMainRecording,
            hasDraftAudio && !isRecording && styles.fabMainDraft,
            pressed && { opacity: 0.92 },
          ]}
          accessibilityLabel={
            isRecording
              ? 'Arrêter l’enregistrement'
              : hasDraftAudio
                ? 'Ouvrir la note vocale'
                : 'Démarrer un enregistrement vocal'
          }
        >
          {isRecording ? (
            <Ionicons name="stop" size={26} color={C.red} />
          ) : hasDraftAudio ? (
            <Ionicons name="document-text" size={26} color={C.blue} />
          ) : (
            <Ionicons name="mic" size={28} color="#fff" />
          )}
        </Pressable>
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

            {supplementMode && isRecording ? (
              <View style={styles.supplementBanner}>
                <Ionicons name="mic" size={16} color={C.purple} />
                <Text style={styles.supplementBannerText}>
                  Complément audio : parle puis appuie sur Stop (bouton rouge flottant) pour transcrire et fusionner au texte.
                </Text>
              </View>
            ) : null}

            {/* Durée + lecture (une ou plusieurs pistes) */}
            <View style={styles.audioRow}>
              <View style={styles.audioPill}>
                <Ionicons name="mic" size={14} color={C.cyan} />
                <Text style={styles.audioPillText}>
                  {fmtDuration(totalSegDur || recorder.durationMs || durationRef.current)}
                  {displaySegments.length > 1 ? ` · ${displaySegments.length} pistes` : ''}
                </Text>
              </View>
              {displaySegments.length <= 1 ? (
                <Pressable
                  onPress={async () => {
                    await stopSegmentPlayback();
                    if (isPlaying) await recorder.stopPlayback();
                    else await recorder.playRecording();
                  }}
                  style={({ pressed }) => [styles.playBtn, pressed && { opacity: 0.8 }]}
                  disabled={!recorder.audioUri && displaySegments.length === 0}
                >
                  <Ionicons name={isPlaying ? 'stop-circle' : 'play-circle'} size={16} color="#fff" />
                  <Text style={styles.playBtnText}>{isPlaying ? 'Stop' : 'Écouter'}</Text>
                </Pressable>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.trackScroll}>
                  {displaySegments.map((seg, idx) => {
                    const active = playingSegmentUri === seg.uri;
                    return (
                      <Pressable
                        key={`${seg.uri}-${idx}`}
                        onPress={() => (active ? void stopSegmentPlayback() : void playSegment(seg.uri))}
                        style={({ pressed }) => [styles.trackChip, active && styles.trackChipOn, pressed && { opacity: 0.85 }]}
                      >
                        <Ionicons name={active ? 'stop-circle' : 'play-circle'} size={14} color={active ? '#fff' : C.blue} />
                        <Text style={[styles.trackChipTxt, active && styles.trackChipTxtOn]}>
                          Piste {idx + 1} · {fmtDuration(seg.durationMs)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
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
            {isTranscribing ? (
              <View style={styles.transcribingBox}>
                <ActivityIndicator size="small" color={C.blue} />
                <Text style={styles.transcribingText}>Transcription en cours...</Text>
              </View>
            ) : (
              <>
                {transcribeError ? (
                  <View style={styles.transcribeErrorBox}>
                    <Ionicons name="warning-outline" size={14} color={C.amber} />
                    <Text style={styles.transcribeErrorText}>{transcribeError}</Text>
                  </View>
                ) : null}
                <TextInput
                  value={transcription}
                  onChangeText={(v) => {
                    setTranscription(v);
                    setStructured(null);
                    setStructureSource(null);
                  }}
                  placeholder={
                    activeApiKey
                      ? `Transcription ${transcribeProvider === 'groq' ? 'Groq' : 'OpenAI'} automatique...`
                      : 'Définir EXPO_PUBLIC_GROQ_API_KEY ou EXPO_PUBLIC_OPENAI_API_KEY — ou saisir la transcription'
                  }
                  placeholderTextColor={C.textMuted}
                  multiline
                  textAlignVertical="top"
                  style={styles.transcriptionInput}
                />
              </>
            )}

            <Pressable
              onPress={handleAppendAudioSupplement}
              disabled={!transcription.trim() || isTranscribing || isStructuring || isRecording}
              style={({ pressed }) => [
                styles.supplementBtn,
                (!transcription.trim() || isTranscribing || isStructuring || isRecording) && styles.structureBtnDisabled,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Ionicons name="add-circle-outline" size={16} color={C.cyan} />
              <Text style={styles.supplementBtnText}>Ajouter un complément audio</Text>
            </Pressable>
            <Text style={styles.supplementHint}>
              Le texte sera fusionné à la transcription ; chaque piste reste disponible à l’écoute avant enregistrement.
            </Text>

            {/* Bouton structurer */}
            <Pressable
              onPress={() => void handleStructure()}
              disabled={!transcription.trim() || isStructuring || isTranscribing}
              style={({ pressed }) => [
                styles.structureBtn,
                (!transcription.trim() || isStructuring || isTranscribing) && styles.structureBtnDisabled,
                pressed && { opacity: 0.8 },
              ]}
            >
              {isStructuring ? (
                <ActivityIndicator size="small" color={C.purple} />
              ) : (
                <Ionicons name="sparkles" size={14} color={C.purple} />
              )}
              <Text style={styles.structureBtnText}>
                {isStructuring ? 'Structuration…' : 'Structurer le rapport'}
              </Text>
            </Pressable>

            {structureError ? (
              <View style={styles.transcribeErrorBox}>
                <Ionicons name="information-circle-outline" size={14} color={C.amber} />
                <Text style={styles.transcribeErrorText}>{structureError}</Text>
              </View>
            ) : null}

            {structureSource ? (
              <Text style={styles.structureSourceTag}>
                {structureSource === 'llm'
                  ? 'Sections et graphiques proposés par l’IA (vérifiez avant envoi).'
                  : 'Classé localement par mots-clés (activez une clé API pour une structuration IA).'}
              </Text>
            ) : null}

            {/* Rapport structuré */}
            {structured && !structuredReportIsEmpty(structured) && (
              <View style={styles.structuredBlock}>
                <View style={styles.reportHeaderRow}>
                  <Ionicons name="document-text-outline" size={14} color={C.purple} />
                  <Text style={styles.structuredTitle}>Rapport de maintenance</Text>
                </View>
                {structured._sections?.objet && structured._sections.objet.length > 0 ? (
                  <StructuredSection title="I. Objet de l'intervention" items={structured._sections.objet} color={C.blue} />
                ) : null}
                {structured._sections?.constats && structured._sections.constats.length > 0 ? (
                  <StructuredSection title="II. Constatations terrain" items={structured._sections.constats} color={C.cyan} />
                ) : null}
                {structured.anomalies.length > 0 ? (
                  <StructuredSection title="III. Anomalies / défauts" items={structured.anomalies} color={C.red} />
                ) : null}
                {structured._sections?.mesures && structured._sections.mesures.length > 0 ? (
                  <StructuredSection title="IV. Paramètres mesurés" items={structured._sections.mesures} color={C.green} />
                ) : null}
                {structured._sections?.travaux && structured._sections.travaux.length > 0 ? (
                  <StructuredSection title="V. Travaux effectués" items={structured._sections.travaux} color={C.purple} />
                ) : null}
                {structured._sections?.recommandations && structured._sections.recommandations.length > 0 ? (
                  <StructuredSection title="VI. Recommandations & suivi" items={structured._sections.recommandations} color={C.amber} />
                ) : null}
                {structured.charts && structured.charts.length > 0 ? (
                  <MaintenanceReportCharts charts={structured.charts} width={Math.min(winW - 48, 520)} />
                ) : null}
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
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.red },

  fabWrap: {
    position: 'absolute',
    right: 16,
    left: 16,
    bottom: 0,
    alignItems: 'flex-end',
    gap: 8,
    zIndex: 30,
  },
  recPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 300,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: '#fecaca',
    ...C.shadowMd,
  },
  recPillTime: { color: C.red, fontSize: 15, fontWeight: '800' },
  recPillHint: { flex: 1, color: C.textSub, fontSize: 12, fontWeight: '600' },

  fabError: {
    alignSelf: 'flex-end',
    maxWidth: 280,
    color: C.red,
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'right',
    backgroundColor: C.redSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },

  fabMain: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: C.blue,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  fabMainRecording: {
    backgroundColor: C.surface,
    borderWidth: 2,
    borderColor: C.red,
  },
  fabMainDraft: {
    backgroundColor: C.surface,
    borderWidth: 2,
    borderColor: C.blue,
  },

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
  transcribingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.blueSoft,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 18,
    minHeight: 60,
  },
  transcribingText: { color: C.blue, fontSize: 14, fontWeight: '600' },
  transcribeErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.amberSoft,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  transcribeErrorText: { color: C.amber, fontSize: 12, flex: 1, lineHeight: 18 },

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
  structureSourceTag: { color: C.textMuted, fontSize: 11, lineHeight: 16, paddingHorizontal: 2 },

  supplementBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: C.purpleSoft,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd6fe',
    padding: 12,
  },
  supplementBannerText: { color: C.purpleText, fontSize: 13, lineHeight: 19, flex: 1 },

  supplementBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.cyanSoft,
    borderRadius: 10,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: C.border,
  },
  supplementBtnText: { color: C.cyan, fontWeight: '700', fontSize: 13 },
  supplementHint: { color: C.textMuted, fontSize: 11, lineHeight: 16, marginTop: -6 },

  trackScroll: { flexGrow: 0, maxWidth: 220 },
  trackChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: C.blueSoft,
    borderWidth: 1,
    borderColor: C.border,
  },
  trackChipOn: { backgroundColor: C.blue, borderColor: C.blue },
  trackChipTxt: { color: C.blue, fontSize: 12, fontWeight: '700' },
  trackChipTxtOn: { color: '#fff' },

  // Rapport structuré
  structuredBlock: {
    backgroundColor: C.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    gap: 12,
  },
  reportHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  structuredTitle: { color: C.text, fontWeight: '800', fontSize: 14 },
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
