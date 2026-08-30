# BUILDLOG

Newest first. One short entry per run — what changed, and anything worth
checking in the next APK.

## 2026-08-30 — nightly run: roadmap complete, no action taken

- CI was green on `main` (run #21, M6 session gallery) and no `FEEDBACK:`
  issues were open.
- Checked ROADMAP.md for the next item per CLAUDE.md rule 3: every item in
  every milestone (M0 through M6) is already checked off. There is no
  unfinished milestone to pull an item from, so this run made no code
  changes rather than inventing scope beyond what's planned.
- Nothing to check in the next APK — no APK was built this run.
- **For the owner:** the roadmap needs a new milestone (M7+) before the
  next nightly run has anything to build. Add items to ROADMAP.md whenever
  convenient.

## 2026-08-29 — M6: session gallery

- CI was green on `main` and no `FEEDBACK:` issues were open, so this run
  took the next M6 item.
- The Sessions tab list is now tappable: each row navigates to
  `/sessions/[id]` (new route, mirrors `moves/[id].tsx`), which shows the
  session's plan name, when/how long it ran, the moves it covered, and — if
  footage was saved — plays it back with `expo-video`'s `VideoView`
  (nativeControls), reusing the `ClipPreview` pattern from move reference
  clips. No footage saved shows a plain "No footage recorded for this
  session." note instead.
- `session-store.ts` gained `getEventLog(sessionId)` (read one full log by
  id, null if missing/unreadable) and `sessionVideoPath(file)` — no schema
  change, both just read what `saveSession` already writes.
- 8 new tests (198 total): `session-store.ts`, a new
  `session-detail-screen.test.tsx`, and a navigation-on-tap test for
  `SessionsScreen`. New Maestro flow `.maestro/session-gallery.yaml` — it
  deliberately doesn't assert on footage-vs-no-footage, since whether a
  session ended moments after starting actually got a usable recording in
  headless CI is exactly the kind of native timing `moves.yaml` already
  learned not to depend on; it only proves the detail screen renders the
  right plan.
- versionCode 9 / v0.8.0.
- **Check in the APK:** Sessions → tap any row → see the plan/moves and,
  for a session you actually filmed, the footage plays back with native
  controls.

## 2026-08-28 — M6: export presets

- CI was green on `main` and no `FEEDBACK:` issues were open, so this run
  took the next M6 item.
- `pipeline/src/presets.ts` (pure): three named bundles of encode settings +
  whether to cut Shorts — `default` (crf 20/medium, shorts on, unchanged
  behaviour), `draft` (crf 28/veryfast, longform only — fast turnaround to
  check the cuts), `upload` (crf 18/slow, shorts on — the final render that
  actually gets posted). `resolvePreset()` throws a helpful error naming the
  known presets on a typo.
- Wired into the CLI as `--preset <name>` (default `default`); `--no-shorts`
  still always wins over whatever the preset picks; `--font` still layers on
  top of any preset. `npm run edit -- --dry-run` output now names the preset
  used.
- Pipeline-only change (no app UI, no event-log schema change): no Maestro
  flow, no versionCode bump. 7 new tests (presets + cli arg parsing), 190
  total.
- **Check in the APK:** nothing to check on-device this run — the change is
  in the desktop `npm run edit` pipeline. Next time you pull footage, try
  `npm run edit -- --log <session.json> --preset draft --dry-run` and
  `--preset upload` to confirm the encode settings differ as expected.

## 2026-08-27 — M6: progress stats — wrist range, squat hold, crow hold, 6-step tempo

- CI was green on `main` and no `FEEDBACK:` issues were open, so this run
  took the next M6 item.
- `src/lib/progress-stats.ts` (pure): turns the existing training log into a
  per-move history for four tracked moves (wrist rocks, deep squat hold, crow
  hold, six-step half speed) — oldest-first list of session/seconds/redos,
  plus best, latest, and delta-since-first. No new event-log fields, no
  schema bump: it's built entirely from `actualWorkSeconds`, already computed
  by `training-log.ts` from data the app has logged since M1.
- Settings → "Progress stats" opens a new screen listing all four moves, each
  showing its best/latest/delta and its five most recent sessions, or "No
  sessions logged yet" until the move has been trained.
- 6 new lib tests + 4 new screen tests (183 total). New Maestro flow
  `.maestro/progress.yaml`. versionCode 8 / v0.7.0.
- **Check in the APK:** Settings → Progress stats shows all four moves (empty
  on a fresh install); after training wrist rocks, squat hold, crow hold, or
  6-step, its card should show a real best/latest number.

## 2026-08-26 — fix: stop asserting on real camera output in CI (same-day follow-up 4)

- The Gradle heap fix and the gradle.properties fix both held this time —
  `build-apk` went green in ~18 minutes, no OOM, no corrupted config. Only
  Maestro's `moves` flow still failed, on the exact same assertion as attempt
  #1: "Retake" never appeared after Stop recording, even with the 1.2s
  minimum-recording-duration floor from follow-up 1 and a 20s wait.
- Four straight failures on the same assertion, with the app-level race
  already fixed, points at the emulator's headless virtual camera not
  reliably handing back a playable file in CI — not something a longer
  timeout or another app tweak was going to fix. `.maestro/moves.yaml` no
  longer waits for the full record → save → retake round trip; it now only
  proves the real wiring (permissions, navigation, CameraView mounting, a
  real `recordAsync()` call starting), the same call CI's `coach.yaml` and
  `music.yaml` already make for their own unreliable-in-CI steps. The
  save/retake logic itself stays covered by `move-detail-screen.test.tsx`
  with a mocked camera.
- No app code changed this round. Watching the next run — this should
  finally close out the M6 push.

## 2026-08-26 — fix: the OOM fix itself broke the build (same-day follow-up 3)

- Third red run in a row on the M6 push. This one was self-inflicted: the
  previous fix appended `org.gradle.jvmargs=...` to `android/gradle.properties`
  with a plain `echo >>`, but that file has no trailing newline — the append
  glued onto the last property's value (`expo.inlineModules.watchedDirectories
  =[]org.gradle.jvmargs=...`), corrupting it and breaking a node subprocess the
  Expo Gradle plugin runs during configuration (`Process 'command 'node''
  finished with non-zero exit value 1`, no further detail).
- Reproduced locally by actually regenerating `android/gradle.properties` with
  `expo prebuild` and checking it byte-for-byte before trusting the next fix,
  rather than reasoning about it in the abstract. Switched to
  `printf '\n%s\n' ... >>`, which guarantees the new property lands on its own
  line regardless of what the file ends with.
- No app code changed; typecheck/lint/test still 173/173 (also caught
  `package-lock.json` still saying version 0.5.0 from the versionCode-7 bump —
  synced by `npm install`). Watching the next run.

## 2026-08-26 — fix: CI red again, this time a Gradle OOM (same-day follow-up 2)

- The re-run after the Maestro fix got past Maestro entirely and died
  earlier: `:app:mergeDexRelease` failed with `OutOfMemoryError: Java heap
  space` in D8. Unrelated to the recording-duration bug — this is
  `expo-video`'s native module pushing the app's dex count past what the
  default Gradle/D8 worker heap handles on the CI runner.
- Fix lives in `.github/workflows/ci.yml`, not the app: `android/` is
  gitignored and regenerated by `expo prebuild` every run, so a new step
  appends `org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m` to the
  freshly-generated `android/gradle.properties` right after prebuild, before
  `gradlew assembleRelease` runs.
- No app code changed this round; re-ran typecheck/lint/test anyway (still
  173/173) and validated the workflow YAML parses. Watching the next run to
  confirm the build, Maestro, and nightly release all go green.

## 2026-08-26 — fix: CI red on the M6 push (same-day follow-up)

- The `moves` Maestro flow failed on GitHub Actions: `[Failed] moves (33s)
  (Assertion is false: "Retake" is visible)`. Everything else (typecheck,
  lint, 173 tests, the Gradle APK build) was green; only the emulator flow
  broke, and only on this new flow — coach/smoke/workout/music all passed
  in the same run.
- Root cause: the flow tapped Start recording then Stop recording back to
  back, and `recordAsync()` never resolved to a file — stopping the camera
  the instant it starts is a native-layer race, not a Maestro timing quirk.
  `move-detail-screen.tsx` now enforces a 1.2s minimum recording duration
  before calling `stopRecording()`, which also happens to be the right call
  for real usage (a near-zero-length reference clip is useless).
- Bumped the Maestro flow's post-stop timeout 15s → 20s to cover the added
  wait. Re-ran typecheck/lint/test locally (still 173/173); watching the
  next CI run to confirm the emulator job goes green.

## 2026-08-26 — M6: move reference clips

- First M6 item: Settings → "Move reference clips" opens a list of every
  exercise, each showing whether you've saved a reference clip for it. Tap a
  move to film one with the front camera; tap it again to play the saved
  clip back with native controls, or hit Retake to redo it.
- Clips are self-filmed on-device only — no bundled footage, no external
  service — stored at `reference-clips/ref-<moveId>.mp4`, separate from
  session footage since they persist across workouts instead of stacking up
  one-per-session (`reference-clips-store.ts`, mirrors `session-store.ts`).
- New dependency: `expo-video`, used only for local playback
  (`useVideoPlayer` + `VideoView` with native controls). `npm run bundle`
  passes, so Metro is fine with it.
- 15 new tests (store + both screens + the Settings row), 173 total. New Maestro flow
  `.maestro/moves.yaml`: record a clip, confirm it's marked Saved after
  navigating away and back, retake it. versionCode 7 / v0.6.0.
- **Check in the APK:** Settings → Move reference clips → pick a move →
  Start recording → Stop recording → the clip should play back with normal
  video controls, and Retake should let you redo it.

## 2026-08-25 — M5: code-computed weekly progression signals

- Until now the coach's progression call was pure LLM judgement — the prompt
  said "progress off the evidence" but nothing checked that it actually did.
  New `src/lib/progression.ts` (pure, 12 tests) computes a deterministic
  increase/hold/regress signal per move from the *most recent* time it was
  logged: incomplete or 2+ redos regresses (~15% of planned work seconds,
  min 5s, rounded to the nearest 5s), exactly one redo or finishing under
  time holds, a clean full-time completion increases.
- Wired into the coach prompt as a new "Computed progression signals" section
  (`coach-prompt.ts`), sitting alongside the full training log. The system
  prompt now tells the model to treat it as a floor it can deviate from, but
  must explain any deviation in `notes` — same "code enforces, prompt
  requests" split as the existing safety rails in `coach-plan.ts`.
- No schema change, no new UI, no versionCode bump — this only changes what
  goes into the request the coach screen already sends.
- 158 tests / 20 suites (12 new). `coach-screen.test.tsx` asserts the
  progression notes are actually passed through to `generateCoachWeek`.
- **Check in the APK:** next time you generate a week in Settings → AI coach,
  read the `notes` — see whether the coach's stated reasoning lines up with
  what the computed signals would have suggested, or explains why it didn't.

## 2026-08-25 — M5: the AI coach actually programs your week

- **Settings → AI coach**: paste your Anthropic key (validated for shape,
  stored in the platform keystore via expo-secure-store, shown masked, never
  written to a file or the event log), pick the program week, generate.
- Claude reads the training log built in the previous run — actual work
  seconds vs. planned, redo counts, completions — plus the 12-week block brief
  and the exercise library, and returns a week of sessions with a short note
  explaining what it changed and why. That note is the "the AI changed my
  program this week" segment, straight off the screen.
- The generated week is saved, and the Train and Workout screens use the
  coach's first session when one exists (the card says "PROGRAMMED BY YOUR
  COACH"), falling back to the built-in templates otherwise.
- **Safety rails are in code, not just the prompt** (`coach-plan.ts`): a move
  id the library doesn't have is dropped and reported rather than run, wrist
  prep is forced to the front of every session (reordered, or prepended if the
  coach forgot), durations are clamped to sane bounds, and a session whose
  moves were all junk is skipped. A response that is entirely unusable throws
  rather than half-running.
- Uses claude-opus-5 with adaptive thinking, high effort, and a JSON schema
  constraining the response shape, called over plain `fetch`. The official
  `@anthropic-ai/sdk` was tried first and removed: it imports `node:fs`, which
  Metro can't resolve, so it broke the release bundle. Added `npm run bundle`
  and a CLAUDE.md rule so the next dependency gets caught locally instead of
  in CI.
- 137 tests / 18 suites (46 new). New `.maestro/coach.yaml` checks the key gate
  without ever making a billed call. versionCode 6, v0.5.0.
- **Check in the APK:** Settings → AI coach → paste your key → Generate. Then
  go to Train and confirm the session card says it came from the coach. Read
  its note and see whether the reasoning actually holds up against what you
  did last week — that judgement is the part I can't test.

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
