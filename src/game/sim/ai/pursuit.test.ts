import { describe, expect, test } from 'vitest';
import type { Point } from '../../config/gameConfig';
import { cosine, headingUnitsFromDegrees, sine } from '../math/rotation';
import { STEP_SECONDS } from '../stepRate';
import { createShip } from '../world';
import type { Ship } from '../world';
import { turnToward } from './pursuit';

const UNITS_PER_TURN = 512;
const RADIANS_PER_HEADING_UNIT = (2 * Math.PI) / UNITS_PER_TURN;
const FOUR_UNITS_PER_STEP = 240;
const BAND_OF_THE_FIXTURE = 4;
const HEADINGS = [0, 37, 64, 128, 200, 256, 300.3, 384, 448.5, 511];

interface Mismatch {
  heading: number;
  mark: Point;
  turn: number;
  expected: number;
}

function shipHeading(heading: number, turnRate = FOUR_UNITS_PER_STEP): Ship {
  return { ...createShip(), active: true, x: 1000, y: 1000, heading, turnRate };
}

function markAt(ship: Ship, offset: number, distance: number): Point {
  const angle = (Math.round(ship.heading) + offset) * RADIANS_PER_HEADING_UNIT;
  return { x: ship.x + distance * Math.cos(angle), y: ship.y + distance * Math.sin(angle) };
}

function offsetByAtan2(ship: Ship, mark: Point): number {
  const bearing = Math.atan2(mark.y - ship.y, mark.x - ship.x) / RADIANS_PER_HEADING_UNIT;
  const offset = bearing - Math.round(ship.heading);
  return offset - UNITS_PER_TURN * Math.round(offset / UNITS_PER_TURN);
}

function turnTo(ship: Ship, mark: Point, dt = STEP_SECONDS): number {
  return turnToward(ship, mark.x, mark.y, dt);
}

describe('pursuit (ADR-0005, ADR-0006)', () => {
  test('EN-01 a ship turns right toward a target clockwise of its heading and left toward one counter-clockwise, at every heading', () => {
    const eastward = shipHeading(0);
    const southward = shipHeading(128);
    const westward = shipHeading(256);
    const northward = shipHeading(384);

    expect(turnToward(eastward, 1000, 1300, STEP_SECONDS)).toBe(1);
    expect(turnToward(eastward, 1000, 700, STEP_SECONDS)).toBe(-1);
    expect(turnToward(southward, 700, 1000, STEP_SECONDS)).toBe(1);
    expect(turnToward(southward, 1300, 1000, STEP_SECONDS)).toBe(-1);
    expect(turnToward(westward, 1000, 700, STEP_SECONDS)).toBe(1);
    expect(turnToward(westward, 1000, 1300, STEP_SECONDS)).toBe(-1);
    expect(turnToward(northward, 1300, 1000, STEP_SECONDS)).toBe(1);
    expect(turnToward(northward, 700, 1000, STEP_SECONDS)).toBe(-1);

    const marks = Array.from({ length: 48 }, (_, index) => ({
      x: 1000 + (30 + 17 * index) * Math.cos(0.61 * index),
      y: 1000 + (30 + 17 * index) * Math.sin(0.61 * index),
    }));
    const mismatches: Mismatch[] = [];
    let turnsRight = 0;
    let turnsLeft = 0;
    for (let unit = 0; unit < UNITS_PER_TURN; unit += 1) {
      for (const heading of [unit, unit + 0.3, unit - 0.45]) {
        const ship = shipHeading(heading);
        for (const mark of marks) {
          const offset = offsetByAtan2(ship, mark);
          if (Math.abs(offset) > BAND_OF_THE_FIXTURE + 0.5 && Math.abs(offset) < 255.5) {
            const expected = offset > 0 ? 1 : -1;
            const turn = turnTo(ship, mark);
            turnsRight += expected === 1 ? 1 : 0;
            turnsLeft += expected === -1 ? 1 : 0;
            if (turn !== expected) {
              mismatches.push({ heading, mark, turn, expected });
            }
          }
        }
      }
    }

    expect(mismatches).toEqual([]);
    expect(turnsRight).toBeGreaterThan(30000);
    expect(turnsLeft).toBeGreaterThan(30000);
  });

  test('EN-01 a ship that faces its target within the band holds its heading, and one a table unit outside it turns', () => {
    for (const heading of HEADINGS) {
      const ship = shipHeading(heading);
      for (const distance of [3, 50, 600.5]) {
        for (const offset of [-3.9, -3, -2, -1, 0, 1, 2, 3, 3.9]) {
          expect(turnTo(ship, markAt(ship, offset, distance))).toBe(0);
        }
        expect(turnTo(ship, markAt(ship, 5, distance))).toBe(1);
        expect(turnTo(ship, markAt(ship, 4.1, distance))).toBe(1);
        expect(turnTo(ship, markAt(ship, -4.1, distance))).toBe(-1);
        expect(turnTo(ship, markAt(ship, -5, distance))).toBe(-1);
      }
    }
  });

  test('EN-01 the facing band is the table angle nearest one step of turning, and one unit at least', () => {
    const bands = [
      { turnRate: headingUnitsFromDegrees(120), dt: STEP_SECONDS, band: 3 },
      { turnRate: 240, dt: STEP_SECONDS, band: 4 },
      { turnRate: 240, dt: 2 * STEP_SECONDS, band: 8 },
      { turnRate: 240, dt: STEP_SECONDS / 2, band: 2 },
      { turnRate: 144, dt: STEP_SECONDS, band: 2 },
      { turnRate: 96, dt: STEP_SECONDS, band: 2 },
      { turnRate: 84, dt: STEP_SECONDS, band: 1 },
      { turnRate: 45, dt: STEP_SECONDS, band: 1 },
      { turnRate: 20, dt: STEP_SECONDS, band: 1 },
      { turnRate: 0, dt: STEP_SECONDS, band: 1 },
    ];

    expect(headingUnitsFromDegrees(120) * STEP_SECONDS).toBeGreaterThan(2.84);
    expect(headingUnitsFromDegrees(120) * STEP_SECONDS).toBeLessThan(2.85);
    expect(20 * STEP_SECONDS).toBeLessThan(0.5);

    for (const { turnRate, dt, band } of bands) {
      for (const heading of HEADINGS) {
        const ship = shipHeading(heading, turnRate);
        for (const distance of [50, 600.5]) {
          expect(turnTo(ship, markAt(ship, 0, distance), dt)).toBe(0);
          expect(turnTo(ship, markAt(ship, band - 0.1, distance), dt)).toBe(0);
          expect(turnTo(ship, markAt(ship, 0.1 - band, distance), dt)).toBe(0);
          expect(turnTo(ship, markAt(ship, band + 0.1, distance), dt)).toBe(1);
          expect(turnTo(ship, markAt(ship, -0.1 - band, distance), dt)).toBe(-1);
        }
      }
    }
  });

  test("EN-01 a target dead astern turns the ship right, and a target at the ship's own position turns it nowhere", () => {
    const eastward = shipHeading(0);
    const southward = shipHeading(128);
    const westward = shipHeading(256);
    const northward = shipHeading(384);

    expect(turnToward(eastward, 400, 1000, STEP_SECONDS)).toBe(1);
    expect(turnToward(southward, 1000, 400, STEP_SECONDS)).toBe(1);
    expect(turnToward(westward, 1600, 1000, STEP_SECONDS)).toBe(1);
    expect(turnToward(northward, 1000, 1600, STEP_SECONDS)).toBe(1);

    for (let heading = 0; heading < UNITS_PER_TURN; heading += 1) {
      for (const turnRate of [0, 20, FOUR_UNITS_PER_STEP]) {
        const atTheOrigin: Ship = { ...shipHeading(heading, turnRate), x: 0, y: 0 };
        const astern = { x: -64 * cosine(heading), y: -64 * sine(heading) };

        expect(turnTo(atTheOrigin, astern)).toBe(1);
        expect(turnTo(atTheOrigin, { x: 0, y: 0 })).toBe(0);
      }
    }

    for (const heading of HEADINGS) {
      const ship = shipHeading(heading);
      const elsewhere: Ship = { ...shipHeading(heading), x: 812.5, y: 47.25 };

      expect(turnTo(ship, markAt(ship, 254, 300))).toBe(1);
      expect(turnTo(ship, markAt(ship, -254, 300))).toBe(-1);
      expect(turnTo(ship, markAt(ship, 255.9, 300))).toBe(1);
      expect(turnTo(ship, markAt(ship, -255.9, 300))).toBe(-1);
      expect(turnTo(ship, { x: 1000, y: 1000 })).toBe(0);
      expect(turnTo(elsewhere, { x: 812.5, y: 47.25 })).toBe(0);
    }
  });
});
