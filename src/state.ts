import { KeyColour } from './rooms';

/** What carries from room to room (and from level to level). Lives, the score, the pocket. */
export interface GameState {
  score: number;
  lives: number;
  level: number;
  jewels: number;
  hasSword: boolean;
  /** The rooms of this run that Joe has already emptied, so they come back when he dies in them. */
  keys: Record<KeyColour, number>;
  /** Up to five carried things; jewels are counted on their own. */
  pack: string[];
  nextExtraLife: number;
}

export function freshState(): GameState {
  return { score: 0, lives: 3, level: 1, jewels: 0, hasSword: false, keys: { gold: 0, silver: 0, red: 0 }, pack: [], nextExtraLife: 10000 };
}

export const state: GameState = freshState();

export function resetState() {
  Object.assign(state, freshState());
}