import { Room, Ship, Winner } from '../types.js';

export const reg = (name: string, index: number, err: Error | null) => {
  return JSON.stringify({
    type: 'reg',
    data: JSON.stringify({
      name,
      index,
      error: err ? true : false,
      errorText: err ? err.message : '',
    }),
    id: 0,
  });
};

export const updateWinners = (winners: Winner[]) => {
  return JSON.stringify({
    type: 'update_winners',
    data: JSON.stringify(winners),
    id: 0,
  });
};

export const updateRoom = (rooms: Room[]) => {
  return JSON.stringify({
    type: 'update_room',
    data: JSON.stringify(rooms),
    id: 0,
  });
};

export const createGame = (idGame: number, idPlayer: number) => {
  return JSON.stringify({
    type: 'create_game', // send for both players in the room
    data: JSON.stringify({
      idGame,
      idPlayer, // id for player in the game session, who have sent add_user_to_room request, not enemy
    }),
    id: 0,
  });
};

export const startGame = (ships: Ship[], currentPlayerIndex: number) => {
  return JSON.stringify({
    type: 'start_game',
    data: JSON.stringify({
      ships,
      currentPlayerIndex, // id of the player in the current game session, who have sent his ships
    }),
    id: 0,
  });
};

export const attack = (
  position: { x: number; y: number },
  currentPlayer: number,
  status: 'miss' | 'killed' | 'shot',
) => {
  return JSON.stringify({
    type: 'attack',
    data: JSON.stringify({
      position,
      currentPlayer, // id of the player in the current game session
      status,
    }),
    id: 0,
  });
};

export const turn = (currentPlayer: number) => {
  return JSON.stringify({
    type: 'turn',
    data: JSON.stringify({ currentPlayer }), // id of the player in the current game session
    id: 0,
  });
};

export const finish = (winPlayer: number) => {
  return JSON.stringify({
    type: 'finish',
    data: JSON.stringify({ winPlayer }), // id of the player in the current game session
    id: 0,
  });
};
