import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import {
  DEFAULT_MUSIC_SETTINGS,
  loadMusicSettings,
  MusicSettings,
} from '@/lib/music-settings';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function describeMusic(settings: MusicSettings): string {
  if (!settings.bpm) return 'Not set up';
  return `${settings.bpm} BPM · ${settings.musicMode ? 'on' : 'off'}`;
}

export default function SettingsScreen() {
  const router = useRouter();
  const version = Constants.expoConfig?.version ?? 'unknown';
  const [music, setMusic] = useState<MusicSettings>(DEFAULT_MUSIC_SETTINGS);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadMusicSettings().then((loaded) => {
        if (active) setMusic(loaded);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.group}>
          <Pressable
            style={styles.row}
            onPress={() => router.push('/music')}
            accessibilityRole="button"
          >
            <Text style={styles.rowLabel}>Music &amp; beat grid</Text>
            <Text style={styles.rowValue}>{describeMusic(music)} ›</Text>
          </Pressable>
          <Row label="Version" value={version} />
          <Row label="Channel" value="nightly" />
          <Row label="Event log schema" value="v1" />
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
    gap: theme.spacing(4),
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.font.title,
    fontWeight: '700',
  },
  group: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing(4),
    paddingVertical: theme.spacing(3.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  rowLabel: {
    color: theme.colors.text,
    fontSize: theme.font.body,
  },
  rowValue: {
    color: theme.colors.textMuted,
    fontSize: theme.font.body,
  },
});
