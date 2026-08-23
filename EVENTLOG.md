# EVENTLOG.md — session event log schema

The event log is the backbone of Desk to Floor: the app writes it during every
session, and the auto-editor pipeline (M4) consumes it to cut video without any
ML. **Any change to this schema requires a `schemaVersion` bump, a migration
note in this file, and pipeline support for reading the previous version.**

## Current version: 1 (implemented in `src/lib/eventlog.ts`)

One JSON file per session, written next to the session's video file (M2+):
`session-<sessionId>.json`.

```jsonc
{
  "schemaVersion": 1,
  "sessionId": "20260821T093000-4f2a9c", // sortable timestamp + random suffix
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
  *Precision caveat (M2):* the app records the session-clock time at which it
  *asked* the camera to start; true frame 0 lags by camera-start latency
  (~100–300 ms). The auto-editor must pad cuts with handles (≥0.5 s) rather
  than cutting frame-exact on event boundaries.
- Footage is stored next to the log as `session-<sessionId>.mp4`; the redo
  button in the player writes `redo` markers during work intervals.
- A `redo` marker means: discard footage of the current move from its
  `move_start` up to the marker; the retake continues until `move_end`.
- Events are append-only and strictly ordered by `atMs`.
- Unknown event types must be ignored by consumers (forward compatibility);
  unknown `schemaVersion` must be a hard error.

#### The beat grid (`music`, M3)

`music` is non-null only when the session ran in music mode. There are no
per-beat events: the grid is arithmetic, and every beat is derivable from the
three fields.

- Beat `n` falls at `beatGridStartMs + n * (60000 / bpm)`; a phrase is
  `phraseBeats` beats (8 for breaking). Move changes were snapped to phrase
  boundaries at record time, so `move_start` times already land on the "1" —
  the editor should still quantize its own cuts rather than trusting them
  frame-exactly.
- `beatGridStartMs` is the anchor **as of session start**. Pausing pauses the
  music, so on every `resume` the audible grid slides forward by exactly
  `resume.atMs - pause.atMs`. Consumers must apply that shift cumulatively:
  after the *k*th resume, the effective anchor is
  `beatGridStartMs + Σ(resume.atMs − pause.atMs)`. Both events are in the log,
  so the shift is fully reconstructible.
- Playback does not loop (DECISIONS.md): if the track ends mid-session the
  music stops, but the grid stays valid — it is extrapolated, not measured.
- Tempo comes from tap-tempo, so treat `bpm` as accurate to ~±1 BPM. Over a
  long session that drifts; quantize cuts to the *nearest* beat rather than
  accumulating beat counts from the anchor.

## Version history

- **v1** (2026-08-21, designed at kickoff; shipped with M1 the same day —
  session ids amended pre-ship from uuid to sortable timestamp+suffix): initial schema —
  session envelope, plan, move/rest/redo/pause events, null placeholders for
  `recording` (M2) and `music` (M3). Filling a null placeholder with the shape
  documented above is *not* a version bump; changing event fields or semantics is.
  - *Amended 2026-08-21 (M2):* `recording` placeholder filled — shape unchanged
    from the kickoff spec, plus the camera-latency caveat above.
  - *Amended 2026-08-21 (M3):* `music` placeholder filled — shape unchanged from
    the kickoff spec, plus the beat-grid semantics above. **Still v1:** no event
    type, field, or existing semantic changed, and no consumer has shipped
    (the pipeline lands in M4). Music-mode timing shows up only as different
    `atMs` values, which v1 already allows.
