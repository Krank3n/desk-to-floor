import * as FileSystem from 'expo-file-system/legacy';

import {
  EventLog,
  parseEventLog,
  serializeEventLog,
  SessionSummary,
  summarizeEventLog,
} from './eventlog';

/**
 * Session logs on disk: <documentDirectory>/sessions/session-<id>.json.
 * The only module that touches the filesystem — screens mock this in tests.
 * In M2 the recording video lands in the same directory with the same id.
 */
const sessionsDir = () => `${FileSystem.documentDirectory ?? ''}sessions/`;

export async function saveEventLog(log: EventLog): Promise<string> {
  const dir = sessionsDir();
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(
    () => undefined,
  );
  const path = `${dir}session-${log.sessionId}.json`;
  await FileSystem.writeAsStringAsync(path, serializeEventLog(log));
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
