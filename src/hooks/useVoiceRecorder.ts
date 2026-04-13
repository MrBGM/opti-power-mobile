/**
 * Hook d'enregistrement audio via expo-av.
 * Gere le cycle de vie : idle -> recording -> stopped -> playing
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';

export type RecorderState = 'idle' | 'recording' | 'stopped' | 'playing';

export interface UseVoiceRecorderResult {
  state: RecorderState;
  durationMs: number;
  audioUri: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  playRecording: () => Promise<void>;
  stopPlayback: () => Promise<void>;
  resetRecorder: () => void;
  error: string | null;
}

export function useVoiceRecorder(): UseVoiceRecorderResult {
  const [state, setState] = useState<RecorderState>('idle');
  const [durationMs, setDurationMs] = useState(0);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Nettoyage a la fermeture du composant
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      void recordingRef.current?.stopAndUnloadAsync().catch(() => {});
      void soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setError('Permission microphone refusee. Active-la dans les parametres de l\'appareil.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      startTimeRef.current = Date.now();
      setDurationMs(0);
      setState('recording');

      timerRef.current = setInterval(() => {
        setDurationMs(Date.now() - startTimeRef.current);
      }, 200);
    } catch (e) {
      setError('Impossible de demarrer l\'enregistrement : ' + String(e));
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string | null> => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!recordingRef.current) return null;
    try {
      const finalDuration = Date.now() - startTimeRef.current;
      setDurationMs(finalDuration);
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI() ?? null;
      recordingRef.current = null;
      setAudioUri(uri);
      setState('stopped');

      // Retablit le mode audio normal (lecture haut-parleur)
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      return uri;
    } catch (e) {
      setError('Erreur a l\'arret : ' + String(e));
      return null;
    }
  }, []);

  const playRecording = useCallback(async () => {
    if (!audioUri) return;
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync({ uri: audioUri });
      soundRef.current = sound;
      setState('playing');
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setState('stopped');
          void sound.unloadAsync().catch(() => {});
          soundRef.current = null;
        }
      });
    } catch (e) {
      setError('Erreur de lecture : ' + String(e));
      setState('stopped');
    }
  }, [audioUri]);

  const stopPlayback = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setState('stopped');
  }, []);

  const resetRecorder = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    void recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    void soundRef.current?.unloadAsync().catch(() => {});
    recordingRef.current = null;
    soundRef.current = null;
    setAudioUri(null);
    setDurationMs(0);
    setState('idle');
    setError(null);
  }, []);

  return {
    state,
    durationMs,
    audioUri,
    startRecording,
    stopRecording,
    playRecording,
    stopPlayback,
    resetRecorder,
    error,
  };
}
