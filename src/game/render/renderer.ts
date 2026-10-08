import { Application, Container, Graphics, Sprite, TilingSprite } from 'pixi.js';
import type { ConvexPolygon, GameConfig } from '../config/gameConfig';
import { Layer } from '../sim/collision/layers';
import { EventKind } from '../sim/events';
import type { GameEvent } from '../sim/events';
import { PROJECTILE_POOL_CAPACITY, SHIP_POOL_CAPACITY } from '../sim/limits';
import { HEADING_UNITS_PER_TURN } from '../sim/math/rotation';
import { ShipKind } from '../sim/world';
import type { Ship, World } from '../sim/world';
import { textureOf } from './textures';
import type { GameTextures } from './textures';

const TILE = 64;
const SAND_TILES_PER_ROW = 16;
const WATER_DRIFT = 6;
const HULL_LENGTH_IN_RADII = 2.6;
const SPRITE_FACES_DOWN = Math.PI / 2;
const HEALTH_BAR_WIDTH = 44;
const HEALTH_BAR_HEIGHT = 6;
const HEALTH_BAR_GAP = 14;
const FLASH_SECONDS = 0.14;
const EFFECT_CAPACITY = 48;
const MAXIMUM_RESOLUTION = 2;
const ENEMY_SHOT_TINT = 0xff8a65;
const HIT_TINT = 0xff7b7b;
const PLAIN_TINT = 0xffffff;

const SHIP_FRAMES: Readonly<Record<string, readonly number[]>> = {
  [ShipKind.Player]: [1, 7, 13],
  [ShipKind.Chaser]: [3, 9, 15],
  [ShipKind.Shooter]: [2, 8, 14],
};

const EffectStyle = {
  MuzzleFlash: 'muzzleFlash',
  Explosion: 'explosion',
  Spark: 'spark',
} as const;

type EffectStyle = (typeof EffectStyle)[keyof typeof EffectStyle];

interface ShipView {
  root: Container;
  hull: Sprite;
  bar: Graphics;
  shownKind: string | null;
  shownBand: number;
  shownHealth: number;
  flashSeconds: number;
}

interface Effect {
  sprite: Sprite;
  style: EffectStyle;
  age: number;
  life: number;
}

export interface Renderer {
  readonly canvas: HTMLCanvasElement;
  onFrame: (callback: () => void) => void;
  react: (event: GameEvent, world: World) => void;
  draw: (world: World, alpha: number, elapsedSeconds: number) => void;
  destroy: () => void;
}

function damageBand(ship: Ship): number {
  const ratio = ship.maxHealth > 0 ? ship.health / ship.maxHealth : 1;
  if (ratio > 2 / 3) {
    return 0;
  }
  return ratio > 1 / 3 ? 1 : 2;
}

function healthColor(ratio: number): number {
  if (ratio > 2 / 3) {
    return 0x57c84d;
  }
  return ratio > 1 / 3 ? 0xf2b233 : 0xe5484d;
}

function inside(polygon: ConvexPolygon, x: number, y: number): boolean {
  const sides = polygon.map((start, index) => {
    const end = polygon[(index + 1) % polygon.length] ?? start;
    return (end.x - start.x) * (y - start.y) - (end.y - start.y) * (x - start.x);
  });
  return sides.every((side) => side >= 0) || sides.every((side) => side <= 0);
}

function buildIslands(config: GameConfig, textures: GameTextures): Container {
  const { width, height, islands } = config.arena;
  const columns = Math.ceil(width / TILE);
  const rows = Math.ceil(height / TILE);
  const land = (column: number, row: number): boolean => {
    if (column < 0 || row < 0 || column >= columns || row >= rows) {
      return true;
    }
    const x = column * TILE + TILE / 2;
    const y = row * TILE + TILE / 2;
    return islands.some((polygon) => inside(polygon, x, y));
  };
  const layer = new Container();
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (land(column, row)) {
        const tileRow = !land(column, row - 1) ? 0 : !land(column, row + 1) ? 2 : 1;
        const tileColumn = !land(column - 1, row) ? 0 : !land(column + 1, row) ? 2 : 1;
        const tile = 1 + tileRow * SAND_TILES_PER_ROW + tileColumn;
        const sprite = new Sprite(textureOf(textures, `tile_${String(tile)}`));
        sprite.position.set(column * TILE, row * TILE);
        layer.addChild(sprite);
      }
    }
  }
  return layer;
}

function createShipView(): ShipView {
  const root = new Container();
  const hull = new Sprite();
  const bar = new Graphics();
  hull.anchor.set(0.5);
  root.addChild(hull, bar);
  root.visible = false;
  return {
    root,
    hull,
    bar,
    shownKind: null,
    shownBand: -1,
    shownHealth: -1,
    flashSeconds: 0,
  };
}

export async function createRenderer(
  config: GameConfig,
  textures: GameTextures,
): Promise<Renderer> {
  const { width, height } = config.arena;
  const app = new Application();
  await app.init({
    width,
    height,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio, MAXIMUM_RESOLUTION),
    backgroundColor: 0x2f8fce,
  });
  app.canvas.style.width = '100%';
  app.canvas.style.height = '100%';
  app.canvas.setAttribute('aria-hidden', 'true');

  const water = new TilingSprite({ texture: textureOf(textures, 'tile_73'), width, height });
  const shipLayer = new Container();
  const shotLayer = new Container();
  const effectLayer = new Container();
  app.stage.addChild(water, buildIslands(config, textures), shotLayer, shipLayer, effectLayer);

  const shipViews = Array.from({ length: SHIP_POOL_CAPACITY }, () => {
    const view = createShipView();
    shipLayer.addChild(view.root);
    return view;
  });
  const shotSprites = Array.from({ length: PROJECTILE_POOL_CAPACITY }, () => {
    const sprite = new Sprite(textureOf(textures, 'cannon_ball'));
    sprite.anchor.set(0.5);
    sprite.visible = false;
    shotLayer.addChild(sprite);
    return sprite;
  });
  const effects: Effect[] = Array.from({ length: EFFECT_CAPACITY }, () => {
    const sprite = new Sprite();
    sprite.visible = false;
    effectLayer.addChild(sprite);
    return { sprite, style: EffectStyle.Spark, age: 0, life: 0 };
  });
  const explosionFrames = ['explosion_3', 'explosion_2', 'explosion_1'].map((name) =>
    textureOf(textures, name),
  );

  function startEffect(style: EffectStyle, x: number, y: number, rotation: number): void {
    const effect = effects.find(({ sprite }) => !sprite.visible);
    if (effect === undefined) {
      return;
    }
    effect.style = style;
    effect.age = 0;
    effect.sprite.visible = true;
    effect.sprite.alpha = 1;
    effect.sprite.position.set(x, y);
    effect.sprite.rotation = rotation;
    if (style === EffectStyle.MuzzleFlash) {
      effect.life = 0.12;
      effect.sprite.texture = textureOf(textures, 'fire_1');
      effect.sprite.anchor.set(0.5, 1);
      effect.sprite.scale.set(0.8);
    } else if (style === EffectStyle.Explosion) {
      effect.life = 0.45;
      effect.sprite.texture = explosionFrames[0] ?? effect.sprite.texture;
      effect.sprite.anchor.set(0.5);
      effect.sprite.scale.set(1.1);
    } else {
      effect.life = 0.18;
      effect.sprite.texture = textureOf(textures, 'explosion_3');
      effect.sprite.anchor.set(0.5);
      effect.sprite.scale.set(0.5);
    }
  }

  function advanceEffects(elapsedSeconds: number): void {
    for (const effect of effects) {
      if (effect.sprite.visible) {
        effect.age += elapsedSeconds;
        const progress = effect.age / effect.life;
        if (progress >= 1) {
          effect.sprite.visible = false;
        } else {
          effect.sprite.alpha = progress < 0.6 ? 1 : (1 - progress) / 0.4;
          if (effect.style === EffectStyle.Explosion) {
            const frame = Math.min(explosionFrames.length - 1, Math.floor(progress * 3));
            effect.sprite.texture = explosionFrames[frame] ?? effect.sprite.texture;
          }
        }
      }
    }
  }

  function flashNearestShip(event: GameEvent, world: World): void {
    let nearest = -1;
    let nearestDistance = Infinity;
    world.ships.slots.forEach((ship, index) => {
      if (ship.active && ship.layer === event.layer) {
        const distance = (ship.x - event.x) ** 2 + (ship.y - event.y) ** 2;
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = index;
        }
      }
    });
    const view = shipViews[nearest];
    if (view !== undefined) {
      view.flashSeconds = FLASH_SECONDS;
    }
  }

  function drawShip(ship: Ship, view: ShipView, alpha: number, elapsedSeconds: number): void {
    view.root.visible = ship.active;
    if (!ship.active) {
      view.shownKind = null;
      return;
    }
    view.root.position.set(
      ship.previousX + (ship.x - ship.previousX) * alpha,
      ship.previousY + (ship.y - ship.previousY) * alpha,
    );
    const kind = ship.kind ?? ShipKind.Chaser;
    const band = damageBand(ship);
    if (kind !== view.shownKind || band !== view.shownBand) {
      const frame = SHIP_FRAMES[kind]?.[band] ?? 1;
      view.hull.texture = textureOf(textures, `ship_${String(frame)}`);
      view.hull.scale.set((ship.radius * HULL_LENGTH_IN_RADII) / view.hull.texture.height);
      view.shownKind = kind;
      view.shownBand = band;
      view.shownHealth = -1;
    }
    view.hull.rotation =
      (ship.heading / HEADING_UNITS_PER_TURN) * Math.PI * 2 - SPRITE_FACES_DOWN;
    view.flashSeconds = Math.max(0, view.flashSeconds - elapsedSeconds);
    view.hull.tint = view.flashSeconds > 0 ? HIT_TINT : PLAIN_TINT;
    if (ship.health !== view.shownHealth) {
      const ratio = ship.maxHealth > 0 ? ship.health / ship.maxHealth : 0;
      const left = -HEALTH_BAR_WIDTH / 2;
      const top = -ship.radius - HEALTH_BAR_GAP - HEALTH_BAR_HEIGHT;
      view.bar
        .clear()
        .rect(left - 1, top - 1, HEALTH_BAR_WIDTH + 2, HEALTH_BAR_HEIGHT + 2)
        .fill({ color: 0x1b1b1b, alpha: 0.75 })
        .rect(left, top, HEALTH_BAR_WIDTH * ratio, HEALTH_BAR_HEIGHT)
        .fill({ color: healthColor(ratio) });
      view.shownHealth = ship.health;
    }
  }

  return {
    canvas: app.canvas,
    onFrame(callback) {
      app.ticker.add(callback);
    },
    react(event, world) {
      if (event.kind === EventKind.ShotFired) {
        const rotation = Math.atan2(event.directionY, event.directionX) + SPRITE_FACES_DOWN;
        startEffect(EffectStyle.MuzzleFlash, event.x, event.y, rotation);
      } else if (event.kind === EventKind.Hit) {
        startEffect(EffectStyle.Spark, event.x, event.y, 0);
        flashNearestShip(event, world);
      } else {
        startEffect(EffectStyle.Explosion, event.x, event.y, 0);
      }
    },
    draw(world, alpha, elapsedSeconds) {
      water.tilePosition.x += WATER_DRIFT * elapsedSeconds;
      water.tilePosition.y += (WATER_DRIFT / 2) * elapsedSeconds;
      world.ships.slots.forEach((ship, index) => {
        const view = shipViews[index];
        if (view !== undefined) {
          drawShip(ship, view, alpha, elapsedSeconds);
        }
      });
      world.projectiles.slots.forEach((projectile, index) => {
        const sprite = shotSprites[index];
        if (sprite !== undefined) {
          sprite.visible = projectile.active;
          if (projectile.active) {
            sprite.position.set(
              projectile.previousX + (projectile.x - projectile.previousX) * alpha,
              projectile.previousY + (projectile.y - projectile.previousY) * alpha,
            );
            sprite.scale.set((projectile.radius * 2) / sprite.texture.width);
            sprite.tint = projectile.layer === Layer.EnemyShot ? ENEMY_SHOT_TINT : PLAIN_TINT;
          }
        }
      });
      advanceEffects(elapsedSeconds);
    },
    destroy() {
      app.destroy({ removeView: true }, { children: true, texture: false });
    },
  };
}
