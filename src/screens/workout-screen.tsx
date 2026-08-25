import { useAudioPlayer } from 'expo-audio';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import Constants from 'expo-constants';
import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import { loadTodaysPlan } from '@/lib/coach-store';
import { buildEventLog, MusicInfo, newSessionId } from '@/lib/eventlog';
import { BeatGrid } from '@/lib/music';
import {
  DEFAULT_MUSIC_SETTINGS,
  gridFor,
  loadMusicSettings,
  musicModeReady,
  MusicSettings,
} from '@/lib/music-settings';
import {
  begin,
  createPlayer,
  endSession,
  markRedo,
  pause,
  phaseRemainingSeconds,
  PlayerState,
  resume,
  skip,
  TickResult,
  tick,
} from '@/lib/player';
import { generateSession } from '@/lib/session';
import { saveSession } from '@/lib/session-store';

const TICK_MS = 250;

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function WorkoutScreen() {
  useKeepAwake();
  const router = useRouter();
  const [state, setState] = useState<PlayerState>(() =>
    createPlayer(generateSession()),
  );
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });
  // Prefer the coach's session once a week has been generated. Only swapped in
  // while still idle — never mid-session.
  useEffect(() => {
    let active = true;
    loadTodaysPlan().then((today) => {
      if (!active || !today.fromCoach) return;
      setState((current) =>
        current.phase === 'idle' ? createPlayer(today.plan) : current,
      );
    });
    return () => {
      active = false;
    };
  }, []);

  const sessionMeta = useRef({ id: '', startedAt: '' });
  const saved = useRef(false);
  const [saveResult, setSaveResult] = useState<{
    path: string;
    hasVideo: boolean;
  } | null>(null);

  // — Music (M3). The grid is anchored when playback starts; pause/resume
  // shifts it, and the log records the anchor as of session start. —
  const [music, setMusic] = useState<MusicSettings>(DEFAULT_MUSIC_SETTINGS);
  useEffect(() => {
    loadMusicSettings().then(setMusic);
  }, []);
  const audio = useAudioPlayer(music.trackUri);
  const musicInfo = useRef<MusicInfo | null>(null);
  const musicOn = musicModeReady(music);

  // — Recording rig (M2). The overlay below is plain UI on top of the
  // preview; nothing is ever burned into the raw file. —
  const [recordEnabled, setRecordEnabled] = useState(true);
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const cameraRef = useRef<CameraView>(null);
  const videoResult = useRef<Promise<string | null> | null>(null);
  const recordStartOffsetMs = useRef(0);
  const [isRecording, setIsRecording] = useState(false);

  const permissionsGranted =
    (camPermission?.granted ?? false) && (micPermission?.granted ?? false);
  const cameraActive = recordEnabled && permissionsGranted;

  useEffect(() => {
    if (!recordEnabled || permissionsGranted) return;
    requestCamPermission().then((cam) => {
      if (cam.granted) requestMicPermission();
    });
    // Ask once when recording is first wanted; the toggle re-triggers.
  }, [recordEnabled, permissionsGranted, requestCamPermission, requestMicPermission]);

  const applyResult = useCallback((result: TickResult) => {
    setState(result.state);
    for (const effect of result.effects) {
      Speech.speak(effect.text);
    }
  }, []);

  // The session clock: real elapsed time, not interval counts, so a busy JS
  // thread can't drift the log relative to the video.
  useEffect(() => {
    if (state.phase !== 'work' && state.phase !== 'rest') return;
    let last = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const delta = now - last;
      last = now;
      applyResult(tick(stateRef.current, delta));
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [state.phase, applyResult]);

  // Persist footage + log together, exactly once, when the session ends.
  useEffect(() => {
    if (state.phase !== 'done' || saved.current) return;
    if (state.events.length === 0) return;
    saved.current = true;
    const finish = async () => {
      let videoUri: string | null = null;
      if (videoResult.current) {
        cameraRef.current?.stopRecording();
        videoUri = await videoResult.current;
        setIsRecording(false);
      }
      const log = buildEventLog({
        sessionId: sessionMeta.current.id,
        startedAt: sessionMeta.current.startedAt,
        appVersion: Constants.expoConfig?.version ?? 'unknown',
        plan: {
          name: state.plan.name,
          moveIds: state.plan.moves.map((m) => m.exercise.id),
        },
        events: state.events,
        music: musicInfo.current,
      });
      const path = await saveSession(
        log,
        videoUri
          ? { uri: videoUri, startOffsetMs: recordStartOffsetMs.current }
          : null,
      );
      return { path, hasVideo: videoUri !== null };
    };
    finish()
      .then(setSaveResult)
      .catch(() => setSaveResult(null));
  }, [state]);

  useEffect(
    () => () => {
      Speech.stop();
      cameraRef.current?.stopRecording();
    },
    [],
  );

  const handleBegin = () => {
    sessionMeta.current = {
      id: newSessionId(),
      startedAt: new Date().toISOString(),
    };
    if (cameraActive && cameraRef.current) {
      // Frame 0 lands within camera-start latency of session 0; the editor
      // pads cuts with handles, so this approximation is fine (EVENTLOG.md).
      recordStartOffsetMs.current = stateRef.current.sessionMs;
      try {
        videoResult.current = cameraRef.current
          .recordAsync()
          .then((video) => video?.uri ?? null)
          .catch(() => null);
        setIsRecording(true);
      } catch {
        videoResult.current = null;
      }
    }
    let grid: BeatGrid | null = null;
    if (musicOn) {
      grid = gridFor(music, 0);
      musicInfo.current =
        grid && music.trackName
          ? {
              track: music.trackName,
              bpm: grid.bpm,
              beatGridStartMs: grid.beatGridStartMs,
              phraseBeats: grid.phraseBeats,
            }
          : null;
      try {
        // Deliberately not looping: a restart would break phrase alignment,
        // and the grid is extrapolated arithmetically from this one anchor.
        audio.seekTo(0);
        audio.play();
      } catch {
        // Playback failed; the session still runs, just without music.
      }
    }
    applyResult(begin(stateRef.current, grid));
  };

  const handlePauseResume = () => {
    const current = stateRef.current;
    if (current.paused) {
      if (musicOn) audio.play();
      applyResult(resume(current));
    } else {
      if (musicOn) audio.pause();
      applyResult(pause(current));
    }
  };

  const handleEnd = () => {
    if (musicOn) audio.pause();
    applyResult(endSession(stateRef.current));
  };

  const move = state.plan.moves[state.moveIndex];
  const next = state.plan.moves[state.moveIndex + 1];

  const camera = cameraActive ? (
    <CameraView
      ref={cameraRef}
      style={StyleSheet.absoluteFill}
      facing="front"
      mode="video"
      testID="camera-view"
    />
  ) : null;

  if (state.phase === 'idle') {
    return (
      <View style={styles.root}>
        {camera}
        <SafeAreaView style={[styles.safe, cameraActive && styles.scrim]}>
          <View style={styles.container}>
            <Text style={styles.kicker}>{state.plan.name.toUpperCase()}</Text>
            <Text style={styles.title}>
              {state.plan.moves.length} moves ·{' '}
              {formatSeconds(state.plan.totalSeconds)} min
            </Text>
            {state.plan.moves.map((m, i) => (
              <Text key={`${m.exercise.id}-${i}`} style={styles.planRow}>
                {m.exercise.name} — {m.workSeconds}s
              </Text>
            ))}
            {musicOn ? (
              <Text style={styles.musicNote}>
                Music mode: {music.trackName} at {music.bpm} BPM — moves change
                on the 8.
              </Text>
            ) : null}
            <View style={styles.recordRow}>
              <Text style={styles.recordLabel}>Record video</Text>
              <Switch
                value={recordEnabled}
                onValueChange={setRecordEnabled}
                trackColor={{ true: theme.colors.accent }}
                accessibilityLabel="Record video"
              />
            </View>
            {recordEnabled && !permissionsGranted ? (
              <Text style={styles.permissionNote}>
                Camera or microphone permission missing — the session will run
                without recording unless it&apos;s granted.
              </Text>
            ) : null}
            <View style={styles.spacer} />
            <Pressable
              style={styles.primaryButton}
              onPress={handleBegin}
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonText}>Begin session</Text>
            </Pressable>
            <Pressable
              style={styles.ghostButton}
              onPress={() => router.back()}
              accessibilityRole="button"
            >
              <Text style={styles.ghostButtonText}>Back</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (state.phase === 'done') {
    const moveCount = state.events.filter(
      (e) => e.type === 'move_start',
    ).length;
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.container}>
            <Text style={styles.kicker}>SESSION COMPLETE</Text>
            <Text style={styles.title}>
              {moveCount} moves ·{' '}
              {formatSeconds(Math.round(state.sessionMs / 1000))}
            </Text>
            <Text style={styles.subtitle}>
              {saveResult === null
                ? 'Saving session…'
                : saveResult.hasVideo
                  ? 'Footage and event log saved for the auto-editor.'
                  : 'Event log saved — no footage this session, so there is ' +
                    'nothing for the auto-editor to cut.'}
            </Text>
            <View style={styles.spacer} />
            <Pressable
              style={styles.primaryButton}
              onPress={() => router.back()}
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonText}>Done</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const isWork = state.phase === 'work';
  return (
    <View style={styles.root}>
      {camera}
      <SafeAreaView style={[styles.safe, cameraActive && styles.scrim]}>
        <View style={styles.container}>
          <View style={styles.statusRow}>
            <Text style={[styles.phaseLabel, !isWork && styles.phaseLabelRest]}>
              {isWork ? 'WORK' : 'REST'}
            </Text>
            <View style={styles.badges}>
              {musicOn ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{music.bpm} BPM</Text>
                </View>
              ) : null}
              {isRecording ? (
                <View style={styles.badge}>
                  <View style={styles.recDot} />
                  <Text style={styles.badgeText}>REC</Text>
                </View>
              ) : null}
            </View>
          </View>
          <Text style={styles.timer}>
            {formatSeconds(phaseRemainingSeconds(state))}
          </Text>
          <Text style={styles.moveName}>{move.exercise.name}</Text>
          <Text style={styles.subtitle}>{move.exercise.description}</Text>
          <View style={styles.spacer} />
          <Text style={styles.nextUp}>
            {next ? `Next: ${next.exercise.name}` : 'Last move'}
          </Text>
          <View style={styles.controls}>
            <Pressable
              style={styles.secondaryButton}
              onPress={handlePauseResume}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryButtonText}>
                {state.paused ? 'Resume' : 'Pause'}
              </Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => applyResult(markRedo(stateRef.current))}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryButtonText}>Redo</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => applyResult(skip(stateRef.current))}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryButtonText}>Skip</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={handleEnd}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryButtonText}>End</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  safe: {
    flex: 1,
  },
  scrim: {
    backgroundColor: 'rgba(11, 15, 20, 0.55)',
  },
  container: {
    flex: 1,
    padding: theme.spacing(5),
    gap: theme.spacing(2),
  },
  kicker: {
    color: theme.colors.accent,
    fontSize: theme.font.caption,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.font.title,
    fontWeight: '700',
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
    lineHeight: 22,
  },
  planRow: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
    lineHeight: 24,
  },
  musicNote: {
    color: theme.colors.accent,
    fontSize: theme.font.caption,
    lineHeight: 18,
    marginTop: theme.spacing(2),
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing(3),
  },
  recordLabel: {
    color: theme.colors.text,
    fontSize: theme.font.body,
    fontWeight: '600',
  },
  permissionNote: {
    color: theme.colors.danger,
    fontSize: theme.font.caption,
    lineHeight: 18,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badges: {
    flexDirection: 'row',
    gap: theme.spacing(2),
  },
  phaseLabel: {
    color: theme.colors.accent,
    fontSize: theme.font.heading,
    fontWeight: '800',
    letterSpacing: 3,
  },
  phaseLabelRest: {
    color: theme.colors.success,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing(2),
    paddingVertical: theme.spacing(1),
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.danger,
  },
  badgeText: {
    color: theme.colors.text,
    fontSize: theme.font.caption,
    fontWeight: '700',
    letterSpacing: 1,
  },
  timer: {
    color: theme.colors.text,
    fontSize: 96,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  moveName: {
    color: theme.colors.text,
    fontSize: theme.font.title,
    fontWeight: '700',
  },
  nextUp: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
    marginBottom: theme.spacing(2),
  },
  spacer: {
    flex: 1,
  },
  controls: {
    flexDirection: 'row',
    gap: theme.spacing(2),
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing(4),
    alignItems: 'center',
  },
  primaryButtonText: {
    color: theme.colors.bg,
    fontSize: theme.font.heading,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: theme.colors.surfaceRaised,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing(3),
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: theme.font.body,
    fontWeight: '600',
  },
  ghostButton: {
    paddingVertical: theme.spacing(3),
    alignItems: 'center',
  },
  ghostButtonText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
  },
});
