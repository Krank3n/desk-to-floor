import { RenderOptions } from './ffmpeg';

/**
 * Named bundles of render options + whether to cut Shorts, so `npm run edit`
 * doesn't need a fresh combination of `--crf`/`--preset`-style flags picked
 * by hand every time. `render` feeds straight into `RenderOptions`.
 */
export interface ExportPreset {
  name: string;
  description: string;
  render: RenderOptions;
  shorts: boolean;
}

export const DEFAULT_PRESET = 'default';

export const PRESETS: Record<string, ExportPreset> = {
  default: {
    name: 'default',
    description: 'Balanced quality and speed — unchanged from before presets existed.',
    render: { crf: 20, preset: 'medium' },
    shorts: true,
  },
  draft: {
    name: 'draft',
    description:
      'Fast, lower-quality long-form only — for checking the cuts before a real export.',
    render: { crf: 28, preset: 'veryfast' },
    shorts: false,
  },
  upload: {
    name: 'upload',
    description:
      'Slower encode, highest quality, long-form + Shorts — for the render that actually gets posted.',
    render: { crf: 18, preset: 'slow' },
    shorts: true,
  },
};

export function resolvePreset(name: string): ExportPreset {
  const preset = PRESETS[name];
  if (!preset) {
    const known = Object.keys(PRESETS).join(', ');
    throw new Error(`Unknown export preset "${name}". Known presets: ${known}.`);
  }
  return preset;
}
