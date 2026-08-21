/**
 * The exercise library. Pure data — no UI, no side effects.
 *
 * Categories follow the 12-week program: wrists gate everything, mobility
 * undoes the desk, strength earns the skills, skills are the point.
 */
export type ExerciseCategory =
  | 'wrist-prep'
  | 'mobility'
  | 'strength'
  | 'toprock'
  | 'footwork'
  | 'freeze';

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  /** Default seconds of work when a session includes this move. */
  workSeconds: number;
  /** Default seconds of rest after the work interval. */
  restSeconds: number;
  /** Spoken by TTS when the move starts. Keep it short and physical. */
  cue: string;
  /** One line shown under the move name. */
  description: string;
}

export const EXERCISES: readonly Exercise[] = [
  // — Wrist prep: always first, non-negotiable at 39 —
  {
    id: 'wrist-rocks',
    name: 'Wrist rocks',
    category: 'wrist-prep',
    workSeconds: 40,
    restSeconds: 10,
    cue: 'Wrist rocks. Palms down, rock forward and back, easy range.',
    description: 'Hands on the floor, rock weight forward and back',
  },
  {
    id: 'wrist-extension-lifts',
    name: 'Wrist extension lifts',
    category: 'wrist-prep',
    workSeconds: 40,
    restSeconds: 10,
    cue: 'Extension lifts. Palms flat, lift the fingers, then the palm heel.',
    description: 'Build the extension range breaking demands',
  },
  {
    id: 'wrist-side-loads',
    name: 'Wrist side loads',
    category: 'wrist-prep',
    workSeconds: 30,
    restSeconds: 10,
    cue: 'Side loads. Shift weight over each wrist edge, slow.',
    description: 'Lateral loading, one side at a time',
  },

  // — Mobility: undo the desk —
  {
    id: 'ninety-ninety-switches',
    name: '90/90 hip switches',
    category: 'mobility',
    workSeconds: 60,
    restSeconds: 15,
    cue: 'Ninety ninety switches. Tall spine, knees sweep side to side.',
    description: 'Seated hip rotations, both directions',
  },
  {
    id: 't-spine-rotations',
    name: 'T-spine rotations',
    category: 'mobility',
    workSeconds: 45,
    restSeconds: 15,
    cue: 'T spine rotations. Reach through, then open to the ceiling.',
    description: 'Quadruped thread-the-needle, slow reach',
  },
  {
    id: 'deep-squat-hold',
    name: 'Deep squat hold',
    category: 'mobility',
    workSeconds: 60,
    restSeconds: 15,
    cue: 'Deep squat hold. Heels down, chest tall, breathe.',
    description: 'Accumulate time in the bottom position',
  },
  {
    id: 'cossack-squats',
    name: 'Cossack squats',
    category: 'mobility',
    workSeconds: 45,
    restSeconds: 15,
    cue: 'Cossack squats. Slide side to side, heel stays down.',
    description: 'Side-to-side deep squats, alternate legs',
  },

  // — Strength: earn the skills —
  {
    id: 'push-ups',
    name: 'Push-ups',
    category: 'strength',
    workSeconds: 40,
    restSeconds: 20,
    cue: 'Push ups. Elbows at forty five, full range, quality over count.',
    description: 'Strict reps, knees down if form breaks',
  },
  {
    id: 'incline-rows',
    name: 'Incline rows',
    category: 'strength',
    workSeconds: 40,
    restSeconds: 20,
    cue: 'Rows. Squeeze the shoulder blades, slow on the way down.',
    description: 'Under a sturdy table or with rings/straps',
  },
  {
    id: 'hollow-body-hold',
    name: 'Hollow body hold',
    category: 'strength',
    workSeconds: 30,
    restSeconds: 20,
    cue: 'Hollow body. Lower back pressed down, arms and legs long.',
    description: 'The core shape behind every freeze',
  },

  // — Toprock —
  {
    id: 'toprock-indian-step',
    name: 'Toprock: Indian step',
    category: 'toprock',
    workSeconds: 60,
    restSeconds: 20,
    cue: 'Indian step. Stay light, find the bounce, cross and open.',
    description: 'The foundational toprock pattern, to rhythm',
  },

  // — Footwork —
  {
    id: 'six-step-half-speed',
    name: '6-step (half speed)',
    category: 'footwork',
    workSeconds: 60,
    restSeconds: 25,
    cue: 'Six step, half speed. Hips high, hands quiet, name each step.',
    description: 'Slow rotations, precision before tempo',
  },
  {
    id: 'knee-drop',
    name: 'Knee drop',
    category: 'footwork',
    workSeconds: 45,
    restSeconds: 20,
    cue: 'Knee drops. Soft landing, control all the way down.',
    description: 'Safe floor entry from standing',
  },

  // — Freezes —
  {
    id: 'crow-hold',
    name: 'Crow progression',
    category: 'freeze',
    workSeconds: 40,
    restSeconds: 25,
    cue: 'Crow. Knees to elbows, look forward, lean until light.',
    description: 'The gateway to every freeze — accumulate seconds',
  },
  {
    id: 'baby-freeze-prep',
    name: 'Baby freeze prep',
    category: 'freeze',
    workSeconds: 45,
    restSeconds: 25,
    cue: 'Baby freeze prep. Elbow in the hip shelf, knee on elbow, head light.',
    description: 'Knee-on-elbow first; feet stay on the floor',
  },
] as const;

const byId = new Map(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise {
  const exercise = byId.get(id);
  if (!exercise) {
    throw new Error(`Unknown exercise id: ${id}`);
  }
  return exercise;
}
