import { httpServer } from './src/http_server/index.js';
import { WebSocketServer } from 'ws';
// import { randomUUID } from 'crypto';

const HTTP_PORT = 8181;
console.log(`Start static http server on the ${HTTP_PORT} port!`);
httpServer.listen(HTTP_PORT);

const wss = new WebSocketServer({ port: 3000 });
const db = {}; // id: { name: 'userName', password: 'userPassword' }

const regResponse = (name, err) => {
  return {
    type: 'reg',
    data: {
      name,
      index: 0,
      error: err ? true : false,
      errorText: err ? err.message : '',
    },
    id: 0,
  };
};

wss.on('connection', function connection(ws) {
  console.log('Websocket server started on the 3030 port!');

  ws.on('message', function (message) {
    message = JSON.parse(message.toString('utf8'));
    message.data = JSON.parse(message.data);
    console.log('onMessage', message);
    switch (message.type) {
      case 'reg':
        let response;
        if (Object.keys(db).includes(message.id)) {
          response =
            JSON.stringify(db[message.id]) === JSON.stringify(db.message.data)
              ? regResponse(db[message.id].name)
              : regResponse(db[message.id].name, Error('Invalid login or password'));
        } else {
          db[message.id] = message.data;
          response = regResponse(message.data.name);
        }
        for (let client of wss.clients) {
          response.data = JSON.stringify(response.data);
          client.send(JSON.stringify(response));
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
