# DECISIONS.md

One line per decision. Never re-litigate; supersede with a new dated entry.

- **2026-08-21** Expo SDK 57 / RN 0.86 / React 19.2, managed workflow + `expo prebuild` in CI. Latest stable at kickoff; template pins kept.
- **2026-08-21** Android-only v1. No iOS build, no react-native-web — smaller dependency surface, faster CI.
- **2026-08-21** Dark-only UI in v1 (`userInterfaceStyle: "dark"`). The app is a filming rig used mid-workout; one theme, no switching logic.
- **2026-08-21** Android package `com.hansendev.desktofloor`; app slug `desk-to-floor`.
- **2026-08-21** Screens live in `src/screens/`, routes in `src/app/` are one-line re-exports — screens stay testable without router context.
- **2026-08-21** Domain logic goes in `src/lib/` as pure TypeScript, UI-free, so unit tests carry most of the confidence and CI stays fast.
- **2026-08-21** Release APKs are debug-signed (Expo prebuild default). Fine for sideloading; no signing secrets in CI. Revisit only if Play Store ever matters.
- **2026-08-21** CI order per plan: checks → APK build → Maestro smoke → nightly release. A build that fails the smoke test is never published.
- **2026-08-21** Rolling GitHub release tagged `nightly`, asset `desk-to-floor-nightly.apk`, `--clobber` on every green main push.
- **2026-08-21** Emulator job: API 34 x86_64, pixel_6 profile, KVM on ubuntu-latest, no AVD snapshot caching yet (add only if boot time hurts).
- **2026-08-21** Template's React Compiler experiment and typed-routes disabled — fewer moving parts in Jest and CI typecheck.
- **2026-08-21** Event-log timestamps are milliseconds relative to session start (monotonic), with one absolute `startedAt` anchor — see EVENTLOG.md.
- **2026-08-21** `versionCode` bumped manually in app.json when user-visible changes ship, so sideloaded upgrades install cleanly.
- **2026-08-21** Session ids are sortable timestamp+random (`20260821T093000-4f2a9c`), not uuid — human-skimmable filenames beat RFC purity here.
- **2026-08-21** Pausing freezes the phase timer but the session clock keeps rolling; pauses are events. Keeps the log aligned with continuously-rolling video (M2) — the pipeline cuts paused spans.
- **2026-08-21** The End button ends immediately, no confirm dialog — fewest taps mid-floor; the log is saved either way, and a wrong tap costs nothing.
- **2026-08-21** Session storage uses the `expo-file-system/legacy` API — stable, documented surface; migrate to the object API only if legacy is removed.
- **2026-08-21** Player logic is a pure state machine (`src/lib/player.ts`); the screen owns only a setInterval and TTS side effects. Real elapsed time, not tick counts.
- **2026-08-21** Nightly cloud routine `trig_019k2i2bLjLAb2vp2GB19Bjs`: cron `0 16 * * *` UTC (2am AEST, drifts to 3am during AEDT — accepted), model claude-sonnet-5, no MCP connectors. Manage at https://claude.ai/code/routines.
- **2026-08-21** Nightly routine has a standing billing guard: if Actions jobs fail to start with the account-billing error, it comments once on the FEEDBACK billing issue and stops instead of retrying.
- **2026-08-21** Repo made PUBLIC (owner's call, supersedes the kickoff's private default) — Actions minutes are free on public repos, which unblocks CI and the nightly APK loop at zero cost. Consequence: code and roadmap are visible; never commit anything sensitive (already rule 5 in CLAUDE.md).
