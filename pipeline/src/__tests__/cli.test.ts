import { parseArgs } from '../cli';

describe('parseArgs', () => {
  it('defaults out dir, preset, and leaves shorts unset (preset decides)', () => {
    const args = parseArgs(['--log', 'session.json']);
    expect(args).toMatchObject({
      log: 'session.json',
      out: 'output',
      preset: 'default',
      dryRun: false,
    });
    expect(args.shorts).toBeUndefined();
  });

  it('accepts a bare path as --log', () => {
    expect(parseArgs(['session.json']).log).toBe('session.json');
  });

  it('parses --preset, --out, --font, --no-shorts, --dry-run', () => {
    const args = parseArgs([
      '--log',
      'session.json',
      '--out',
      'renders/',
      '--font',
      '/fonts/Inter.ttf',
      '--preset',
      'draft',
      '--no-shorts',
      '--dry-run',
    ]);
    expect(args).toMatchObject({
      log: 'session.json',
      out: 'renders/',
      font: '/fonts/Inter.ttf',
      preset: 'draft',
      shorts: false,
      dryRun: true,
    });
  });

  it('requires --log', () => {
    expect(() => parseArgs(['--preset', 'draft'])).toThrow('Usage:');
  });
});
