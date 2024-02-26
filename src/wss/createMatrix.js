export default function createMatrix(ships) {
  const matrix = Array(10)
    .fill()
    .map(() => Array(10).fill(0));

  ships.forEach((el) => {
    const x = el.position.x;
    const y = el.position.y;
    for (let i = 0; i < el.length; i++) {
      el.direction ? (matrix[y + i][x] = el.length) : (matrix[y][x + i] = el.length);
    }
  });
  return matrix;
}
