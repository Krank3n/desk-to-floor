import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import {
  clearApiKey,
  getApiKey,
  looksLikeApiKey,
  maskApiKey,
  setApiKey,
} from '@/lib/api-key';
import { CoachWeek } from '@/lib/coach-plan';
import { generateCoachWeek } from '@/lib/coach-client';
import { loadCoachWeek, saveCoachWeek } from '@/lib/coach-store';
import { computeMoveProgressions, formatProgressionNotes } from '@/lib/progression';
import { listEventLogs } from '@/lib/session-store';
import { buildSessionTrainingLog, formatTrainingLog } from '@/lib/training-log';

export default function CoachScreen() {
  const router = useRouter();
  const [storedKey, setStoredKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [week, setWeek] = useState(1);
  const [plan, setPlan] = useState<CoachWeek | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getApiKey().then(setStoredKey);
    loadCoachWeek().then((existing) => {
      if (existing) {
        setPlan(existing);
        setWeek(existing.week);
      }
    });
  }, []);

  const handleSaveKey = useCallback(async () => {
    if (!looksLikeApiKey(keyInput)) {
      setKeyError('That does not look like an Anthropic key (sk-ant-…).');
      return;
    }
    setKeyError(null);
    await setApiKey(keyInput);
    setStoredKey(keyInput.trim());
    setKeyInput('');
  }, [keyInput]);

  const handleClearKey = useCallback(async () => {
    await clearApiKey();
    setStoredKey(null);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!storedKey) return;
    setBusy(true);
    setError(null);
    try {
      const logs = await listEventLogs();
      const sessionLogs = logs.map(buildSessionTrainingLog);
      const trainingLog = formatTrainingLog(sessionLogs);
      const progressionNotes = formatProgressionNotes(computeMoveProgressions(sessionLogs));
      const generated = await generateCoachWeek({
        apiKey: storedKey,
        week,
        trainingLog,
        progressionNotes,
      });
      await saveCoachWeek(generated);
      setPlan(generated);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Generation failed.');
    } finally {
      setBusy(false);
    }
  }, [storedKey, week]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>AI coach</Text>
        <Text style={styles.subtitle}>
          Claude reads your training log and programs the week. Your key stays
          on this device, in the keystore.
        </Text>

        <Text style={styles.sectionLabel}>API KEY</Text>
        <View style={styles.card}>
          {storedKey ? (
            <>
              <Text style={styles.cardValue}>{maskApiKey(storedKey)}</Text>
              <Pressable
                style={styles.secondaryButton}
                onPress={handleClearKey}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryButtonText}>Remove key</Text>
              </Pressable>
            </>
          ) : (
            <>
              <TextInput
                style={styles.input}
                value={keyInput}
                onChangeText={setKeyInput}
                placeholder="sk-ant-…"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                accessibilityLabel="API key"
              />
              {keyError ? <Text style={styles.error}>{keyError}</Text> : null}
              <Pressable
                style={styles.secondaryButton}
                onPress={handleSaveKey}
                accessibilityRole="button"
              >
                <Text style={styles.secondaryButtonText}>Save key</Text>
              </Pressable>
            </>
          )}
        </View>

        <Text style={styles.sectionLabel}>PROGRAM WEEK</Text>
        <View style={[styles.card, styles.rowBetween]}>
          <Pressable
            style={styles.stepButton}
            onPress={() => setWeek((w) => Math.max(1, w - 1))}
            accessibilityRole="button"
            accessibilityLabel="Previous week"
          >
            <Text style={styles.stepButtonText}>−</Text>
          </Pressable>
          <Text style={styles.weekValue}>Week {week}</Text>
          <Pressable
            style={styles.stepButton}
            onPress={() => setWeek((w) => Math.min(12, w + 1))}
            accessibilityRole="button"
            accessibilityLabel="Next week"
          >
            <Text style={styles.stepButtonText}>+</Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.primaryButton, !storedKey && styles.disabledButton]}
          onPress={handleGenerate}
          disabled={!storedKey || busy}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color={theme.colors.bg} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {storedKey ? 'Generate this week' : 'Add a key first'}
            </Text>
          )}
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {plan ? (
          <>
            <Text style={styles.sectionLabel}>
              WEEK {plan.week} · {plan.phase.toUpperCase()}
            </Text>
            {plan.notes ? (
              <View style={styles.card}>
                <Text style={styles.notes}>{plan.notes}</Text>
              </View>
            ) : null}
            {plan.rejectedMoveIds.length > 0 ? (
              <Text style={styles.warning}>
                Ignored {plan.rejectedMoveIds.length} unknown move(s):{' '}
                {plan.rejectedMoveIds.join(', ')}
              </Text>
            ) : null}
            {plan.sessions.map((session, i) => (
              <View key={`${session.name}-${i}`} style={styles.card}>
                <Text style={styles.cardValue}>{session.name}</Text>
                <Text style={styles.hint}>
                  {session.moves.length} moves ·{' '}
                  {Math.round(session.totalSeconds / 60)} min
                </Text>
                {session.moves.map((move, j) => (
                  <Text key={`${move.exercise.id}-${j}`} style={styles.moveRow}>
                    {move.exercise.name} — {move.workSeconds}s
                  </Text>
                ))}
              </View>
            ))}
          </>
        ) : null}

        <Pressable
          style={styles.ghostButton}
          onPress={() => router.back()}
          accessibilityRole="button"
        >
          <Text style={styles.ghostButtonText}>Back</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  container: { padding: theme.spacing(5), gap: theme.spacing(3) },
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
  sectionLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.font.caption,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: theme.spacing(2),
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing(4),
    gap: theme.spacing(2),
  },
  cardValue: {
    color: theme.colors.text,
    fontSize: theme.font.heading,
    fontWeight: '600',
  },
  input: {
    backgroundColor: theme.colors.surfaceRaised,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.sm,
    color: theme.colors.text,
    fontSize: theme.font.body,
    padding: theme.spacing(3),
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekValue: {
    color: theme.colors.text,
    fontSize: theme.font.heading,
    fontWeight: '700',
  },
  stepButton: {
    backgroundColor: theme.colors.surfaceRaised,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing(5),
    paddingVertical: theme.spacing(2),
  },
  stepButtonText: {
    color: theme.colors.text,
    fontSize: theme.font.heading,
    fontWeight: '700',
  },
  notes: {
    color: theme.colors.text,
    fontSize: theme.font.body,
    lineHeight: 22,
  },
  hint: { color: theme.colors.textMuted, fontSize: theme.font.caption },
  moveRow: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
    lineHeight: 22,
  },
  warning: { color: theme.colors.accent, fontSize: theme.font.caption },
  error: { color: theme.colors.danger, fontSize: theme.font.caption },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing(4),
    alignItems: 'center',
    marginTop: theme.spacing(2),
  },
  disabledButton: { opacity: 0.4 },
  primaryButtonText: {
    color: theme.colors.bg,
    fontSize: theme.font.heading,
    fontWeight: '700',
  },
  secondaryButton: {
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
  ghostButton: { paddingVertical: theme.spacing(3), alignItems: 'center' },
  ghostButtonText: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
  },
});
