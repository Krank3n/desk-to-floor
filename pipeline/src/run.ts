import { spawn } from 'node:child_process';

/**
 * The only part of the pipeline with side effects: shells out to ffmpeg.
 * Everything that decides *what* to render lives in edl.ts / ffmpeg.ts.
 */
export interface RunResult {
  args: string[];
  durationMs: number;
}

export async function runFfmpeg(
  args: string[],
  ffmpegPath = process.env.FFMPEG_PATH ?? 'ffmpeg',
): Promise<RunResult> {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    // ffmpeg logs everything to stderr; keep only the tail for error reports.
    const tail: string[] = [];
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      tail.push(chunk);
      if (tail.length > 40) tail.shift();
    });
    child.on('error', (error) => {
      reject(
        new Error(
          `Could not start ffmpeg ("${ffmpegPath}"). Is it installed and on PATH?\n${error.message}`,
        ),
      );
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ args, durationMs: Date.now() - startedAt });
      } else {
        reject(
          new Error(`ffmpeg exited ${code}\n${tail.join('').trimEnd()}`),
        );
      }
    });
  });
}
