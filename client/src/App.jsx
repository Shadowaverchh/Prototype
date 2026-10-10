import { useEffect, useState } from 'react';
import { api } from './api.js';
import Grid from './Grid.jsx';

const LABEL = {
  idle: 'Ready',
  driving: 'Driving',
  arrived: 'Arrived',
  stopped: 'Stopped',
  blocked: 'Blocked',
};

export default function App() {
  const [map, setMap] = useState(null);
  const [status, setStatus] = useState(null);
  const [target, setTarget] = useState(null);
  const [error, setError] = useState('');
  const [online, setOnline] = useState(true);
  const [history, setHistory] = useState([]);

  const state = status?.state || 'idle';
  const driving = state === 'driving';

  useEffect(() => {
    api.map().then(setMap).catch(() => setOnline(false));
    api.history().then(setHistory).catch(() => {});
  }, []);

  useEffect(() => {
    const tick = () =>
      api.status().then((s) => { setStatus(s); setOnline(true); }).catch(() => setOnline(false));
    tick();
    const id = setInterval(tick, 800);
    return () => clearInterval(id);
  }, []);

  // refresh history whenever a run ends
  useEffect(() => {
    if (['arrived', 'stopped', 'blocked'].includes(state)) api.history().then(setHistory).catch(() => {});
  }, [state]);

  const pick = (r, c) => {
    if (driving) return;
    if (map.grid[r][c] === 1) return setError('That cell is a wall. Pick a free cell.');
    setError('');
    setTarget({ row: r, col: c });
  };

  const send = async () => {
    if (!target) return setError('Tap a free cell on the map first.');
    try {
      setError('');
      await api.go(target.row, target.col);
    } catch (e) { setError(e.message); }
  };

  const stop = () => api.stop().catch((e) => setError(e.message));
  const resetRobot = () => api.reset().then(() => { setTarget(null); setError(''); }).catch((e) => setError(e.message));

  if (!map) {
    return (
      <main className="page">
        <p className="banner bad">{online ? 'Loading map…' : 'Cannot reach the server. Check it is running on port 5000.'}</p>
      </main>
    );
  }

  const { done = 0, total = 0 } = status?.progress || {};

  return (
    <main className="page">
      <header className="top">
        <h1>Robot control</h1>
        <span className={`mode ${status?.connected === false ? 'bad' : ''}`}>
          {status?.simulation ? 'Simulation mode' : status?.connected ? 'ESP32 connected' : 'ESP32 disconnected'}
        </span>
      </header>

      {!online && <p className="banner bad">Connection to the server lost. Retrying…</p>}

      <section className={`status ${state}`} aria-live="polite">
        <strong>{LABEL[state]}</strong>
        <span>{status?.message}</span>
        {driving && total > 0 && (
          <progress value={done} max={total} aria-label="Route progress" />
        )}
      </section>

      <Grid map={map} status={status} target={target} onPick={pick} />

      <ul className="legend">
        <li><i className="sw wall" />Wall</li>
        <li><i className="sw route" />Planned route</li>
        <li><i className="sw start" />Start</li>
        <li><i className="sw target" />Destination</li>
      </ul>

      {error && <p className="banner bad" role="alert">{error}</p>}

      <div className="actions">
        {driving ? (
          <button className="btn stop" onClick={stop}>Stop robot</button>
        ) : (
          <button className="btn go" onClick={send} disabled={!online}>Send robot</button>
        )}
        <button className="btn ghost" onClick={resetRobot} disabled={driving}>Return to start cell</button>
        {status?.simulation && driving && (
          <button className="btn ghost" onClick={() => api.simulateBlock()}>Simulate obstacle</button>
        )}
      </div>

      <section className="panel">
        <h2>Commands sent to the ESP32</h2>
        {status?.commands?.length ? (
          <p className="cmds">
            {status.commands.map((c, i) => (
              <code key={i} className={i < done ? 'done' : ''}>{c}</code>
            ))}
          </p>
        ) : (
          <p className="muted">No route yet. Choose a destination and press Send robot.</p>
        )}
      </section>

      <section className="panel">
        <h2>Recent runs</h2>
        {history.length ? (
          <ul className="history">
            {history.slice(0, 6).map((h, i) => (
              <li key={i}>
                <span>Row {h.destination.row + 1}, column {h.destination.col + 1}</span>
                <b className={h.outcome}>{LABEL[h.outcome] || h.outcome}</b>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Finished runs appear here.</p>
        )}
      </section>
    </main>
  );
}
