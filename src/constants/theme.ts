/**
 * Desk to Floor design tokens.
 *
 * v1 is deliberately dark-only: this app is used mid-workout, often pointed at
 * a camera in a room with controlled lighting. One theme, no runtime switching.
 * (Recorded in DECISIONS.md.)
 */
export const theme = {
  colors: {
    bg: '#0B0F14',
    surface: '#141B23',
    surfaceRaised: '#1C2530',
    border: '#26313E',
    text: '#F2F5F7',
    textMuted: '#8A97A5',
    accent: '#FF6B2C',
    accentPressed: '#D9531C',
    success: '#3ECF8E',
    danger: '#FF5A5F',
  },
  /** 4pt spacing grid: spacing(4) = 16 */
  spacing: (n: number) => n * 4,
  radius: {
    sm: 8,
    md: 12,
    lg: 20,
  },
  font: {
    /** Big timer / hero numerals */
    display: 44,
    title: 28,
    heading: 20,
    body: 16,
    caption: 13,
  },
} as const;

export type Theme = typeof theme;
