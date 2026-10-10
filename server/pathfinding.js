// Headings: 0 = up/north, 90 = right, 180 = down, 270 = left
export const DIRS = {
  0: { dr: -1, dc: 0 },
  90: { dr: 0, dc: 1 },
  180: { dr: 1, dc: 0 },
  270: { dr: 0, dc: -1 },
};

const key = (r, c) => `${r},${c}`;

// A* with Manhattan heuristic, 4-direction movement. Returns [{row,col}...] or null.
export function aStar(grid, start, goal) {
  const rows = grid.length, cols = grid[0].length;
  const h = (r, c) => Math.abs(r - goal.row) + Math.abs(c - goal.col);
  const open = [{ r: start.row, c: start.col, g: 0, f: h(start.row, start.col) }];
  const best = new Map([[key(start.row, start.col), 0]]);
  const from = new Map();

  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift();
    if (cur.r === goal.row && cur.c === goal.col) {
      const path = [{ row: cur.r, col: cur.c }];
      let k = key(cur.r, cur.c);
      while (from.has(k)) {
        const p = from.get(k);
        path.unshift({ row: p.r, col: p.c });
        k = key(p.r, p.c);
      }
      return path;
    }
    for (const { dr, dc } of Object.values(DIRS)) {
      const nr = cur.r + dr, nc = cur.c + dc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols || grid[nr][nc] === 1) continue;
      const g = cur.g + 1;
      const nk = key(nr, nc);
      if (g < (best.get(nk) ?? Infinity)) {
        best.set(nk, g);
        from.set(nk, { r: cur.r, c: cur.c });
        open.push({ r: nr, c: nc, g, f: g + h(nr, nc) });
      }
    }
  }
  return null;
}

// Turn a path into steps: [{ cmd: 'F80', type: 'F', cells: 2 } | { cmd: 'R90', type: 'T', turn: 90 }]
export function buildSteps(path, startHeading, cellCm) {
  const steps = [];
  let heading = startHeading;
  let run = 0;
  const flush = () => {
    if (run > 0) steps.push({ cmd: `F${run * cellCm}`, type: 'F', cells: run });
    run = 0;
  };
  for (let i = 1; i < path.length; i++) {
    const dr = path[i].row - path[i - 1].row;
    const dc = path[i].col - path[i - 1].col;
    const want = Number(Object.keys(DIRS).find((d) => DIRS[d].dr === dr && DIRS[d].dc === dc));
    const diff = (want - heading + 360) % 360;
    if (diff !== 0) {
      flush();
      if (diff === 90) steps.push({ cmd: 'R90', type: 'T', turn: 90 });
      else if (diff === 270) steps.push({ cmd: 'L90', type: 'T', turn: 270 });
      else steps.push({ cmd: 'R180', type: 'T', turn: 180 });
      heading = want;
    }
    run++;
  }
  flush();
  return steps;
}
