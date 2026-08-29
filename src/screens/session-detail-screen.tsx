import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import { getExercise } from '@/lib/exercises';
import { EventLog } from '@/lib/eventlog';
import { getEventLog, sessionVideoPath } from '@/lib/session-store';

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function moveName(id: string): string {
  try {
    return getExercise(id).name;
  } catch {
    return id;
  }
}

function sessionDuration(log: EventLog): number {
  const end = [...log.events].reverse().find((e) => e.type === 'session_end');
  const last = log.events[log.events.length - 1];
  return end?.atMs ?? last?.atMs ?? 0;
}

/** Its own component so useVideoPlayer gets a fresh instance per session. */
function FootagePlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return (
    <VideoView
      style={styles.video}
      player={player}
      nativeControls
      contentFit="contain"
      testID="session-footage"
    />
  );
}

export default function SessionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [log, setLog] = useState<EventLog | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    getEventLog(id).then((result) => {
      if (active) setLog(result);
    });
    return () => {
      active = false;
    };
  }, [id]);

  if (log === undefined) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container} />
      </SafeAreaView>
    );
  }

  if (log === null) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.title}>Session not found</Text>
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.kicker}>SESSION</Text>
        <Text style={styles.title}>{log.plan.name}</Text>
        <Text style={styles.subtitle}>
          {formatWhen(log.startedAt)} · {formatDuration(sessionDuration(log))}
        </Text>
        {log.recording ? (
          <FootagePlayer uri={sessionVideoPath(log.recording.file)} />
        ) : (
          <View style={styles.noVideo}>
            <Text style={styles.noVideoText}>
              No footage recorded for this session.
            </Text>
          </View>
        )}
        <Text style={styles.sectionTitle}>Moves</Text>
        <View style={styles.moveList}>
          {log.plan.moveIds.map((moveId, index) => (
            <Text key={`${moveId}-${index}`} style={styles.moveRow}>
              {moveName(moveId)}
            </Text>
          ))}
        </View>
      </ScrollView>
      <Pressable
        style={styles.ghostButton}
        onPress={() => router.back()}
        accessibilityRole="button"
      >
        <Text style={styles.ghostButtonText}>Back</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  container: {
    flexGrow: 1,
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
  },
  video: {
    height: 320,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    marginTop: theme.spacing(2),
  },
  noVideo: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing(4),
    marginTop: theme.spacing(2),
  },
  noVideoText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: theme.font.heading,
    fontWeight: '600',
    marginTop: theme.spacing(3),
  },
  moveList: {
    gap: theme.spacing(1),
  },
  moveRow: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
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
