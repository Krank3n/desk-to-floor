import * as FileSystem from 'expo-file-system/legacy';

/**
 * Move reference clips: one short self-filmed video per exercise the owner
 * can compare technique against, stored at
 *   <documentDirectory>/reference-clips/ref-<moveId>.mp4
 * separate from session footage (session-store.ts) since these persist across
 * sessions instead of being one-per-workout. The only module that touches the
 * filesystem — screens mock this in tests.
 */
const clipsDir = () => `${FileSystem.documentDirectory ?? ''}reference-clips/`;

const clipFile = (moveId: string) => `ref-${moveId}.mp4`;

export function referenceClipPath(moveId: string): string {
  return `${clipsDir()}${clipFile(moveId)}`;
}

/** Save (or overwrite) the reference clip for a move from a temp camera uri. */
export async function saveReferenceClip(
  moveId: string,
  uri: string,
): Promise<void> {
  const dir = clipsDir();
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(
    () => undefined,
  );
  const dest = dir + clipFile(moveId);
  await FileSystem.deleteAsync(dest, { idempotent: true });
  await FileSystem.moveAsync({ from: uri, to: dest });
}

export async function deleteReferenceClip(moveId: string): Promise<void> {
  await FileSystem.deleteAsync(clipsDir() + clipFile(moveId), {
    idempotent: true,
  });
}

export async function hasReferenceClip(moveId: string): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(clipsDir() + clipFile(moveId));
  return info.exists;
}

/** Move ids that currently have a saved reference clip. */
export async function listReferenceClipIds(): Promise<Set<string>> {
  const names = await FileSystem.readDirectoryAsync(clipsDir()).catch(
    () => [] as string[],
  );
  const ids = new Set<string>();
  for (const name of names) {
    const match = /^ref-(.+)\.mp4$/.exec(name);
    if (match) ids.add(match[1]);
  }
  return ids;
}
