import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import { computeProgressStats, MoveProgress, ProgressPoint } from '@/lib/progress-stats';
import { listEventLogs } from '@/lib/session-store';
import { buildSessionTrainingLog } from '@/lib/training-log';

const RECENT_POINTS_SHOWN = 5;

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function formatDelta(deltaSeconds: number): string {
  return deltaSeconds > 0 ? `+${deltaSeconds}s` : `${deltaSeconds}s`;
}

function formatPoint(point: ProgressPoint): string {
  const redoNote = point.redoCount > 0 ? ` · ${point.redoCount} redo${point.redoCount > 1 ? 's' : ''}` : '';
  const statusNote = point.completed ? '' : ' · incomplete';
  return `${point.seconds}s${redoNote}${statusNote}`;
}

function StatCard({ stat }: { stat: MoveProgress }) {
  const recent = [...stat.points].reverse().slice(0, RECENT_POINTS_SHOWN);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{stat.label}</Text>
      {stat.points.length === 0 ? (
        <Text style={styles.empty}>No sessions logged yet</Text>
      ) : (
        <>
          <Text style={styles.summary}>
            Best {stat.bestSeconds}s · Latest {stat.latestSeconds}s
            {stat.deltaSeconds !== null ? ` · ${formatDelta(stat.deltaSeconds)} since first` : ''}
          </Text>
          {recent.map((point) => (
            <View key={point.sessionId} style={styles.pointRow}>
              <Text style={styles.pointDate}>{formatDate(point.date)}</Text>
              <Text style={styles.pointValue}>{formatPoint(point)}</Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

export default function ProgressStatsScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<MoveProgress[]>(() => computeProgressStats([]));

  useFocusEffect(
    useCallback(() => {
      let active = true;
      listEventLogs()
        .then((logs) => logs.map(buildSessionTrainingLog))
        .then((sessions) => {
          if (active) setStats(computeProgressStats(sessions));
        });
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Progress stats</Text>
        <Text style={styles.subtitle}>
          Time on task per move, session over session — a floor and squat hold
          add seconds, a redo count shrinking is progress too.
        </Text>
        {stats.map((stat) => (
          <StatCard key={stat.moveId} stat={stat} />
        ))}
        <Pressable style={styles.ghostButton} onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.ghostButtonText}>Back</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  container: {
    padding: theme.spacing(5),
    gap: theme.spacing(4),
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
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing(4),
    gap: theme.spacing(2),
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: theme.font.heading,
    fontWeight: '600',
  },
  summary: {
    color: theme.colors.accent,
    fontSize: theme.font.caption,
    fontWeight: '600',
  },
  empty: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
  },
  pointRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pointDate: {
    color: theme.colors.textMuted,
    fontSize: theme.font.caption,
  },
  pointValue: {
    color: theme.colors.text,
    fontSize: theme.font.caption,
  },
  ghostButton: { paddingVertical: theme.spacing(3), alignItems: 'center' },
  ghostButtonText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
  },
});
