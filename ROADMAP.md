# Roadmap

One item per autonomous run, in order, per CLAUDE.md. Tick an item only when
its tests pass and CI is green on `main`.

## M0 — Foundation

- [x] Expo scaffold (SDK 57, TypeScript, expo-router), lean dependency set
- [x] Tab nav shell: Train / Sessions / Settings, dark theme tokens
- [x] Jest + RN Testing Library unit tests; ESLint; typecheck
- [x] CI: typecheck, lint, unit tests on every push
- [x] CI: release APK via expo prebuild + Gradle, uploaded as artifact
- [x] CI: Maestro smoke test on Android emulator (KVM)
- [x] CI: rolling `nightly` GitHub release with sideloadable APK

## M1 — Workout engine

- [x] Exercise library in `src/lib/exercises.ts`: wrist prep, 90/90 hips,
      T-spine rotation, deep squat, cossack squat, hollow body, push-up, row,
      toprock (Indian step), 6-step, crow progression, baby-freeze progression —
      each with id, name, category, default work/rest seconds, cue text
- [x] Session generator in `src/lib/session.ts`: builds an ordered session
      (warm-up wrists first → mobility → strength/skill → cooldown) from the
      library, deterministic given a seed/config
- [x] Event log v1 in `src/lib/eventlog.ts` per EVENTLOG.md: typed events,
      in-memory recorder, JSON serialisation
- [x] Workout player screen: work/rest timer, current move, next-move preview,
      pause/skip, wired to the session clock and event recorder
- [x] TTS cues via expo-speech: move name at start, 3-2-1 countdown, rest cues
- [x] Session log written to app storage on finish; Sessions tab lists past sessions
- [x] Maestro flow: start a session, see the timer and move name, finish

## M2 — Recording studio

- [x] expo-camera front-camera recording while the workout runs
- [x] Recording-start offset captured in the event log
- [x] Overlay UI: big move name + countdown (UI-only, never burned into raw footage)
- [x] One-tap redo marker → event log
- [x] Footage + event log saved together per session
- [x] Maestro flow updated (camera permission granted via adb in CI)

## M3 — Music + music mode

- [ ] Local track playback during workouts
- [ ] BPM entry with tap-tempo
- [ ] Music mode: move changes snapped to 8-count phrases at track BPM
- [ ] Beat grid written to the event log (schema bump per EVENTLOG.md)

## M4 — Auto-editor (`pipeline/`, Node + TypeScript + system ffmpeg)

- [ ] Ingest raw video + event log; validate schema version
- [ ] Trim dead time and redone takes
- [ ] Cut per move; burn move-name titles (drawtext)
- [ ] Beat-synced cuts when a beat grid is present
- [ ] Export 16:9 long-form assembly
- [ ] Export 9:16 Shorts crops of highlight moves

## M5 — AI programming

- [ ] Training-log summary format the coach can consume
- [ ] Claude API weekly workout generation from training log + 12-week program
- [ ] Weekly progression: adjust volume/progressions from logged sessions
- [ ] Key-handling: API key entered on device, stored securely, never committed

## M6 — Polish

- [ ] Move reference clips
- [ ] Progress stats (wrist range, squat hold, crow hold, 6-step tempo)
- [ ] Export presets
- [ ] Session gallery
