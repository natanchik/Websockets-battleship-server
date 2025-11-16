import createMatrix from './createMatrix.js';
import takeTurn from './takeTurn.js';
import { Ship } from '../types.js';

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function canPlace(ships: Ship[], x: number, y: number, len: number, dir: boolean) {
  for (let i = 0; i < len; i++) {
    const px = dir ? x : x + i;
    const py = dir ? y + i : y;
    if (px < 0 || px > 9 || py < 0 || py > 9) return false;
    for (let s of ships) {
      const sx = s.position.x;
      const sy = s.position.y;
      const sl = s.length;
      const sdir = s.direction;
      for (let j = 0; j < sl; j++) {
        const spx = sdir ? sx : sx + j;
        const spy = sdir ? sy + j : sy;
        if (spx === px && spy === py) return false;
      }
    }
  }
  return true;
}

export function generateBotShips(): Ship[] {
  // Standard fleet: 1x4, 2x3, 3x2, 4x1 = 10 ships
  const lengths = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];
  const ships: Ship[] = [];

  for (let len of lengths) {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 500) {
      attempts++;
      const dir = Math.random() >= 0.5; // true = vertical
      const x = randInt(0, 9);
      const y = randInt(0, 9);
      const startX = dir ? x : x;
      const startY = dir ? y : y;
      if (canPlace(ships, startX, startY, len, dir)) {
        const sizeType = len === 4 ? 'huge' : len === 3 ? 'large' : len === 2 ? 'medium' : 'small';
        ships.push({ position: { x: startX, y: startY }, direction: dir, length: len, type: sizeType });
        placed = true;
      }
    }
    if (!placed) {
      // fallback: place at (0,0) horizontally if random placement fails
      const sizeType = len === 4 ? 'huge' : len === 3 ? 'large' : len === 2 ? 'medium' : 'small';
      ships.push({ position: { x: 0, y: 0 }, direction: false, length: len, type: sizeType });
    }
  }

  return ships;
}

export function botMakeMove(
  gameId: string | number,
  botIndex: string | number,
  games: { [idGame: string]: { [idPlayer: string]: any } },
  wss: any,
  responses: any,
  turns: { [idGame: string]: number },
) {
  const opponentIndex = Object.keys(games[gameId]).filter((el) => el != botIndex)[0];
  if (!opponentIndex) return;

  const opponentMatrix = games[gameId][opponentIndex].matrix;

  // choose random unshot cell
  let x = randInt(0, 9);
  let y = randInt(0, 9);
  let attempts = 0;
  while ((opponentMatrix[y][x] === '/' || opponentMatrix[y][x] === 'X') && attempts < 200) {
    x = randInt(0, 9);
    y = randInt(0, 9);
    attempts++;
  }

  const status = takeTurn(opponentMatrix, x, y);

  if (status === 'miss') {
    // ensure we use string keys for the turns map
    turns[String(gameId)] = +opponentIndex;
  }
  if (status === 'killed') {
    // decrement opponent ship count (enemy lost a ship)
    if (games[gameId][opponentIndex] && typeof games[gameId][opponentIndex].shipsAmount === 'number') {
      games[gameId][opponentIndex].shipsAmount--;
    }
  }

  // broadcast attack
  for (let client of wss.clients) {
    client.send(responses.attack({ x, y }, botIndex, status));
  }

  // send turn info
  for (let client of wss.clients) {
    client.send(responses.turn(turns[String(gameId)]));
  }

  // if killed, bot should attack again (simple immediate recursion)
  if (status === 'killed') {
    // small timeout to avoid blocking
    setTimeout(() => botMakeMove(gameId, botIndex, games, wss, responses, turns), 200);
  }
}

export function prepareBotForGame(games: any, gameId: string | number, botId?: string | number) {
  const ships = generateBotShips();
  games[gameId] = games[gameId] || {};
  // Use provided botId if passed (so room/users and games use the same index),
  // otherwise generate a new random index (legacy behaviour).
  const botIndex = botId !== undefined ? botId : Math.random();
  games[gameId][botIndex] = {
    matrix: createMatrix(ships),
    startPosition: ships,
    shipsAmount: 10,
  };
  return { botIndex, ships };
}
