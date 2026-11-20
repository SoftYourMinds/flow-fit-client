export const WORKOUT_TYPE_OPTIONS = [
  'stretching',
  'fly stretching',
  'power stretching',
  'functional',
  'pilates',
  'power pilates',
  'reformer full',
  'reformer mix',
] as const;

export type WorkoutType = (typeof WORKOUT_TYPE_OPTIONS)[number];
