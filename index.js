import { httpServer } from './src/http_server/index.js';
import { WebSocketServer } from 'ws';
import createMatrix from './src/wss/createMatrix.js';
import { regResponse, getWinners, updateRoom, createGameRes, startGameRes } from './src/wss/responses.js';

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
    console.log('onMessage', message);

    switch (message.type) {
      case 'reg':
        message.data = JSON.parse(message.data);
        name = message.data.name;
        let response;
        if (Object.keys(users).includes(name)) {
          response = regResponse(
            name,
            users.name.index,
            users.name.password === message.data.password ? null : Error('Invalid login or password'),
          );
        } else {
          wsId = Math.random();
          users.name = { index: wsId, password: message.data.password };
          response = regResponse(name, wsId);
        }
        for (let client of wss.clients) {
          client.send(response);
          client.send(updateRoom(rooms));
          client.send(getWinners(winners));
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
        message.data = JSON.parse(message.data);
        const room = rooms.filter((room) => room.roomId === message.data.indexRoom);
        room[0].roomUsers.push({ name, index: wsId });
        for (let client of wss.clients) {
          client.send(updateRoom(rooms));
        }
        ws.send(createGameRes(message.data.indexRoom, wsId));
        break;
      case 'add_ships':
        message.data = JSON.parse(message.data);
        games[message.data.gameId][message.data.indexPlayer] = {
          matrix: createMatrix(message.data.ships),
          startPosition: message.data.ships,
          shipsAmount: 10,
        };
        if (Object.keys(games[message.data.gameId]).length === 2) {
          // console.log('wss clients', wss.clients);
          ws.send(startGameRes(message.data.ships, wsId));
          console.log('start game', startGameRes(message.data.ships, wsId));
        }
        break;
      case 'default':
        console.log('мимо');
    }
  });

  ws.on('close', function () {
    console.log('Connection was closed');
  });

  ws.on('error', console.error);
});
