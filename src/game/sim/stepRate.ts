export const STEPS_PER_SECOND = 60;
export const STEP_SECONDS = 1 / STEPS_PER_SECOND;

export function stepsFromSeconds(seconds: number): number {
  return Math.max(1, Math.round(seconds * STEPS_PER_SECOND));
}
