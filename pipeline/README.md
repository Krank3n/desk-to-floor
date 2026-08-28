# The auto-editor

Turns a session's raw footage + event log into edited video. No ML, no manual
logging: the app already recorded when everything happened, so editing is
deterministic arithmetic over `EVENTLOG.md`.

## Use it

```sh
# ffmpeg must be on PATH (brew install ffmpeg)
npm run edit -- --log ~/sessions/session-20260821T093000-4f2a9c.json --out output/
```

| Flag | Default | What |
| --- | --- | --- |
| `--log <path>` | *required* | The session JSON. The video is read from its `recording.file`, resolved next to the log. |
| `--out <dir>` | `output` | Where renders land (gitignored). |
| `--font <path>` | fontconfig default | A `.ttf`/`.otf` for the burned titles. Pass one if titles look wrong. |
| `--preset <name>` | `default` | Named bundle of encode settings + whether to cut Shorts — see below. |
| `--no-shorts` | preset decides | Force long-form only, overriding the preset. |
| `--dry-run` | off | Print the ffmpeg commands without running them. |

### Export presets (`src/presets.ts`)

| Preset | Encode | Shorts | For |
| --- | --- | --- | --- |
| `default` | crf 20, preset `medium` | on | Balanced quality/speed — the original behaviour. |
| `draft` | crf 28, preset `veryfast` | off | Quick long-form check of the cuts before a real export. |
| `upload` | crf 18, preset `slow` | on | Final render that actually gets posted. |

`--no-shorts` always wins over a preset's default. `--font` applies on top of
whichever preset is chosen.

Outputs: `<sessionId>-longform.mp4` (16:9, all kept moves, titles burned in)
and one `NN-<move-id>.mp4` per highlight move (9:16, centre-cropped, ≤60s).

## How it decides what to keep

`edl.ts` is a pure function from event log to an edit decision list:

- **Keep** work intervals (`move_start` → `move_end`). **Drop** rests, and
  anything outside `session_start`/`session_end`.
- **Redo markers** discard the take before them — footage from `move_start` to
  the last `redo` is cut, the retake survives.
- **Pauses** are removed, splitting the move around the dead air (the camera
  kept rolling).
- **Music mode** rounds every cut *inward* to the nearest beat — start up, end
  down — so edges land on the music without bleeding into a rest. The grid
  shifts by each completed pause exactly as `EVENTLOG.md` specifies.
- **Non-music mode** pads cuts with 250 ms handles, clamped so neighbouring
  segments never overlap. This absorbs the camera-start latency documented in
  `EVENTLOG.md`.
- Fragments under 1 s are dropped as junk.
- **Shorts** are cut from breaking skills only (toprock / footwork / freeze
  categories, read from the app's exercise library).

Video time = session time − `recording.startOffsetMs`.

## Layout

| File | Role |
| --- | --- |
| `src/edl.ts` | Pure planner: event log → segments. All the editing rules. |
| `src/ffmpeg.ts` | Pure renderer: plan → ffmpeg argument arrays. |
| `src/run.ts` | The only side effect: spawns ffmpeg. |
| `src/cli.ts` | Arg parsing and orchestration. |
| `bin.ts` | Entry point (`npm run edit`). |

The planner and the arg builders are pure so the rules are unit-tested without
any video: `npm test` (they run in the repo's single Jest project). It imports
the app's `src/lib` directly — one definition of the schema and the exercise
library, never a copy that can drift.
