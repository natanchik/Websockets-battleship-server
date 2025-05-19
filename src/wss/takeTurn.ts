export default function takeTurn(matrix: (number | string)[][], x: number, y: number) {
  const info: { status: 'miss' | 'killed' | 'shot'; counter: number; cells: string[] } = {
    status: 'shot',
    counter: 0,
    cells: [],
  };

  // if miss - 0:
  if (!matrix[y][x]) {
    info.status = 'miss';
    // if hit: '/' - shot, 'X' - killed:
  } else {
    if (matrix[y][x] === 1) {
      info.status = 'killed';
    } else {
      info.counter = Number(matrix[y][x]) - 1;
      matrix[y][x] = '/';
      info.cells.push(`${y}-${x}`);
      checkAround(matrix, x, y, info);
    }

    if (info.status === 'killed') {
      matrix[y][x] = 'X';
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
    if (matrix[el[0]] && matrix[el[0]][el[1]]) {
      if ([2, 3, 4].includes(Number(matrix[el[0]][el[1]]))) {
        return;
      } else {
        if (matrix[el[0]][el[1]] === '/') {
          if (!info.cells.includes(`${el[0]}-${el[1]}`)) {
            info.cells.push(`${el[0]}-${el[1]}`);
            --info.counter;
            if (info.counter === 0) {
              info.status = 'killed';
              return;
            }
            checkAround(matrix, el[0], el[1], info);
          }
        }
      }
    }
  }
}
