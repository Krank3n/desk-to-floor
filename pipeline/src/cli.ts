import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { parseEventLog } from '@/lib/eventlog';

import { planEdit } from './edl';
import { buildLongFormArgs, buildShortArgs, shortFileName } from './ffmpeg';
import { DEFAULT_PRESET, resolvePreset } from './presets';
import { runFfmpeg } from './run';

/**
 * Usage:
 *   npm run edit -- --log <session-<id>.json> [--out output/] [--font <ttf>]
 *                   [--preset default|draft|upload] [--no-shorts] [--dry-run]
 *
 * The source video is read from the log's `recording.file`, resolved next to
 * the log — that pairing is the app's contract (EVENTLOG.md).
 */
interface Args {
  log: string;
  out: string;
  font?: string;
  preset: string;
  shorts?: boolean;
  dryRun: boolean;
}

export function parseArgs(argv: string[]): Args {
  const args: Args = { log: '', out: 'output', preset: DEFAULT_PRESET, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    switch (flag) {
      case '--log':
        args.log = argv[++i] ?? '';
        break;
      case '--out':
        args.out = argv[++i] ?? 'output';
        break;
      case '--font':
        args.font = argv[++i];
        break;
      case '--preset':
        args.preset = argv[++i] ?? DEFAULT_PRESET;
        break;
      case '--no-shorts':
        args.shorts = false;
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      default:
        if (!args.log && !flag.startsWith('--')) args.log = flag;
    }
  }
  if (!args.log) {
    throw new Error(
      'Usage: npm run edit -- --log <session-<id>.json> [--out output/] ' +
        '[--font <ttf>] [--preset default|draft|upload] [--no-shorts] [--dry-run]',
    );
  }
  return args;
}

export async function main(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  const preset = resolvePreset(args.preset);
  const logPath = resolve(args.log);
  // parseEventLog hard-errors on an unknown schemaVersion — that is the point.
  const log = parseEventLog(await readFile(logPath, 'utf8'));
  const plan = planEdit(log);
  const inputPath = join(dirname(logPath), plan.sourceVideo);
  const outDir = resolve(args.out);
  await mkdir(outDir, { recursive: true });

  const render = { ...preset.render, fontFile: args.font };
  const shorts = args.shorts ?? preset.shorts;
  const longForm = join(outDir, `${plan.sessionId}-longform.mp4`);
  const jobs: { label: string; args: string[] }[] = [
    {
      label: `long-form (${plan.segments.length} moves, ${Math.round(plan.totalMs / 1000)}s)`,
      args: buildLongFormArgs(plan, inputPath, longForm, render),
    },
  ];

  if (shorts) {
    plan.segments
      .filter((segment) => segment.highlight)
      .forEach((segment, i) => {
        jobs.push({
          label: `short: ${segment.name}`,
          args: buildShortArgs(
            segment,
            inputPath,
            join(outDir, shortFileName(segment, i)),
            render,
          ),
        });
      });
  }

  console.log(
    `${plan.sessionId}: ${plan.segments.length} segments, ` +
      `${Math.round(plan.totalMs / 1000)}s kept` +
      (plan.bpm ? `, beat-synced at ${plan.bpm} BPM` : '') +
      ` → ${jobs.length} output(s) [${preset.name} preset]`,
  );

  for (const job of jobs) {
    if (args.dryRun) {
      console.log(`  [dry-run] ffmpeg ${job.args.join(' ')}`);
      continue;
    }
    process.stdout.write(`  ${job.label}… `);
    const result = await runFfmpeg(job.args);
    console.log(`done in ${Math.round(result.durationMs / 1000)}s`);
  }
}
