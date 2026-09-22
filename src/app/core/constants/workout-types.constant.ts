export const WORKOUT_TYPE_OPTIONS = [
  'stretching',
  'fly stretching',
  'power stretching',
  'power',
  'yoga',
  'functional',
  'pilates',
  'power pilates',
] as const;

export type WorkoutType = (typeof WORKOUT_TYPE_OPTIONS)[number];
