import { httpServer } from './src/http_server/index.js';
import { WebSocketServer } from 'ws';
import createMatrix from './src/wss/createMatrix.js';
import {
  reg,
  updateWinners,
  updateRoom,
  createGame,
  startGame,
  attack,
  turn,
  finish,
  randomAttack,
} from './src/wss/responses.js';
import takeTurn from './src/wss/takeTurn.js';
import { prepareBotForGame, botMakeMove, generateBotShips } from './src/wss/bot.js';
import { User, Room, GamePlayer, Winner, Message, Ship } from './src/types.js';

const HTTP_PORT = 8181;
console.log(`Start static http server on the ${HTTP_PORT} port!`);
httpServer.listen(HTTP_PORT);

const wss = new WebSocketServer({ port: 3000 });

const users: { [name: string]: User } = {};
const rooms: Room[] = [];
const winners: Winner[] = [];
const games: { [idGame: string]: { [idPlayer: string]: GamePlayer } } = {};
const turns: { [idGame: number]: number } = {};

wss.on('connection', function connection(ws) {
  let wsId: number | null = null;
  let name = '';
  console.log('Websocket server started on the 3000 port!');

  ws.on('message', function (message) {
    const parsedMessage: Message = JSON.parse(message.toString('utf8'));
    console.log('Received message:', parsedMessage);

    let data: any = parsedMessage.data ? JSON.parse(parsedMessage.data) : {};

    switch (parsedMessage.type) {
      case 'reg':
        if (typeof data.name === 'string' && typeof data.password === 'string') {
          name = data.name;
          let response: string;
          if (Object.keys(users).includes(name)) {
            const user = users[name];
            response = reg(
              name,
              user.index,
              user.password === data.password ? null : Error('Invalid login or password'),
            );
          } else {
            wsId = Math.random();
            users[name] = { index: wsId, password: data.password };
            response = reg(name, wsId, null);
          }
          ws.send(response);
          for (let client of wss.clients) {
            client.send(updateRoom(rooms));
            client.send(updateWinners(winners));
          }
        }
        break;

      case 'create_room': {
        const roomId = Math.random();
        rooms.push({ roomId, roomUsers: [] });
        games[roomId] = {};
        for (let client of wss.clients) {
          client.send(updateRoom(rooms));
        }
        break;
      }

      case 'single_play': {
        // Create a new room, add the current player and a bot, prepare bot game state
        if (wsId === null) {
          console.error('wsId is null when creating room with bot');
          break;
        }
        const newRoomId = Math.random();
        rooms.push({ roomId: newRoomId, roomUsers: [] });
        games[newRoomId] = {};
        // add human player
        const humanId = wsId as number;
        rooms[rooms.length - 1].roomUsers.push({ name, index: humanId });
        // create bot and add to users/room
        const newBotId = Math.random();
        users[`Bot_${newBotId}`] = { index: newBotId, password: '' } as User;
        rooms[rooms.length - 1].roomUsers.push({ name: 'Bot', index: newBotId });
        // Prepare bot in games using same bot id
        const preparedBot = prepareBotForGame(games, newRoomId, newBotId);
        if (preparedBot && preparedBot.botIndex && preparedBot.botIndex !== newBotId) {
          // ensure the room entry uses numeric index
          rooms[rooms.length - 1].roomUsers = rooms[rooms.length - 1].roomUsers.map((u) =>
            u.name === 'Bot' ? { name: 'Bot', index: Number(preparedBot.botIndex) } : u,
          );
        }
        // notify clients
        for (let client of wss.clients) {
          client.send(updateRoom(rooms));
        }
        // set initial turn to human player
        turns[newRoomId] = humanId;
        // auto-place player's ships and start the game immediately
        try {
          const playerShips = generateBotShips();
          games[newRoomId][humanId] = {
            matrix: createMatrix(playerShips),
            startPosition: playerShips,
            shipsAmount: playerShips.length,
            shipsKilled: 0,
          };
          // notify player that game started (with their ships)
          ws.send(startGame(playerShips, humanId));
          // notify about whose turn it is
          for (let client of wss.clients) {
            client.send(turn(turns[newRoomId]));
          }

          // if bot is present and it's bot's turn, trigger bot move
          const roomRec = rooms.find((r) => r.roomId === newRoomId);
          if (roomRec) {
            const botUser = roomRec.roomUsers.find((u) => u.name === 'Bot');
            if (botUser) {
              const botIndex = botUser.index;
              if (turns[newRoomId] === botIndex) {
                setTimeout(
                  () =>
                    botMakeMove(
                      newRoomId,
                      botIndex,
                      games,
                      wss,
                      { attack, turn, startGame, createGame, updateRoom, updateWinners, reg, finish },
                      turns,
                    ),
                  200,
                );
              }
            }
          }
        } catch (e) {
          console.error('Error while auto-starting single_play game', e);
        }
        // send create_game to the player who requested single_play
        ws.send(createGame(newRoomId, humanId));
        break;
      }

      case 'add_user_to_room': {
        const room = rooms.filter((room) => room.roomId === data.indexRoom);
        if (wsId !== null) {
          room[0].roomUsers.push({ name, index: wsId });
          for (let client of wss.clients) {
            client.send(updateRoom(rooms));
          }
          if (turns[data.indexRoom] === undefined) {
            turns[data.indexRoom] = wsId as number;
          }
          ws.send(createGame(data.indexRoom, wsId as number));
        } else {
          console.error('wsId is null when adding user to room');
        }
        break;
      }

      case 'add_ships': {
        // store player's ships
        games[data.gameId][data.indexPlayer] = {
          matrix: createMatrix(data.ships),
          startPosition: data.ships,
          shipsAmount: data.ships.length,
          shipsKilled: 0,
        };

        // Get the room for this game
        const room = rooms.find((r) => r.roomId === data.gameId);
        const readyPlayers = Object.keys(games[data.gameId] || {}).length;

        // Start the game only when two players (or player+bot) are present and room has 2 users
        if (readyPlayers === 2 && room && room.roomUsers.length === 2) {
          try {
            // send each player's start_game (broadcast so each client can pick its own by index)
            for (let playerIndex of Object.keys(games[data.gameId])) {
              const pIdx = Number(playerIndex);
              const pShips = games[data.gameId][playerIndex].startPosition;
              for (let client of wss.clients) {
                client.send(startGame(pShips, pIdx));
              }
            }

            // broadcast whose turn it is
            for (let client of wss.clients) {
              client.send(turn(turns[data.gameId]));
            }

            // If bot is present and it's bot's turn, trigger bot move
            const roomRec2 = rooms.find((r) => r.roomId === data.gameId);
            if (roomRec2) {
              const botUser = roomRec2.roomUsers.find((u) => u.name === 'Bot');
              if (botUser) {
                const botIndex = botUser.index;
                if (turns[data.gameId] === botIndex) {
                  setTimeout(
                    () =>
                      botMakeMove(
                        data.gameId,
                        botIndex,
                        games,
                        wss,
                        { attack, turn, startGame, createGame, updateRoom, updateWinners, reg, finish },
                        turns,
                      ),
                    200,
                  );
                }
              }
            }
          } catch (e) {
            console.error('Error while trying to trigger bot move', e);
          }
        } else {
          // Not all players ready yet — don't send startGame to avoid prematurely starting the game
          // The game will only start when both players have sent their ships
          console.log('Waiting for second player to add ships...');
        }
        break;
      }

      case 'attack': {
        // Check if game exists and it's the player's turn
        if (!games[data.gameId] || turns[data.gameId] !== data.indexPlayer) {
          console.error("Invalid attack: game not found or not player's turn");
          break;
        }

        const enemyIndex = Object.keys(games[data.gameId]).filter((el) => el != data.indexPlayer)[0];
        const status = takeTurn(games[data.gameId][enemyIndex].matrix, data.x, data.y);

        // Change turn only on miss
        if (status === 'miss') {
          turns[data.gameId] = +enemyIndex;
        }

        // Increment killed ships counter when ship is killed
        if (status === 'killed') {
          games[data.gameId][enemyIndex].shipsKilled++;
        }

        // Broadcast the attack to all clients
        for (let client of wss.clients) {
          client.send(attack({ x: data.x, y: data.y }, data.indexPlayer, status));
        }

        // Check if game is finished (enemy has all ships killed)
        if (games[data.gameId][enemyIndex].shipsKilled === games[data.gameId][enemyIndex].shipsAmount) {
          // Current player wins - find player name from users
          let winnerName = '';
          for (const [userName, userInfo] of Object.entries(users)) {
            if (userInfo.index === data.indexPlayer) {
              winnerName = userName;
              break;
            }
          }

          if (winnerName) {
            // Find or create winner entry
            const existingWinner = winners.find((w) => w.name === winnerName);
            if (existingWinner) {
              existingWinner.wins++;
            } else {
              winners.push({ name: winnerName, wins: 1 });
            }
            // Notify all clients about winner
            for (let client of wss.clients) {
              client.send(finish(data.indexPlayer));
              client.send(updateWinners(winners));
            }
          }
          // Clean up game
          delete games[data.gameId];
          delete turns[data.gameId];
          return;
        }

        // broadcast whose turn it is
        for (let client of wss.clients) {
          client.send(turn(turns[data.gameId]));
        }

        // If the next turn belongs to a bot, trigger the bot move
        try {
          const roomRec3 = rooms.find((r) => r.roomId === data.gameId);
          if (roomRec3) {
            const botUser = roomRec3.roomUsers.find((u) => u.name === 'Bot');
            if (botUser) {
              const botIndex = botUser.index;
              if (turns[data.gameId] === botIndex) {
                setTimeout(
                  () =>
                    botMakeMove(
                      data.gameId,
                      botIndex,
                      games,
                      wss,
                      { attack, turn, startGame, createGame, updateRoom, updateWinners, reg, finish },
                      turns,
                    ),
                  200,
                );
              }
            }
          }
        } catch (e) {
          console.error('Error while trying to trigger bot move after attack', e);
        }
        break;
      }

      case 'randomAttack': {
        // Verify game and player still exist
        if (!games[data.gameId] || !games[data.gameId][data.indexPlayer]) {
          console.error('Game or player not found for random attack');
          break;
        }

        // Generate random coordinates
        const x = Math.floor(Math.random() * 10);
        const y = Math.floor(Math.random() * 10);

        // Check if game exists and it's the player's turn
        if (!games[data.gameId] || turns[data.gameId] !== data.indexPlayer) {
          console.error("Invalid random attack: game not found or not player's turn");
          break;
        }

        const enemyIndex = Object.keys(games[data.gameId]).filter((el) => el != data.indexPlayer)[0];
        const status = takeTurn(games[data.gameId][enemyIndex].matrix, x, y);

        // Change turn only on miss
        if (status === 'miss') {
          turns[data.gameId] = +enemyIndex;
        }

        // Increment killed ships counter when ship is killed
        if (status === 'killed') {
          games[data.gameId][enemyIndex].shipsKilled++;
        }

        // Broadcast the attack to all clients
        for (let client of wss.clients) {
          client.send(attack({ x, y }, data.indexPlayer, status));
        }

        // Check if game is finished (enemy has all ships killed)
        if (games[data.gameId][enemyIndex].shipsKilled === games[data.gameId][enemyIndex].shipsAmount) {
          // Current player wins - find player name from users
          let winnerName = '';
          for (const [userName, userInfo] of Object.entries(users)) {
            if (userInfo.index === data.indexPlayer) {
              winnerName = userName;
              break;
            }
          }

          if (winnerName) {
            // Find or create winner entry
            const existingWinner = winners.find((w) => w.name === winnerName);
            if (existingWinner) {
              existingWinner.wins++;
            } else {
              winners.push({ name: winnerName, wins: 1 });
            }
            // Notify all clients about winner
            for (let client of wss.clients) {
              client.send(finish(data.indexPlayer));
              client.send(updateWinners(winners));
            }
          }
          // Clean up game
          delete games[data.gameId];
          delete turns[data.gameId];
          break;
        }

        // Broadcast whose turn it is
        for (let client of wss.clients) {
          client.send(turn(turns[data.gameId]));
        }

        // If the next turn belongs to a bot, trigger the bot move
        try {
          const roomRec = rooms.find((r) => r.roomId === data.gameId);
          if (roomRec) {
            const botUser = roomRec.roomUsers.find((u) => u.name === 'Bot');
            if (botUser) {
              const botIndex = botUser.index;
              if (turns[data.gameId] === botIndex) {
                setTimeout(
                  () =>
                    botMakeMove(
                      data.gameId,
                      botIndex,
                      games,
                      wss,
                      { attack, turn, startGame, createGame, updateRoom, updateWinners, reg, finish },
                      turns,
                    ),
                  200,
                );
              }
            }
          }
        } catch (e) {
          console.error('Error while trying to trigger bot move after random attack', e);
        }
        break;
      }
    }
  });

  ws.on('close', function () {
    console.log('Connection was closed');
  });

  ws.on('error', console.error);
});
