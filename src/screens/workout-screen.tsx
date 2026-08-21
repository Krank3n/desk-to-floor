import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import { buildEventLog, newSessionId } from '@/lib/eventlog';
import {
  begin,
  createPlayer,
  endSession,
  pause,
  phaseRemainingSeconds,
  PlayerState,
  resume,
  skip,
  TickResult,
  tick,
} from '@/lib/player';
import { generateSession } from '@/lib/session';
import { saveEventLog } from '@/lib/session-store';

const TICK_MS = 250;

function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function WorkoutScreen() {
  const router = useRouter();
  const [state, setState] = useState<PlayerState>(() =>
    createPlayer(generateSession()),
  );
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });
  const sessionMeta = useRef({ id: '', startedAt: '' });
  const saved = useRef(false);
  const [savedPath, setSavedPath] = useState<string | null>(null);

  const applyResult = useCallback((result: TickResult) => {
    setState(result.state);
    for (const effect of result.effects) {
      Speech.speak(effect.text);
    }
  }, []);

  // The session clock: real elapsed time, not interval counts, so a busy JS
  // thread can't drift the log relative to (future) video.
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

  // Persist the log exactly once when the session reaches done.
  useEffect(() => {
    if (state.phase !== 'done' || saved.current) return;
    if (state.events.length === 0) return;
    saved.current = true;
    const log = buildEventLog({
      sessionId: sessionMeta.current.id,
      startedAt: sessionMeta.current.startedAt,
      appVersion: Constants.expoConfig?.version ?? 'unknown',
      plan: {
        name: state.plan.name,
        moveIds: state.plan.moves.map((m) => m.exercise.id),
      },
      events: state.events,
    });
    saveEventLog(log)
      .then(setSavedPath)
      .catch(() => setSavedPath(null));
  }, [state]);

  useEffect(
    () => () => {
      Speech.stop();
    },
    [],
  );

  const handleBegin = () => {
    sessionMeta.current = {
      id: newSessionId(),
      startedAt: new Date().toISOString(),
    };
    applyResult(begin(stateRef.current));
  };

  const move = state.plan.moves[state.moveIndex];
  const next = state.plan.moves[state.moveIndex + 1];

  if (state.phase === 'idle') {
    return (
      <SafeAreaView style={styles.safe}>
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
    );
  }

  if (state.phase === 'done') {
    const moveCount = state.events.filter(
      (e) => e.type === 'move_start',
    ).length;
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.kicker}>SESSION COMPLETE</Text>
          <Text style={styles.title}>
            {moveCount} moves · {formatSeconds(Math.round(state.sessionMs / 1000))}
          </Text>
          <Text style={styles.subtitle}>
            {savedPath
              ? 'Event log saved. It will drive the auto-editor in M4.'
              : 'Saving event log…'}
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
    );
  }

  const isWork = state.phase === 'work';
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={[styles.phaseLabel, !isWork && styles.phaseLabelRest]}>
          {isWork ? 'WORK' : 'REST'}
        </Text>
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
            onPress={() =>
              applyResult(
                state.paused
                  ? resume(stateRef.current)
                  : pause(stateRef.current),
              )
            }
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonText}>
              {state.paused ? 'Resume' : 'Pause'}
            </Text>
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
            onPress={() => applyResult(endSession(stateRef.current))}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonText}>End</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.bg,
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
  phaseLabel: {
    color: theme.colors.accent,
    fontSize: theme.font.heading,
    fontWeight: '800',
    letterSpacing: 3,
  },
  phaseLabelRest: {
    color: theme.colors.success,
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
    gap: theme.spacing(3),
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
