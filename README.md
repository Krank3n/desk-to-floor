# Desk to Floor

An Android training app + video production rig for documenting the journey
from a desk-wrecked body to breaking. The app runs the workout, films it, and
writes a timestamped event log; a Node + ffmpeg pipeline turns raw footage into
edited long-form and Shorts cuts — no on-device editing, no ML.

**Get the app:** download `desk-to-floor-nightly.apk` from the
[nightly release](../../releases/tag/nightly) on your phone and open it.

## Layout

| Path | What |
| --- | --- |
| `src/app/` | expo-router routes (thin re-exports) |
| `src/screens/` | screen components |
| `src/lib/` | pure TS domain logic: exercises, sessions, event log |
| `pipeline/` | auto-editor: `npm run edit -- --log <session.json>` |
| `.maestro/` | E2E smoke flows |

## The brain

- `CLAUDE.md` — standing rules for the autonomous nightly build loop
- `ROADMAP.md` — milestones M0–M6, one item per run
- `BUILDLOG.md` — what changed, run by run
- `DECISIONS.md` — defaults chosen, never re-litigated
- `EVENTLOG.md` — the session log schema (the app↔pipeline contract)

## Dev

```sh
npm install
npm run typecheck && npm run lint && npm test
npm run android   # local dev build
```

CI builds the installable APK on every push to `main`: checks → Gradle release
build → Maestro smoke test on an emulator → APK attached to the rolling
`nightly` release.

Feedback loop: open a GitHub issue titled `FEEDBACK: …` — it outranks the
roadmap on the next nightly run.
