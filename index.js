import { httpServer } from './src/http_server/index.js';
import { WebSocketServer } from 'ws';
import createMatrix from './src/wss/createMatrix.js';
import { reg, updateWinners, updateRoom, createGame, startGame, attack, turn, finish } from './src/wss/responses.js';
import takeTurn from './src/wss/takeTurn.js';

const HTTP_PORT = 8181;
console.log(`Start static http server on the ${HTTP_PORT} port!`);
httpServer.listen(HTTP_PORT);

const wss = new WebSocketServer({ port: 3000 });
const users = {}; // name: { index, password }
const rooms = []; // {roomId: <number>, roomUsers: [{name: <string>, index: <number>}] }
const winners = []; // { name: string, wins: number }
const games = {}; // idGame: {idPlayer1: {matrix: [], start: {}, shipsAmount: 10}, idPlayer2: {matrix: [], startPosition: {}, , shipsAmount: 10}}
// matrix: direction: true, y - vertical, false, x - horizontal; c 0 до 9; sizes: 1-4
// {"position":{"x":7,"y":4},"direction":true,"type":"medium","length":2}

wss.on('connection', function connection(ws) {
  let wsId = null;
  let name = '';
  console.log('Websocket server started on the 3030 port!');

  ws.on('message', function (message) {
    message = JSON.parse(message.toString('utf8'));
    let data;

    switch (message.type) {
      case 'reg':
        data = JSON.parse(message.data);
        name = data.name;
        let response;
        if (Object.keys(users).includes(name)) {
          response = reg(
            name,
            users.name.index,
            users.name.password === data.password ? null : Error('Invalid login or password'),
          );
        } else {
          wsId = Math.random();
          users.name = { index: wsId, password: data.password };
          response = reg(name, wsId);
        }
        ws.send(response);
        for (let client of wss.clients) {
          client.send(updateRoom(rooms));
          client.send(updateWinners(winners));
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
        data = JSON.parse(message.data);
        const room = rooms.filter((room) => room.roomId === data.indexRoom);
        room[0].roomUsers.push({ name, index: wsId });
        for (let client of wss.clients) {
          client.send(updateRoom(rooms));
        }
        ws.send(createGame(data.indexRoom, wsId));
        break;
      case 'add_ships':
        data = JSON.parse(message.data);
        games[data.gameId][data.indexPlayer] = {
          matrix: createMatrix(data.ships),
          startPosition: data.ships,
          shipsAmount: 10,
        };
        // if (Object.keys(games[message.data.gameId]).length === 2) {
        ws.send(startGame(data.ships, wsId));
        ws.send(turn(+Object.keys(games[data.gameId])[0]));
        // }
        break;
      case 'attack':
        data = JSON.parse(message.data);
        const enemyIndex = Object.keys(games[data.gameId]).filter((el) => el != data.indexPlayer)[0];
        const status = takeTurn(games[data.gameId][enemyIndex].matrix, data.x, data.y);
        if (status === 'killed') {
          games[data.gameId][data.indexPlayer].shipsAmount--;
        }
        for (let client of wss.clients) {
          client.send(attack({ x: data.x, y: data.y }, data.indexPlayer, status));
          client.send(turn(enemyIndex));
        }
        break;
    }
  });

  ws.on('close', function () {
    console.log('Connection was closed');
  });

  ws.on('error', console.error);
});
