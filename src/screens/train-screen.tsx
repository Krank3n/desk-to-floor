import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';

export default function TrainScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.kicker}>DESK → FLOOR</Text>
        <Text style={styles.title}>Ready to train</Text>
        <Text style={styles.subtitle}>
          Wrists first, freezes later. The workout engine arrives in M1 — this
          build proves the shell, theme, and pipeline.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>NEXT UP (M1)</Text>
          <Text style={styles.cardTitle}>Undesk · Week 1</Text>
          <Text style={styles.cardBody}>
            Wrist prep · 90/90 hips · T-spine rotation · deep squat · toprock
            foundations
          </Text>
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
});
