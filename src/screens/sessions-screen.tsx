import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import { SessionSummary } from '@/lib/eventlog';
import { listSessionSummaries } from '@/lib/session-store';

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

export default function SessionsScreen() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      listSessionSummaries().then((items) => {
        if (active) setSessions(items);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.title}>Sessions</Text>
        {sessions.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptyBody}>
              Every workout you finish lands here with its event log, ready for
              the auto-editor.
            </Text>
          </View>
        ) : (
          <FlatList
            data={sessions}
            keyExtractor={(item) => item.sessionId}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowMeta}>
                  {formatWhen(item.startedAt)} · {item.moveCount} moves ·{' '}
                  {formatDuration(item.durationMs)}
                  {item.hasVideo ? ' · video' : ''}
                </Text>
              </View>
            )}
          />
        )}
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
    gap: theme.spacing(4),
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.font.title,
    fontWeight: '700',
  },
  list: {
    gap: theme.spacing(3),
  },
  row: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing(4),
    gap: theme.spacing(1),
  },
  rowTitle: {
    color: theme.colors.text,
    fontSize: theme.font.heading,
    fontWeight: '600',
  },
  rowMeta: {
    color: theme.colors.textMuted,
    fontSize: theme.font.caption,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(2),
    paddingBottom: theme.spacing(16),
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: theme.font.heading,
    fontWeight: '600',
  },
  emptyBody: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 280,
  },
});
