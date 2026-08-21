# EVENTLOG.md — session event log schema

The event log is the backbone of Desk to Floor: the app writes it during every
session, and the auto-editor pipeline (M4) consumes it to cut video without any
ML. **Any change to this schema requires a `schemaVersion` bump, a migration
note in this file, and pipeline support for reading the previous version.**

## Current version: 1 (implementation lands in M1)

One JSON file per session, written next to the session's video file (M2+):
`session-<sessionId>.json`.

```jsonc
{
  "schemaVersion": 1,
  "sessionId": "b3f1c9d2-…",            // uuid v4
  "startedAt": "2026-08-21T09:30:00.000+10:00", // absolute wall-clock anchor
  "appVersion": "0.1.0",
  "plan": {                              // the session as generated, for reference
    "name": "Undesk · Week 1 · Day 1",
    "moveIds": ["wrist-rocks", "ninety-ninety", "toprock-indian-step"]
  },
  "recording": null,                     // M2+: { "file": "session-….mp4", "startOffsetMs": 1234 }
  "music": null,                         // M3+: { "track": "…", "bpm": 92, "beatGridStartMs": 0, "phraseBeats": 8 }
  "events": [
    // Every atMs is milliseconds since session start, monotonic clock.
    { "type": "session_start", "atMs": 0 },
    { "type": "move_start",  "atMs": 5000,  "moveId": "wrist-rocks", "name": "Wrist rocks" },
    { "type": "move_end",    "atMs": 45000, "moveId": "wrist-rocks" },
    { "type": "rest_start",  "atMs": 45000, "durationMs": 15000 },
    { "type": "rest_end",    "atMs": 60000 },
    { "type": "redo",        "atMs": 72000, "moveId": "toprock-indian-step" },
    { "type": "pause",       "atMs": 90000 },
    { "type": "resume",      "atMs": 95000 },
    { "type": "session_end", "atMs": 600000 }
  ]
}
```

### Semantics the pipeline relies on

- `atMs` is relative to `session_start` and derived from a monotonic clock —
  never from wall-clock time, which can jump.
- `recording.startOffsetMs` is the session-clock time at which the video file's
  frame 0 was captured. Video time `t` = session time `t + startOffsetMs`… i.e.
  `videoMs = atMs - startOffsetMs` for any event.
- A `redo` marker means: discard footage of the current move from its
  `move_start` up to the marker; the retake continues until `move_end`.
- Events are append-only and strictly ordered by `atMs`.
- Unknown event types must be ignored by consumers (forward compatibility);
  unknown `schemaVersion` must be a hard error.

## Version history

- **v1** (2026-08-21, designed at kickoff; ships with M1): initial schema —
  session envelope, plan, move/rest/redo/pause events, null placeholders for
  `recording` (M2) and `music` (M3). Filling a null placeholder with the shape
  documented above is *not* a version bump; changing event fields or semantics is.
