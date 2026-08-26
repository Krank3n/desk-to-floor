import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import { EXERCISES } from '@/lib/exercises';
import { listReferenceClipIds } from '@/lib/reference-clips-store';

export default function MovesScreen() {
  const router = useRouter();
  const [clipIds, setClipIds] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      let active = true;
      listReferenceClipIds().then((ids) => {
        if (active) setClipIds(ids);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Move reference clips</Text>
        <Text style={styles.subtitle}>
          Film yourself doing a move well, then compare against it later.
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {EXERCISES.map((item) => {
          const saved = clipIds.has(item.id);
          return (
            <Pressable
              key={item.id}
              style={styles.row}
              onPress={() => router.push(`/moves/${item.id}`)}
              accessibilityRole="button"
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowSubtitle}>{item.description}</Text>
              </View>
              <Text style={[styles.badge, saved && styles.badgeSaved]}>
                {saved ? 'Saved' : 'No clip'}
              </Text>
            </Pressable>
          );
        })}
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
  header: {
    paddingHorizontal: theme.spacing(5),
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(3),
    gap: theme.spacing(1),
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.font.title,
    fontWeight: '700',
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
    lineHeight: 20,
  },
  list: {
    paddingHorizontal: theme.spacing(5),
    paddingBottom: theme.spacing(5),
    gap: theme.spacing(2),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing(4),
    paddingVertical: theme.spacing(3),
    gap: theme.spacing(2),
  },
  rowText: {
    flex: 1,
    gap: theme.spacing(0.5),
  },
  rowTitle: {
    color: theme.colors.text,
    fontSize: theme.font.body,
    fontWeight: '600',
  },
  rowSubtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.font.caption,
  },
  badge: {
    color: theme.colors.textMuted,
    fontSize: theme.font.caption,
    fontWeight: '600',
  },
  badgeSaved: {
    color: theme.colors.success,
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
