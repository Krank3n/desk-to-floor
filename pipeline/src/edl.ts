import { EventLog } from '@/lib/eventlog';
import { getExercise } from '@/lib/exercises';
import { beatDurationMs } from '@/lib/music';

/**
 * The planner: turns a session event log into an edit decision list.
 *
 * Pure — no ffmpeg, no filesystem — so the editing *rules* are unit-tested
 * without any video. `ffmpeg.ts` renders a plan; `run.ts` executes it.
 */

/** Breaking skills are what Shorts get cut from. */
const HIGHLIGHT_CATEGORIES = new Set(['toprock', 'footwork', 'freeze']);

export interface PlanOptions {
  /** Lead-in/lead-out padding, non-music mode only. Absorbs camera latency. */
  handleMs?: number;
  /** Segments shorter than this are dropped as junk. */
  minSegmentMs?: number;
}

export interface VideoSegment {
  moveId: string;
  name: string;
  /** Video time (ms from frame 0 of the source file). */
  startMs: number;
  endMs: number;
  /** Worth cutting a 9:16 Short from. */
  highlight: boolean;
}

export interface EditPlan {
  sessionId: string;
  /** Source video filename, as recorded in the log. */
  sourceVideo: string;
  segments: VideoSegment[];
  bpm: number | null;
  /** Total kept footage, ms. */
  totalMs: number;
}

interface Span {
  moveId: string;
  name: string;
  startMs: number;
  endMs: number;
}

function isHighlight(moveId: string): boolean {
  try {
    return HIGHLIGHT_CATEGORIES.has(getExercise(moveId).category);
  } catch {
    // A move the current library doesn't know: keep it, just not as a Short.
    return false;
  }
}

/** Paused spans in session time; video kept rolling through these. */
function pausedSpans(log: EventLog): { startMs: number; endMs: number }[] {
  const spans: { startMs: number; endMs: number }[] = [];
  let openPause: number | null = null;
  for (const event of log.events) {
    if (event.type === 'pause') openPause = event.atMs;
    if (event.type === 'resume' && openPause !== null) {
      spans.push({ startMs: openPause, endMs: event.atMs });
      openPause = null;
    }
  }
  return spans;
}

/**
 * The beat grid slides forward by each completed pause (EVENTLOG.md), so the
 * effective anchor depends on when you are asking about.
 */
export function gridAnchorAt(log: EventLog, atMs: number): number | null {
  if (!log.music) return null;
  let anchor = log.music.beatGridStartMs;
  for (const span of pausedSpans(log)) {
    if (span.endMs <= atMs) anchor += span.endMs - span.startMs;
  }
  return anchor;
}

/**
 * Work intervals only: rests and everything outside the session are dropped,
 * and a redo marker discards the take before it.
 */
function keptSpans(log: EventLog): Span[] {
  const spans: Span[] = [];
  let open: Span | null = null;
  for (const event of log.events) {
    switch (event.type) {
      case 'move_start':
        open = {
          moveId: event.moveId,
          name: event.name,
          startMs: event.atMs,
          endMs: event.atMs,
        };
        break;
      case 'redo':
        // Discard the botched take: the keeper starts at the marker.
        if (open) open.startMs = event.atMs;
        break;
      case 'move_end':
        if (open) {
          spans.push({ ...open, endMs: event.atMs });
          open = null;
        }
        break;
      case 'session_end':
        if (open) {
          spans.push({ ...open, endMs: event.atMs });
          open = null;
        }
        break;
    }
  }
  return spans;
}

/** Remove paused stretches, splitting a span that contains one. */
function removePauses(spans: Span[], pauses: { startMs: number; endMs: number }[]): Span[] {
  let result = spans;
  for (const pause of pauses) {
    const next: Span[] = [];
    for (const span of result) {
      const overlaps = pause.startMs < span.endMs && pause.endMs > span.startMs;
      if (!overlaps) {
        next.push(span);
        continue;
      }
      if (pause.startMs > span.startMs) {
        next.push({ ...span, endMs: pause.startMs });
      }
      if (pause.endMs < span.endMs) {
        next.push({ ...span, startMs: pause.endMs });
      }
    }
    result = next;
  }
  return result;
}

/**
 * Round cuts inward to the beat: start up, end down. Inward means a cut never
 * bleeds into a rest or a paused stretch, and both edges land on the music.
 */
function quantizeToBeats(spans: Span[], log: EventLog): Span[] {
  if (!log.music) return spans;
  const beat = beatDurationMs(log.music.bpm);
  return spans.map((span) => {
    const startAnchor = gridAnchorAt(log, span.startMs) ?? 0;
    const endAnchor = gridAnchorAt(log, span.endMs) ?? 0;
    const start =
      startAnchor + Math.ceil((span.startMs - startAnchor) / beat) * beat;
    const end = endAnchor + Math.floor((span.endMs - endAnchor) / beat) * beat;
    // If quantizing would invert or empty the span, leave it alone.
    return end > start ? { ...span, startMs: start, endMs: end } : span;
  });
}

/** Pad cuts, without letting neighbours overlap or running past the source. */
function applyHandles(spans: Span[], handleMs: number): Span[] {
  if (handleMs <= 0) return spans;
  return spans.map((span, i) => {
    const prevEnd = i > 0 ? spans[i - 1].endMs : 0;
    const nextStart = i < spans.length - 1 ? spans[i + 1].startMs : Infinity;
    return {
      ...span,
      startMs: Math.max(span.startMs - handleMs, prevEnd, 0),
      endMs: Math.min(span.endMs + handleMs, nextStart),
    };
  });
}

export function planEdit(log: EventLog, options: PlanOptions = {}): EditPlan {
  if (!log.recording) {
    throw new Error(
      `Session ${log.sessionId} has no recording — nothing to edit.`,
    );
  }
  const { handleMs = 250, minSegmentMs = 1000 } = options;

  let spans = keptSpans(log);
  spans = removePauses(spans, pausedSpans(log));
  spans = log.music
    ? quantizeToBeats(spans, log)
    : applyHandles(spans, handleMs);

  const offset = log.recording.startOffsetMs;
  const segments: VideoSegment[] = spans
    .map((span) => ({
      moveId: span.moveId,
      name: span.name,
      startMs: Math.max(0, span.startMs - offset),
      endMs: Math.max(0, span.endMs - offset),
      highlight: isHighlight(span.moveId),
    }))
    .filter((segment) => segment.endMs - segment.startMs >= minSegmentMs);

  return {
    sessionId: log.sessionId,
    sourceVideo: log.recording.file,
    segments,
    bpm: log.music?.bpm ?? null,
    totalMs: segments.reduce((sum, s) => sum + (s.endMs - s.startMs), 0),
  };
}
