import { readJson, writeJson } from '../../storage/localJson';

const MUTED_KEY = 'pirate-battle.muted';
const VOICES_PER_SOUND = 4;
const VOLUME = 0.4;

export type SoundName = 'cannon' | 'broadside' | 'hit' | 'explosion' | 'victory' | 'defeat';

const FILES: Readonly<Record<SoundName, string>> = {
  cannon: 'cannon_fire_1',
  broadside: 'cannon_broadside',
  hit: 'ship_wood_hit_1',
  explosion: 'ship_explosion_1',
  victory: 'game_complete',
  defeat: 'game_over',
};

export interface Sounds {
  play: (name: SoundName) => void;
  setMuted: (muted: boolean) => void;
}

export function loadMuted(): boolean {
  return readJson(MUTED_KEY) === true;
}

export function createSounds(silent: boolean): Sounds {
  const base = `${import.meta.env.BASE_URL}assets/sounds/`;
  const voices = new Map<SoundName, HTMLAudioElement[]>();
  let muted = loadMuted();
  let turn = 0;

  return {
    play: (name) => {
      if (silent || muted) {
        return;
      }
      let pool = voices.get(name);
      if (pool === undefined) {
        pool = Array.from({ length: VOICES_PER_SOUND }, () => {
          const voice = new Audio(`${base}${FILES[name]}.wav`);
          voice.volume = VOLUME;
          return voice;
        });
        voices.set(name, pool);
      }
      turn = (turn + 1) % VOICES_PER_SOUND;
      const voice = pool[turn];
      if (voice !== undefined) {
        voice.currentTime = 0;
        void voice.play().catch(() => undefined);
      }
    },
    setMuted: (value) => {
      muted = value;
      writeJson(MUTED_KEY, value);
    },
  };
}
