# BUILDLOG

Newest first. One short entry per run — what changed, and anything worth
checking in the next APK.

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
