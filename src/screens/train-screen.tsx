import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import { loadTodaysPlan } from '@/lib/coach-store';
import { generateSession } from '@/lib/session';

export default function TrainScreen() {
  const router = useRouter();
  const [plan, setPlan] = useState(() => generateSession());
  const [fromCoach, setFromCoach] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadTodaysPlan().then((today) => {
        if (!active) return;
        setPlan(today.plan);
        setFromCoach(today.fromCoach);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const minutes = Math.round(plan.totalSeconds / 60);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.kicker}>DESK → FLOOR</Text>
        <Text style={styles.title}>Ready to train</Text>
        <Text style={styles.subtitle}>
          Wrists first, freezes later. Today is scripted, spoken, and logged —
          press start and follow the voice.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>
            {fromCoach ? 'PROGRAMMED BY YOUR COACH' : "TODAY'S SESSION"}
          </Text>
          <Text style={styles.cardTitle}>{plan.name}</Text>
          <Text style={styles.cardBody}>
            {plan.moves.length} moves · about {minutes} min ·{' '}
            {plan.moves[0].exercise.name} through{' '}
            {plan.moves[plan.moves.length - 1].exercise.name}
          </Text>
        </View>

        <View style={styles.spacer} />
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push('/workout')}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>Start session</Text>
        </Pressable>
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
    gap: theme.spacing(3),
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
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing(4),
    gap: theme.spacing(1),
    marginTop: theme.spacing(2),
  },
  cardLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.font.caption,
    fontWeight: '600',
    letterSpacing: 1,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: theme.font.heading,
    fontWeight: '600',
  },
  cardBody: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
    lineHeight: 22,
  },
  spacer: {
    flex: 1,
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
});
