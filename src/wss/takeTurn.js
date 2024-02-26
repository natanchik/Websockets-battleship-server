export default function takeTurn(matrix, x, y) {
  // let status = ['shot'];
  const info = { status: 'shot', counter: 0, cells: [] }; // "miss"|"killed"|"shot"

  // если не попал, внутри 0:
  if (!matrix[y][x]) {
    info.status = 'miss';
    // если попал:
  } else {
    if (matrix[y][x] === 1) {
      info.status = 'killed';
    } else {
      info.counter = matrix[y][x] - 1;
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

function checkAround(matrix, x, y, info) {
  const coordinates = [
    [y + 1, x],
    [y, x + 1],
    [y - 1, x],
    [y, x - 1],
  ];

  for (let el of coordinates) {
    if (matrix[el[0]] && matrix[el[0]][el[1]]) {
      if ([2, 3, 4].includes(matrix[el[0]][el[1]])) {
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
