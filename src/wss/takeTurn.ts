export default function takeTurn(matrix: (number | string)[][], x: number, y: number) {
  const info: { status: 'miss' | 'killed' | 'shot'; counter: number; cells: string[] } = {
    status: 'shot',
    counter: 0,
    cells: [],
  };

  // if miss - 0:
  if (!matrix[y][x]) {
    info.status = 'miss';
    // if already shot: '/' - shot, 'X' - killed:
  } else if (matrix[y][x] === '/' || matrix[y][x] === 'X') {
    // Already shot, treat as miss
    info.status = 'miss';
  } else {
    // Ship cell hit (number 1-4)
    if (matrix[y][x] === 1) {
      // Single cell ship - immediately killed
      info.status = 'killed';
      matrix[y][x] = 'X';
    } else {
      // Multi-cell ship - mark cell as shot and check if ship is killed
      info.counter = Number(matrix[y][x]) - 1;
      matrix[y][x] = '/';
      info.cells.push(`${y}-${x}`);
      checkAround(matrix, x, y, info);

      // If all cells of this ship are now destroyed, mark them all as 'X'
      if (info.status === 'killed') {
        for (const cell of info.cells) {
          const [cy, cx] = cell.split('-').map(Number);
          matrix[cy][cx] = 'X';
        }
      }
    }
  }
  return info.status;
}

function checkAround(
  matrix: (number | string)[][],
  x: number,
  y: number,
  info: { status: 'miss' | 'killed' | 'shot'; counter: number; cells: string[] },
) {
  const coordinates = [
    [y + 1, x],
    [y, x + 1],
    [y - 1, x],
    [y, x - 1],
  ];

  for (let el of coordinates) {
    const checkY = el[0];
    const checkX = el[1];

    if (matrix[checkY] && matrix[checkY][checkX] !== undefined) {
      const cellValue = matrix[checkY][checkX];
      // Skip if it's an unshot ship cell (numbers 2, 3, 4) - means ship is not fully destroyed
      if ([2, 3, 4].includes(Number(cellValue))) {
        return;
      }
      // If it's a shot cell ('/'), check if we've already recorded it
      if (cellValue === '/') {
        if (!info.cells.includes(`${checkY}-${checkX}`)) {
          info.cells.push(`${checkY}-${checkX}`);
          --info.counter;
          if (info.counter === 0) {
            info.status = 'killed';
            return;
          }
          checkAround(matrix, checkX, checkY, info);
        }
      }
    }
  }
}
