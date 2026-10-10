export default function Grid({ map, status, target, onPick }) {
  const cols = map.grid[0].length;
  const routeKeys = new Set((status?.route || []).map((p) => `${p.row},${p.col}`));
  const robot = status?.position;

  return (
    <div
      className="arena"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      role="grid"
      aria-label="Arena map"
    >
      {map.grid.flatMap((row, r) =>
        row.map((cell, c) => {
          const k = `${r},${c}`;
          const isStart = map.start.row === r && map.start.col === c;
          const isTarget = target && target.row === r && target.col === c;
          const hasRobot = robot && robot.row === r && robot.col === c;
          const cls = [
            'cell',
            cell === 1 && 'wall',
            routeKeys.has(k) && 'route',
            isStart && 'start',
            isTarget && 'target',
          ].filter(Boolean).join(' ');
          return (
            <button
              key={k}
              className={cls}
              onClick={() => onPick(r, c)}
              aria-label={`Row ${r + 1}, column ${c + 1}${cell === 1 ? ', wall' : ''}`}
            >
              {hasRobot && (
                <span className="robot" style={{ transform: `rotate(${status.heading}deg)` }}>
                  <svg viewBox="0 0 24 24" width="70%" height="70%">
                    <path d="M12 2 L20 20 L12 16 L4 20 Z" fill="currentColor" />
                  </svg>
                </span>
              )}
            </button>
          );
        })
      )}
    </div>
  );
}
