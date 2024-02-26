export const reg = (name, index, err) => {
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

export const updateWinners = (winners) => {
  return JSON.stringify({
    type: 'update_winners',
    data: JSON.stringify(winners),
    id: 0,
  });
};

export const updateRoom = (rooms) => {
  return JSON.stringify({
    type: 'update_room',
    data: JSON.stringify(rooms),
    id: 0,
  });
};

export const createGame = (idGame, idPlayer) => {
  return JSON.stringify({
    type: 'create_game', //send for both players in the room
    data: JSON.stringify({
      idGame,
      idPlayer, // id for player in the game session, who have sent add_user_to_room request, not enemy
    }),
    id: 0,
  });
};

export const startGame = (ships, currentPlayerIndex) => {
  return JSON.stringify({
    type: 'start_game',
    data: {
      ships: JSON.stringify(ships),
      currentPlayerIndex, // : <number>, /* id of the player in the current game session, who have sent his ships */
    },
    id: 0,
  });
};

export const attack = (position, currentPlayer, status) => {
  return JSON.stringify({
    type: 'attack',
    data: JSON.stringify({
      position, //: { x: <number>, y: <number> },
      currentPlayer, //: <number>, id of the player in the current game session
      status, //: "miss"|"killed"|"shot",
    }),
    id: 0,
  });
};

export const turn = (currentPlayer) => {
  return JSON.stringify({
    type: 'turn',
    data: JSON.stringify({ currentPlayer }), //: <number>, /* id of the player in the current game session */
    id: 0,
  });
};

export const finish = (winPlayer) => {
  return JSON.stringify({
    type: 'finish',
    data: JSON.stringify({ winPlayer }), // : <number>, id of the player in the current game session
    id: 0,
  });
};
