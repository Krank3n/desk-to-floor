import * as FileSystem from 'expo-file-system/legacy';

import {
  EventLog,
  parseEventLog,
  serializeEventLog,
  SessionSummary,
  summarizeEventLog,
} from './eventlog';

/**
 * Session artifacts on disk, one pair per session:
 *   <documentDirectory>/sessions/session-<id>.json   — the event log
 *   <documentDirectory>/sessions/session-<id>.mp4    — the raw footage (M2)
 * The only module that touches the filesystem — screens mock this in tests.
 */
const sessionsDir = () => `${FileSystem.documentDirectory ?? ''}sessions/`;

export interface SessionVideo {
  /** Temp uri returned by the camera (cache dir). */
  uri: string;
  /** Session-clock ms at which recording was started. */
  startOffsetMs: number;
}

/**
 * Persist a finished session: move the footage (if any) next to the log and
 * write the log with its recording info filled in. If the video move fails,
 * the log is still saved — with recording null — so a session is never lost.
 */
export async function saveSession(
  log: EventLog,
  video: SessionVideo | null,
): Promise<string> {
  const dir = sessionsDir();
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(
    () => undefined,
  );
  let finalLog = log;
  if (video) {
    const file = `session-${log.sessionId}.mp4`;
    try {
      await FileSystem.moveAsync({ from: video.uri, to: dir + file });
      finalLog = {
        ...log,
        recording: { file, startOffsetMs: video.startOffsetMs },
      };
    } catch {
      // Footage lost or unmovable; keep the log, recording stays null.
    }
  }
  const path = `${dir}session-${log.sessionId}.json`;
  await FileSystem.writeAsStringAsync(path, serializeEventLog(finalLog));
  return path;
}

export async function listSessionSummaries(): Promise<SessionSummary[]> {
  const dir = sessionsDir();
  const names = await FileSystem.readDirectoryAsync(dir).catch(
    () => [] as string[],
  );
  const summaries: SessionSummary[] = [];
  for (const name of names) {
    if (!name.endsWith('.json')) continue;
    try {
      const json = await FileSystem.readAsStringAsync(dir + name);
      summaries.push(summarizeEventLog(parseEventLog(json)));
    } catch {
      // Unreadable or future-schema file: skip rather than crash the list.
    }
  }
  return summaries.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}
