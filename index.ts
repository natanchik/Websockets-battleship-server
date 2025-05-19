import { httpServer } from './src/http_server/index.js';
import { WebSocketServer } from 'ws';
import createMatrix from './src/wss/createMatrix.js';
import { reg, updateWinners, updateRoom, createGame, startGame, attack, turn, finish } from './src/wss/responses.js';
import takeTurn from './src/wss/takeTurn.js';
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
      case 'create_room':
        const roomId = Math.random();
        rooms.push({ roomId, roomUsers: [] });
        games[roomId] = {};
        for (let client of wss.clients) {
          client.send(updateRoom(rooms));
        }
        break;
      case 'add_user_to_room':
        const room = rooms.filter((room) => room.roomId === data.indexRoom);
        if (wsId !== null) {
          room[0].roomUsers.push({ name, index: wsId });
          for (let client of wss.clients) {
            client.send(updateRoom(rooms));
          }
          if (turns[data.indexRoom] === undefined) {
            turns[data.indexRoom] = wsId;
          }
          ws.send(createGame(data.indexRoom, wsId));
        } else {
          console.error('wsId is null when adding user to room');
        }
        break;
      case 'add_ships':
        games[data.gameId][data.indexPlayer] = {
          matrix: createMatrix(data.ships),
          startPosition: data.ships,
          shipsAmount: 10,
        };
        if (wsId !== null) {
          ws.send(startGame(data.ships, wsId));
        } else {
          console.error('wsId is null when starting game');
        }
        // if (Object.keys(games[parsedMessage.data.gameId]).length === 2) {
        ws.send(turn(turns[data.indexRoom]));
        // }
        break;
      case 'attack':
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
        for (let client of wss.clients) {
          client.send(turn(turns[data.indexRoom]));
        }
        break;
    }
  });

  ws.on('close', function () {
    console.log('Connection was closed');
  });

  ws.on('error', console.error);
});
