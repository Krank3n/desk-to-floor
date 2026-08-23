import { EditPlan, VideoSegment } from '../edl';
import {
  buildLongFormArgs,
  buildShortArgs,
  escapeDrawText,
  shortFileName,
} from '../ffmpeg';

const segment = (over: Partial<VideoSegment> = {}): VideoSegment => ({
  moveId: 'wrist-rocks',
  name: 'Wrist rocks',
  startMs: 0,
  endMs: 40000,
  highlight: false,
  ...over,
});

const plan: EditPlan = {
  sessionId: 'abc',
  sourceVideo: 'session-abc.mp4',
  bpm: null,
  totalMs: 100000,
  segments: [
    segment(),
    segment({
      moveId: 'six-step-half-speed',
      name: '6-step (half speed)',
      startMs: 50000,
      endMs: 110000,
      highlight: true,
    }),
  ],
};

/** The filter graph is one argument; pull it out to assert against. */
function filterGraph(args: string[]): string {
  const i = args.indexOf('-filter_complex');
  return args[i + 1];
}

describe('escapeDrawText', () => {
  it('escapes the characters that break a filtergraph', () => {
    expect(escapeDrawText('Toprock: Indian step')).toBe(
      'Toprock\\: Indian step',
    );
    expect(escapeDrawText('100% effort')).toBe('100\\% effort');
    expect(escapeDrawText('back\\slash')).toBe('back\\\\slash');
  });

  it('swaps apostrophes for typographic ones rather than fight ffmpeg quoting', () => {
    expect(escapeDrawText("Baby freeze — don't rush")).toBe(
      'Baby freeze — don’t rush',
    );
  });
});

describe('buildLongFormArgs', () => {
  it('refuses a plan with nothing to cut', () => {
    expect(() =>
      buildLongFormArgs({ ...plan, segments: [] }, 'in.mp4', 'out.mp4'),
    ).toThrow('no usable segments');
  });

  it('trims each segment and concatenates them', () => {
    const graph = filterGraph(buildLongFormArgs(plan, 'in.mp4', 'out.mp4'));
    expect(graph).toContain(
      '[0:v]trim=start=0.000:end=40.000,setpts=PTS-STARTPTS[v0]',
    );
    expect(graph).toContain(
      '[0:a]atrim=start=50.000:end=110.000,asetpts=PTS-STARTPTS[a1]',
    );
    expect(graph).toContain('[v0][a0][v1][a1]concat=n=2:v=1:a=1[vc][ac]');
  });

  it('places titles on the output timeline, not the source timeline', () => {
    const graph = filterGraph(buildLongFormArgs(plan, 'in.mp4', 'out.mp4'));
    // First segment is 40s long, so the second title starts at output t=40s
    // even though that segment begins at 50s in the source.
    expect(graph).toContain("text='Wrist rocks'");
    expect(graph).toContain("enable='between(t,0.000,3.000)'");
    expect(graph).toContain("enable='between(t,40.000,43.000)'");
  });

  it('never runs a title past the end of its own segment', () => {
    const short: EditPlan = {
      ...plan,
      segments: [segment({ endMs: 1500 })],
    };
    const graph = filterGraph(buildLongFormArgs(short, 'in.mp4', 'out.mp4'));
    expect(graph).toContain("enable='between(t,0.000,1.500)'");
  });

  it('maps the rendered streams and writes a faststart mp4', () => {
    const args = buildLongFormArgs(plan, 'in.mp4', 'out.mp4');
    expect(args).toEqual(expect.arrayContaining(['-map', '[vout]']));
    expect(args).toEqual(expect.arrayContaining(['-movflags', '+faststart']));
    expect(args[args.length - 1]).toBe('out.mp4');
  });

  it('uses a supplied font file when given one', () => {
    const graph = filterGraph(
      buildLongFormArgs(plan, 'in.mp4', 'out.mp4', {
        fontFile: '/fonts/Inter.ttf',
      }),
    );
    expect(graph).toContain("fontfile='/fonts/Inter.ttf'");
  });
});

describe('buildShortArgs', () => {
  const highlight = segment({
    moveId: 'six-step-half-speed',
    name: '6-step (half speed)',
    startMs: 50000,
    endMs: 110000,
    highlight: true,
  });

  it('seeks to the segment and crops 9:16', () => {
    const args = buildShortArgs(highlight, 'in.mp4', 'short.mp4');
    expect(args).toEqual(expect.arrayContaining(['-ss', '50.000']));
    const vf = args[args.indexOf('-vf') + 1];
    expect(vf).toContain("crop=w='min(iw\\,ih*9/16)':h=ih");
    expect(vf).toContain('scale=1080:1920');
  });

  it('caps the clip at the Shorts limit', () => {
    const args = buildShortArgs(highlight, 'in.mp4', 'short.mp4');
    // 60s of source would run to the cap exactly; ask for more and it clamps.
    expect(args[args.indexOf('-t') + 1]).toBe('60.000');
    const shorter = buildShortArgs(
      segment({ startMs: 0, endMs: 8000 }),
      'in.mp4',
      'short.mp4',
    );
    expect(shorter[shorter.indexOf('-t') + 1]).toBe('8.000');
  });
});

describe('shortFileName', () => {
  it('is sortable and filename-safe', () => {
    expect(shortFileName(segment({ moveId: 'six-step-half-speed' }), 0)).toBe(
      '01-six-step-half-speed.mp4',
    );
    expect(shortFileName(segment({ moveId: 'ninety/ninety' }), 9)).toBe(
      '10-ninety-ninety.mp4',
    );
  });
});
