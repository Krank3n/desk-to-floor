import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import { bpmFromTaps } from '@/lib/music';
import {
  DEFAULT_MUSIC_SETTINGS,
  importTrack,
  loadMusicSettings,
  MusicSettings,
  saveMusicSettings,
} from '@/lib/music-settings';

/** A gap this long ends the current tap-tempo measurement. */
const TAP_RESET_MS = 3000;

export default function MusicScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<MusicSettings>(
    DEFAULT_MUSIC_SETTINGS,
  );
  const [taps, setTaps] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const lastTap = useRef(0);

  useEffect(() => {
    loadMusicSettings().then(setSettings);
  }, []);

  const update = useCallback((patch: Partial<MusicSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveMusicSettings(next).catch(() => undefined);
      return next;
    });
  }, []);

  const handleTap = () => {
    const now = Date.now();
    const fresh = now - lastTap.current > TAP_RESET_MS ? [] : taps;
    lastTap.current = now;
    const next = [...fresh, now];
    setTaps(next);
    const bpm = bpmFromTaps(next);
    if (bpm !== null) update({ bpm });
  };

  const handleReset = () => {
    setTaps([]);
    lastTap.current = 0;
    update({ bpm: null, musicMode: false });
  };

  const handleChooseTrack = async () => {
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });
      const asset = result.assets?.[0];
      if (!result.canceled && asset) {
        const imported = await importTrack(asset.uri, asset.name);
        update(imported);
      }
    } catch {
      // Picker unavailable or copy failed: leave settings untouched.
    } finally {
      setBusy(false);
    }
  };

  const canEnableMusicMode = !!settings.trackUri && !!settings.bpm;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Music</Text>
        <Text style={styles.subtitle}>
          In music mode each move runs to the end of an 8-count, and the beat
          grid goes in the session log so the auto-editor can cut on the beat.
        </Text>

        <Text style={styles.sectionLabel}>TRACK</Text>
        <View style={styles.card}>
          <Text style={styles.cardValue}>
            {settings.trackName ?? 'No track selected'}
          </Text>
          <Pressable
            style={styles.secondaryButton}
            onPress={handleChooseTrack}
            disabled={busy}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonText}>
              {busy ? 'Importing…' : 'Choose track'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>TEMPO</Text>
        <View style={styles.card}>
          <Text style={styles.bpm}>
            {settings.bpm !== null ? `${settings.bpm} BPM` : '— BPM'}
          </Text>
          <Text style={styles.hint}>
            Tap along with the track — four taps or more.
          </Text>
          <Text style={styles.hint}>Taps: {taps.length}</Text>
          <View style={styles.row}>
            <Pressable
              style={[styles.secondaryButton, styles.grow]}
              onPress={handleTap}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryButtonText}>Tap tempo</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={handleReset}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryButtonText}>Reset</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.card, styles.rowBetween]}>
          <View style={styles.grow}>
            <Text style={styles.cardValue}>Music mode</Text>
            <Text style={styles.hint}>
              {canEnableMusicMode
                ? 'Move changes snap to 8-counts'
                : 'Needs a track and a tempo'}
            </Text>
          </View>
          <Switch
            value={settings.musicMode}
            onValueChange={(musicMode) => update({ musicMode })}
            disabled={!canEnableMusicMode}
            trackColor={{ true: theme.colors.accent }}
            accessibilityLabel="Music mode"
          />
        </View>

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
  safe: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  container: {
    padding: theme.spacing(5),
    gap: theme.spacing(3),
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
  bpm: {
    color: theme.colors.accent,
    fontSize: theme.font.display,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  hint: {
    color: theme.colors.textMuted,
    fontSize: theme.font.caption,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing(2),
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
  },
  grow: {
    flex: 1,
  },
  secondaryButton: {
    backgroundColor: theme.colors.surfaceRaised,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing(3),
    paddingHorizontal: theme.spacing(4),
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
