import { EditPlan, VideoSegment } from './edl';

/**
 * Renders an EditPlan into ffmpeg argument arrays. Pure: builds args, never
 * runs anything, so every filter graph is unit-testable.
 *
 * Args are passed to spawn() as an array — there is no shell, so the only
 * escaping that matters is ffmpeg's own filtergraph parsing.
 */

export interface RenderOptions {
  /** Path to a .ttf/.otf. Without one, drawtext uses fontconfig's "Sans". */
  fontFile?: string;
  /** How long a move-name title stays on screen. */
  titleSeconds?: number;
  crf?: number;
  preset?: string;
  /** Shorts are capped — the platforms cut them off anyway. */
  maxShortMs?: number;
}

const SHORT_WIDTH = 1080;
const SHORT_HEIGHT = 1920;

function seconds(ms: number): string {
  return (ms / 1000).toFixed(3);
}

/**
 * Escape text for a drawtext filter. Apostrophes become typographic ones:
 * ffmpeg's nested quoting rules make a literal `'` inside a quoted filter
 * option genuinely painful, and a curly apostrophe looks better on screen.
 */
export function escapeDrawText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '’')
    .replace(/:/g, '\\:')
    .replace(/%/g, '\\%');
}

function drawTextFilter(
  text: string,
  fromMs: number,
  toMs: number,
  options: RenderOptions,
  fontSize: number,
): string {
  const parts = [
    `text='${escapeDrawText(text)}'`,
    'x=(w-tw)/2',
    'y=h-th-(h/12)',
    `fontsize=${fontSize}`,
    'fontcolor=0xF2F5F7',
    'box=1',
    'boxcolor=0x0B0F14@0.65',
    'boxborderw=24',
    `enable='between(t,${seconds(fromMs)},${seconds(toMs)})'`,
  ];
  if (options.fontFile) {
    parts.unshift(`fontfile='${options.fontFile}'`);
  }
  return `drawtext=${parts.join(':')}`;
}

/**
 * One pass: trim each kept segment, concat them, then burn the move names
 * over the joined timeline. No intermediate files.
 */
export function buildLongFormArgs(
  plan: EditPlan,
  inputPath: string,
  outputPath: string,
  options: RenderOptions = {},
): string[] {
  if (plan.segments.length === 0) {
    throw new Error(`Session ${plan.sessionId} has no usable segments.`);
  }
  const { titleSeconds = 3, crf = 20, preset = 'medium' } = options;

  const chains: string[] = [];
  const concatInputs: string[] = [];
  plan.segments.forEach((segment, i) => {
    const from = seconds(segment.startMs);
    const to = seconds(segment.endMs);
    chains.push(
      `[0:v]trim=start=${from}:end=${to},setpts=PTS-STARTPTS[v${i}]`,
      `[0:a]atrim=start=${from}:end=${to},asetpts=PTS-STARTPTS[a${i}]`,
    );
    concatInputs.push(`[v${i}][a${i}]`);
  });

  chains.push(
    `${concatInputs.join('')}concat=n=${plan.segments.length}:v=1:a=1[vc][ac]`,
  );

  // Titles are placed on the *output* timeline: cumulative segment durations.
  let cursorMs = 0;
  const titles = plan.segments.map((segment) => {
    const start = cursorMs;
    cursorMs += segment.endMs - segment.startMs;
    return drawTextFilter(
      segment.name,
      start,
      Math.min(start + titleSeconds * 1000, cursorMs),
      options,
      48,
    );
  });
  chains.push(`[vc]${titles.join(',')}[vout]`);

  return [
    '-y',
    '-i',
    inputPath,
    '-filter_complex',
    chains.join(';'),
    '-map',
    '[vout]',
    '-map',
    '[ac]',
    '-c:v',
    'libx264',
    '-preset',
    preset,
    '-crf',
    String(crf),
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-movflags',
    '+faststart',
    outputPath,
  ];
}

/**
 * A 9:16 centre crop of a single highlight move. Seeking before -i is fast and
 * still frame-accurate when re-encoding.
 */
export function buildShortArgs(
  segment: VideoSegment,
  inputPath: string,
  outputPath: string,
  options: RenderOptions = {},
): string[] {
  const {
    titleSeconds = 2,
    crf = 20,
    preset = 'medium',
    maxShortMs = 60_000,
  } = options;
  const durationMs = Math.min(segment.endMs - segment.startMs, maxShortMs);

  const filters = [
    // min() keeps portrait sources from cropping to nothing; the comma is
    // escaped because filtergraphs split options on it.
    `crop=w='min(iw\\,ih*9/16)':h=ih`,
    `scale=${SHORT_WIDTH}:${SHORT_HEIGHT}:force_original_aspect_ratio=increase`,
    `crop=${SHORT_WIDTH}:${SHORT_HEIGHT}`,
    'setsar=1',
    drawTextFilter(segment.name, 0, titleSeconds * 1000, options, 64),
  ];

  return [
    '-y',
    '-ss',
    seconds(segment.startMs),
    '-t',
    seconds(durationMs),
    '-i',
    inputPath,
    '-vf',
    filters.join(','),
    '-c:v',
    'libx264',
    '-preset',
    preset,
    '-crf',
    String(crf),
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-movflags',
    '+faststart',
    outputPath,
  ];
}

/** Stable, sortable output names: 01-six-step-half-speed.mp4 */
export function shortFileName(segment: VideoSegment, index: number): string {
  const slug = segment.moveId.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();
  return `${String(index + 1).padStart(2, '0')}-${slug}.mp4`;
}
