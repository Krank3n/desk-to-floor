# BUILDLOG

Newest first. One short entry per run — what changed, and anything worth
checking in the next APK.

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
