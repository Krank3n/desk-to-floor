# CLAUDE.md — standing orders for every autonomous run

Desk to Floor: an Android training app that films breaking practice sessions
and an ffmpeg pipeline that edits the footage automatically. The owner's role
is to sideload the nightly APK and train. Yours is everything else.

## The rules (in priority order)

1. **First duty: make CI green.** If the latest run on `main` is red, fixing it
   IS this run's roadmap item. Do nothing else until it passes.
2. **Check open GitHub issues before the roadmap.** Any issue titled
   `FEEDBACK: ...` outranks every roadmap item. Address it, comment on the
   issue with what you did, and close it if resolved.
3. **Then implement exactly ONE roadmap item** from the first unfinished
   milestone in ROADMAP.md — with unit tests, and a Maestro flow in
   `.maestro/` if the item has UI. One item, done well, per run.
4. **Close the loop:** tick the item in ROADMAP.md, append a short
   human-readable entry to BUILDLOG.md (date, what changed, anything the owner
   should look at in the next APK), and push to `main`.
5. **Never commit secrets, media files, or generated video.** `.gitignore`
   already covers `media/` and `output/`; keep it that way.
6. **Event-log schema changes require a version bump** and a migration note in
   EVENTLOG.md. The schema is the contract between the app and the pipeline —
   breaking it silently breaks the auto-editor.
7. **Record non-obvious choices in DECISIONS.md** (one line each). Never
   re-litigate a decision recorded there; supersede it with a new entry if it
   must change.

## Commands

- `npm run typecheck` · `npm run lint` · `npm test` — run all three before pushing.
  These cover the pipeline too: it is part of the root npm project, not a
  separate package (one lockfile, one toolchain — see DECISIONS.md).
- `npm run android` — local dev (owner's machine only; CI builds via prebuild + Gradle).
- `npm run edit -- --log <session.json> --out output/` — run the auto-editor.
  Needs ffmpeg on PATH; `--dry-run` prints the commands. See `pipeline/README.md`.

## Map

- `src/app/` — expo-router routes (thin re-exports; keep screens out of here).
- `src/screens/` — screen components (testable without the router).
- `src/lib/` — pure TypeScript domain logic (exercise library, session
  generator, event log). Put as much here as possible: it is the cheapest
  code to test and review.
- `src/constants/theme.ts` — design tokens. Dark-only by decision.
- `pipeline/` — the auto-editor. `edl.ts` (rules) and `ffmpeg.ts` (arg builders)
  are pure and heavily tested; `run.ts` is the only part that shells out.
  It imports `src/lib` directly — never copy the schema or exercise library.
- `.maestro/` — E2E flows. Keep them short; the emulator job is CI's flakiest link.
- `.github/workflows/ci.yml` — checks → APK build → Maestro → nightly release.

## Gotchas

- The Maestro emulator job is the most fragile CI stage. Prefer making flows
  more robust (extendedWaitUntil, stable visible text) over retry loops.
- Release APKs are debug-signed (Expo prebuild default) — fine for sideloading,
  never for the Play Store. Do not add signing secrets to CI.
- The app must keep working fully offline. No external services in v1.
- Bump `android.versionCode` in app.json whenever the user-visible app changes,
  so sideloaded upgrades install cleanly.
- **Adding a dependency? Run `npm run bundle` before pushing.** typecheck, lint
  and tests all run in Node, where Node built-ins resolve fine — Metro is the
  only thing that catches a package importing `node:fs`. `expo prebuild`
  doesn't bundle JS either, so the failure lands in CI's Gradle stage
  (`createBundleReleaseJsAndAssets`) minutes later. This has bitten once
  already (the Anthropic SDK, M5).
- `expo prebuild` rewrites `tsconfig.json` as a side effect (it reformats and
  drops the `.expo/types` / `expo-env.d.ts` includes). If you run prebuild
  locally, check `git diff tsconfig.json` and revert that noise before
  committing.
- Mutating an object returned from a hook (e.g. `player.loop = true` from
  `useAudioPlayer`) fails `react-hooks/immutability` lint. Pass the setting
  through hook options or design around it.
