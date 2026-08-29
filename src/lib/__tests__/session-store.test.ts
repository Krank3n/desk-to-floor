import * as FileSystem from 'expo-file-system/legacy';

import { buildEventLog, SessionEvent } from '@/lib/eventlog';
import {
  getEventLog,
  listSessionSummaries,
  saveSession,
  sessionVideoPath,
} from '@/lib/session-store';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///doc/',
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  readDirectoryAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  moveAsync: jest.fn().mockResolvedValue(undefined),
}));

const fs = FileSystem as jest.Mocked<typeof FileSystem>;

const events: SessionEvent[] = [
  { type: 'session_start', atMs: 0 },
  { type: 'move_start', atMs: 0, moveId: 'wrist-rocks', name: 'Wrist rocks' },
  { type: 'move_end', atMs: 40000, moveId: 'wrist-rocks' },
  { type: 'session_end', atMs: 40000 },
];

const log = buildEventLog({
  sessionId: 'abc123',
  startedAt: '2026-08-21T09:30:00.000+10:00',
  appVersion: '0.3.0',
  plan: { name: 'Undesk · Week 1', moveIds: ['wrist-rocks'] },
  events,
});

function lastWrittenLog() {
  const calls = (fs.writeAsStringAsync as jest.Mock).mock.calls;
  return JSON.parse(calls[calls.length - 1][1]);
}

beforeEach(() => {
  jest.clearAllMocks();
  fs.moveAsync.mockResolvedValue(undefined);
});

describe('saveSession', () => {
  it('writes the log with recording null when there is no video', async () => {
    const path = await saveSession(log, null);
    expect(path).toBe('file:///doc/sessions/session-abc123.json');
    expect(fs.moveAsync).not.toHaveBeenCalled();
    expect(lastWrittenLog().recording).toBeNull();
  });

  it('moves footage next to the log and fills recording info', async () => {
    await saveSession(log, { uri: 'file:///cache/tmp.mp4', startOffsetMs: 120 });
    expect(fs.moveAsync).toHaveBeenCalledWith({
      from: 'file:///cache/tmp.mp4',
      to: 'file:///doc/sessions/session-abc123.mp4',
    });
    expect(lastWrittenLog().recording).toEqual({
      file: 'session-abc123.mp4',
      startOffsetMs: 120,
    });
  });

  it('still saves the log (recording null) if the video move fails', async () => {
    fs.moveAsync.mockRejectedValueOnce(new Error('disk full'));
    await saveSession(log, { uri: 'file:///cache/tmp.mp4', startOffsetMs: 0 });
    expect(lastWrittenLog().recording).toBeNull();
  });
});

describe('listSessionSummaries', () => {
  it('summarizes .json files and ignores everything else', async () => {
    fs.readDirectoryAsync.mockResolvedValueOnce([
      'session-abc123.json',
      'session-abc123.mp4',
    ]);
    fs.readAsStringAsync.mockResolvedValueOnce(JSON.stringify(log));
    const summaries = await listSessionSummaries();
    expect(summaries).toHaveLength(1);
    expect(summaries[0].sessionId).toBe('abc123');
    expect(summaries[0].hasVideo).toBe(false);
  });

  it('returns empty when the directory does not exist yet', async () => {
    fs.readDirectoryAsync.mockRejectedValueOnce(new Error('ENOENT'));
    await expect(listSessionSummaries()).resolves.toEqual([]);
  });
});

describe('getEventLog', () => {
  it('reads and parses a session by id', async () => {
    fs.readAsStringAsync.mockResolvedValueOnce(JSON.stringify(log));
    const result = await getEventLog('abc123');
    expect(fs.readAsStringAsync).toHaveBeenCalledWith(
      'file:///doc/sessions/session-abc123.json',
    );
    expect(result?.sessionId).toBe('abc123');
  });

  it('returns null when the session is missing or unreadable', async () => {
    fs.readAsStringAsync.mockRejectedValueOnce(new Error('ENOENT'));
    await expect(getEventLog('nope')).resolves.toBeNull();
  });
});

describe('sessionVideoPath', () => {
  it('joins the sessions dir with the recording filename', () => {
    expect(sessionVideoPath('session-abc123.mp4')).toBe(
      'file:///doc/sessions/session-abc123.mp4',
    );
  });
});
