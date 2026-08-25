# BUILDLOG

Newest first. One short entry per run — what changed, and anything worth
checking in the next APK.

## 2026-08-25 — M5 groundwork: training-log summary format

- `src/lib/training-log.ts` (pure): turns an event log into a coach-readable
  summary — per move, actual work seconds vs. planned (redo takes discarded,
  paused time subtracted), redo count, and whether the move was completed
  before the session ended. `formatTrainingLog` renders one or more sessions,
  oldest first, as plain text meant to be dropped straight into the coach
  prompt the next M5 item will build.
- No UI, no schema change, no versionCode bump — this is data plumbing for
  the Claude API step that comes next in M5, not a user-facing feature yet.
- 7 new tests / 14 suites, 97 total.
- **Nothing to check in the APK this time.**

## 2026-08-23 — Device testing on the iOS simulator; done-screen copy fix

- Ran the current build on the DTF-Dev simulator (Expo Go, Metro :8083) and
  drove a full session: plan screen, timer, cues, controls, session saved,
  Music screen, tap-tempo (95.4 BPM off five taps, persisted).
- Pulled the app-written event log off the simulator and ran it through the
  auto-editor end to end: 2 segments, rest correctly dropped, 43.45 s output.
  The simulator has no camera, so the log was paired with a stand-in clip —
  the *cutting* is verified against real app output, the camera path is not.
- **Fixed:** the done screen said "Footage and event log saved" even when
  nothing was filmed (recording off, or no camera). It now says so plainly.
  The saved data was always correct — `recording: null` — only the copy lied.
- Confirmed the app degrades correctly with no camera: session runs, log saves.
- versionCode 5, v0.4.1. 90 tests / 12 suites.
- **Check in the APK:** nothing new to look at unless you turn recording off —
  the finish screen should no longer promise footage it does not have.

## 2026-08-23 — M4: the auto-editor (session 5)

- `pipeline/` turns footage + event log into edited video with ffmpeg. No ML:
  the log already says when everything happened, so the edit is arithmetic.
- `edl.ts` (pure) decides what to keep: work intervals in, rests out, redo
  markers discard the botched take, paused stretches split the move around the
  dead air, sub-1s fragments dropped. Music mode rounds cuts *inward* to the
  beat (start up, end down) applying the documented pause shift; non-music mode
  pads 250 ms handles clamped so segments never overlap.
- `ffmpeg.ts` (pure) builds the filter graphs: one pass that trims, concats and
  burns move-name titles on the output timeline. Shorts are 9:16 centre crops
  of breaking moves only (toprock / footwork / freeze), capped at 60 s.
- Verified end to end against real ffmpeg with a synthetic session: output
  durations matched the plan to the frame, Shorts came out 1080×1920, titles
  burned correctly.
- 89 tests / 12 suites (24 new for the pipeline). The app is unchanged, so
  **no versionCode bump** — the nightly APK stays v0.4.0.
- **Nothing to check in the APK this time.** To try the editor on a real
  session: pull a session off your phone and run
  `npm run edit -- --log <session.json> --out output/` (needs `brew install ffmpeg`).

## 2026-08-21 — M3: music + music mode (same-day, session 4)

- New **Music** screen (Settings → Music & beat grid): pick a local track with
  the system file picker, set tempo by tapping along (4+ taps, outlier-tolerant
  median), toggle music mode. Settings persist in `music.json`; the picked
  track is copied into app storage so it survives cache eviction.
- **Music mode**: work/rest intervals stretch to the next 8-count boundary —
  never cut short — so move changes land on the "1". The player's phase ends
  moved from tick-counting to session-time arithmetic to make this exact.
- Pausing pauses the track and re-anchors the grid by the paused duration;
  EVENTLOG.md documents how the editor reconstructs that shift from the
  pause/resume events.
- The beat grid is written to the event log (`music` object). **No schema
  bump** — EVENTLOG.md pre-authorised filling that placeholder, and no event
  field or semantic changed; the reasoning is recorded in its version history.
- Playback deliberately does not loop: a restart would break phrase alignment.
- 65 tests / 10 suites, new `.maestro/music.yaml` flow. versionCode 4, v0.4.0.
- **Check in the APK:** Settings → Music & beat grid → tap out a tempo against
  a track you picked, switch music mode on, then run a session and see whether
  the move changes actually feel like they land on the 8.

## 2026-08-21 — M2: recording studio (same-day, session 3)

- Front-camera recording (expo-camera) runs while the workout runs: preview
  behind the player UI with a dark scrim, REC badge, all overlay text UI-only —
  nothing burned into the raw file.
- "Record video" toggle on the pre-session screen (default on) with permission
  handling; sessions run fine without recording if denied.
- Redo button during work intervals → `redo` markers in the event log
  (`markRedo` in the player state machine).
- Footage saved next to the log as `session-<id>.mp4` via `saveSession`;
  `recording.startOffsetMs` filled (precision caveat documented in EVENTLOG.md
  — editors pad cuts with handles). Log still saved if the video move fails.
- Screen stays awake during sessions (expo-keep-awake).
- CI grants CAMERA/RECORD_AUDIO via adb before Maestro; workout flow asserts
  the REC badge. 38 tests / 7 suites. versionCode 3, v0.3.0.
- Also this session: repo made public (owner's call) to unblock Actions
  billing; issue #1 closed.
- **Check in the APK:** camera preview appears behind the timer, REC shows
  while filming, and a finished session's row in Sessions says "· video";
  the .mp4 plays and roughly matches the log timestamps.

## 2026-08-21 — M1: workout engine (same-day follow-up)

- `src/lib/`: exercise library (14 moves incl. wrist prep, 90/90, toprock,
  6-step, crow, baby-freeze prep), deterministic session generator keyed to the
  12-week program phases, event log v1 (build/serialize/parse/summarize), and
  the workout player as a pure state machine (tick/pause/resume/skip/end,
  3-2-1 countdown cues, monotonic session clock that keeps rolling through
  pauses so M2 video stays aligned).
- Workout player screen with big timer, current/next move, TTS cues
  (expo-speech), End→saves the event log to app storage
  (expo-file-system legacy API); Sessions tab lists saved sessions.
- 31 unit tests across 6 suites; new Maestro flow `workout.yaml` runs a
  start→pause→end→appears-in-Sessions pass. versionCode 2, v0.2.0.
- **CI caveat:** all checks green locally, but GitHub Actions refuses to start
  jobs — account-level billing ("payments failed or spending limit").
  M0/M1 CI items are ticked on local evidence; first green run pending the
  billing fix (see the FEEDBACK issue).
- **Check in the APK:** Train → Start session → Begin; voice cues; pause,
  skip, end; the finished session shows in Sessions.

## 2026-08-21 — Kickoff (M0)

- Scaffolded Expo SDK 57 + TypeScript + expo-router, stripped to a lean
  Android-only dependency set.
- Tab shell: Train / Sessions / Settings, dark theme tokens in
  `src/constants/theme.ts`.
- Jest + RN Testing Library screen tests, ESLint (expo flat config), typecheck.
- CI pipeline: checks → release APK (prebuild + Gradle) → Maestro smoke on an
  API 34 emulator → rolling `nightly` GitHub release.
- Wrote the repo's brain: CLAUDE.md (standing rules), ROADMAP.md (M0–M6),
  DECISIONS.md, EVENTLOG.md (schema v1 spec, ships in M1).
- **Check in the APK:** app boots to the Train tab, three tabs navigate, dark
  theme everywhere.
