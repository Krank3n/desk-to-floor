import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';
import { Exercise, getExercise } from '@/lib/exercises';
import {
  deleteReferenceClip,
  hasReferenceClip,
  referenceClipPath,
  saveReferenceClip,
} from '@/lib/reference-clips-store';

type Mode = 'loading' | 'record' | 'preview';

/** Its own component so useVideoPlayer gets a fresh instance on retake (`key`). */
function ClipPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return (
    <VideoView
      style={styles.video}
      player={player}
      nativeControls
      contentFit="contain"
      testID="clip-preview"
    />
  );
}

export default function MoveDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const exercise = useMemo<Exercise | null>(() => {
    try {
      return getExercise(id);
    } catch {
      return null;
    }
  }, [id]);
  const [mode, setMode] = useState<Mode>('loading');
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    if (!exercise) return;
    let active = true;
    hasReferenceClip(id).then((has) => {
      if (active) setMode(has ? 'preview' : 'record');
    });
    return () => {
      active = false;
    };
  }, [id, exercise]);

  const [camPermission, requestCamPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const cameraRef = useRef<CameraView>(null);
  const recordingResult = useRef<Promise<string | null> | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const permissionsGranted =
    (camPermission?.granted ?? false) && (micPermission?.granted ?? false);

  useEffect(() => {
    if (mode !== 'record' || permissionsGranted) return;
    requestCamPermission().then((cam) => {
      if (cam.granted) requestMicPermission();
    });
  }, [mode, permissionsGranted, requestCamPermission, requestMicPermission]);

  useEffect(() => () => cameraRef.current?.stopRecording(), []);

  const handleStartRecording = () => {
    if (!cameraRef.current) return;
    try {
      recordingResult.current = cameraRef.current
        .recordAsync()
        .then((video) => video?.uri ?? null)
        .catch(() => null);
      setIsRecording(true);
    } catch {
      recordingResult.current = null;
    }
  };

  const handleStopRecording = async () => {
    cameraRef.current?.stopRecording();
    const uri = recordingResult.current ? await recordingResult.current : null;
    setIsRecording(false);
    if (!uri) return;
    await saveReferenceClip(id, uri);
    setRefreshToken((t) => t + 1);
    setMode('preview');
  };

  const handleRetake = async () => {
    await deleteReferenceClip(id);
    setMode('record');
  };

  if (mode === 'loading' || !exercise) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.title}>
            {exercise ? exercise.name : 'Move not found'}
          </Text>
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

  if (mode === 'preview') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.kicker}>REFERENCE CLIP</Text>
          <Text style={styles.title}>{exercise.name}</Text>
          <ClipPreview key={refreshToken} uri={referenceClipPath(id)} />
          <View style={styles.spacer} />
          <Pressable
            style={styles.secondaryButton}
            onPress={handleRetake}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonText}>Retake</Text>
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

  const cameraActive = permissionsGranted;

  return (
    <View style={styles.root}>
      {cameraActive ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="front"
          mode="video"
          testID="camera-view"
        />
      ) : null}
      <SafeAreaView style={[styles.safe, cameraActive && styles.scrim]}>
        <View style={styles.container}>
          <Text style={styles.kicker}>NEW REFERENCE CLIP</Text>
          <Text style={styles.title}>{exercise.name}</Text>
          <Text style={styles.subtitle}>{exercise.cue}</Text>
          {!permissionsGranted ? (
            <Text style={styles.permissionNote}>
              Camera or microphone permission needed to record a clip.
            </Text>
          ) : null}
          <View style={styles.spacer} />
          <Pressable
            style={styles.primaryButton}
            onPress={isRecording ? handleStopRecording : handleStartRecording}
            disabled={!cameraActive}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>
              {isRecording ? 'Stop recording' : 'Start recording'}
            </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scrim: { backgroundColor: 'rgba(11, 15, 20, 0.55)' },
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
  permissionNote: {
    color: theme.colors.danger,
    fontSize: theme.font.caption,
    lineHeight: 18,
  },
  video: {
    flex: 1,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
  },
  spacer: { flex: 1 },
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
