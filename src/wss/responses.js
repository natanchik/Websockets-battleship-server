export const regResponse = (name, index, err) => {
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

export const getWinners = (winners) => {
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

export const createGameRes = (idGame, idPlayer) => {
  return JSON.stringify({
    type: 'create_game', //send for both players in the room
    data: JSON.stringify({
      idGame,
      idPlayer, // id for player in the game session, who have sent add_user_to_room request, not enemy
    }),
    id: 0,
  });
};

export const startGameRes = (ships, currentPlayerIndex) => {
  return JSON.stringify({
    type: 'start_game',
    data: {
      ships: JSON.stringify(ships),
      currentPlayerIndex, // : <number>, /* id of the player in the current game session, who have sent his ships */
    },
    id: 0,
  });
};
