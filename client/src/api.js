async function call(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Request failed.');
  return body;
}

export const api = {
  map: () => call('/api/map'),
  status: () => call('/api/status'),
  history: () => call('/api/history'),
  go: (row, col) => call('/api/go', { method: 'POST', body: JSON.stringify({ row, col }) }),
  stop: () => call('/api/stop', { method: 'POST' }),
  reset: () => call('/api/reset', { method: 'POST' }),
  simulateBlock: () => call('/api/simulate-block', { method: 'POST' }),
};
