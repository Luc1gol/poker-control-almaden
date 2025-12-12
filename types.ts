export type PaymentStatus = 'PAID' | 'PENDING';

export interface Rebuy {
  id: string;
  amount: number;
  status: PaymentStatus;
  timestamp: number;
}

export interface Player {
  id: string;
  name: string;
  buyInStatus: PaymentStatus;
  rebuys: Rebuy[];
  cashoutAmount?: number; // undefined means active in game
}

export interface GameConfig {
  buyInAmount: number; // The user input value
}

export interface GameState {
  isStarted: boolean;
  config: GameConfig;
  players: Player[];
  finished: boolean;
}

export const HOUSE_FEE_FIXED = 10;