import { httpServer } from './src/http_server/index.js';
import { WebSocketServer } from 'ws';
import createMatrix from './src/wss/createMatrix.js';
import { reg, updateWinners, updateRoom, createGame, startGame, attack, turn, finish } from './src/wss/responses.js';
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
            shipsAmount: 10,
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
          shipsAmount: 10,
        };

        // Determine how many players (or bot+player) are ready in this game
        const readyPlayers = Object.keys(games[data.gameId] || {}).length;

        // Start the game only when two players (or player+bot) are present
        if (readyPlayers === 2) {
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
          // Not all players ready yet — inform the submitting client that ships were received
          if (wsId !== null) {
            ws.send(startGame(data.ships, wsId as number));
          } else {
            console.error('wsId is null when starting game');
          }
        }
        break;
      }

      case 'attack': {
        const enemyIndex = Object.keys(games[data.gameId]).filter((el) => el != data.indexPlayer)[0];
        if (turns[data.gameId] === data.indexPlayer) {
          const status = takeTurn(games[data.gameId][enemyIndex].matrix, data.x, data.y);
          if (status === 'miss') {
            turns[data.gameId] = +enemyIndex;
          }
          if (status === 'killed') {
            games[data.gameId][data.indexPlayer].shipsAmount--;
          }
          for (let client of wss.clients) {
            client.send(attack({ x: data.x, y: data.y }, data.indexPlayer, status));
          }
        }

        // broadcast whose turn it is (use gameId)
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
    }
  });

  ws.on('close', function () {
    console.log('Connection was closed');
  });

  ws.on('error', console.error);
});
