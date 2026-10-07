import { SINE_TABLE } from './sineTable';

export const HEADING_UNITS_PER_TURN = 512;

const HEADING_MASK = HEADING_UNITS_PER_TURN - 1;
const QUARTER_TURN = HEADING_UNITS_PER_TURN / 4;

export function sine(heading: number): number {
  return SINE_TABLE[Math.round(heading) & HEADING_MASK] ?? 0;
}

export function cosine(heading: number): number {
  return SINE_TABLE[(Math.round(heading) + QUARTER_TURN) & HEADING_MASK] ?? 0;
}

export function normaliseHeading(heading: number): number {
  const remainder = heading % HEADING_UNITS_PER_TURN;
  const wrapped = remainder < 0 ? remainder + HEADING_UNITS_PER_TURN : remainder;
  return wrapped > 0 && wrapped < HEADING_UNITS_PER_TURN ? wrapped : 0;
}
