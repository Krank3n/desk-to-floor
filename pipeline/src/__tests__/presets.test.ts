import { DEFAULT_PRESET, PRESETS, resolvePreset } from '../presets';

describe('resolvePreset', () => {
  it('resolves each known preset by name', () => {
    expect(resolvePreset('default').render).toEqual({ crf: 20, preset: 'medium' });
    expect(resolvePreset('draft')).toMatchObject({ shorts: false });
    expect(resolvePreset('upload')).toMatchObject({ shorts: true });
  });

  it('the default preset name matches an actual preset', () => {
    expect(PRESETS[DEFAULT_PRESET]).toBeDefined();
  });

  it('throws a helpful error naming the known presets', () => {
    expect(() => resolvePreset('cinematic')).toThrow(
      'Unknown export preset "cinematic". Known presets: default, draft, upload.',
    );
  });
});
