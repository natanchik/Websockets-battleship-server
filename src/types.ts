export interface User {
  index: number;
  password: string;
}

export interface RoomUser {
  name: string;
  index: number;
}

export interface Room {
  roomId: number;
  roomUsers: RoomUser[];
}

export type ShipSize = 'small' | 'medium' | 'large' | 'huge';

export interface Ship {
  position: {
    x: number; // from 0 to 9
    y: number; // from 0 to 9
  };
  direction: boolean; // true - y - vertical; false - x - horizontal;
  length: number; // 1-4
  type: ShipSize;
}

export interface GamePlayer {
  matrix: number[][];
  startPosition: Ship[];
  shipsAmount: number; // total number of ships
  shipsKilled: number; // number of ships killed
}

export interface Games {
  [idGame: string]: {
    [idPlayer: string]: GamePlayer;
  };
}

export interface Winner {
  name: string;
  wins: number;
}

type MessageType =
  | 'reg'
  | 'create_room'
  | 'single_play'
  | 'add_user_to_room'
  | 'add_ships'
  | 'update_room'
  | 'update_winners'
  | 'create_game'
  | 'start_game'
  | 'update_game'
  | 'attack'
  | 'randomAttack'
  | 'turn'
  | 'finish';

export interface Message {
  type: MessageType;
  data: string;
  id: 0;
}
