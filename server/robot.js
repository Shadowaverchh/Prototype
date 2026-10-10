import { aStar, buildSteps, DIRS } from './pathfinding.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Robot {
  constructor(map, { port, baud = 115200, onFinish } = {}) {
    this.map = map;
    this.onFinish = onFinish;
    this.simulation = !port;
    this.link = null;
    this.waiter = null;
    this.connected = this.simulation;
    this.reset();
    if (port) this.openSerial(port, baud);
  }

  async openSerial(port, baud) {
    try {
      const { SerialPort, ReadlineParser } = await import('serialport');
      this.link = new SerialPort({ path: port, baudRate: baud });
      const parser = this.link.pipe(new ReadlineParser({ delimiter: '\n' }));
      parser.on('data', (line) => this.waiter?.(line.trim().toUpperCase()));
      this.link.on('open', () => { this.connected = true; });
      this.link.on('close', () => { this.connected = false; });
      this.link.on('error', () => { this.connected = false; });
    } catch {
      this.connected = false;
      this.message = 'Could not open serial port. Is "serialport" installed?';
    }
  }

  reset() {
    this.token = (this.token || 0) + 1;
    this.state = 'idle';
    this.pos = { ...this.map.start };
    this.heading = this.map.startHeading;
    this.destination = null;
    this.route = [];
    this.commands = [];
    this.done = 0;
    this.tempWalls = [];
    this.simBlockNext = false;
    this.message = 'Ready. Pick a destination.';
  }

  snapshot() {
    return {
      state: this.state,
      position: this.pos,
      heading: this.heading,
      destination: this.destination,
      route: this.route,
      commands: this.commands,
      progress: { done: this.done, total: this.commands.length },
      message: this.message,
      simulation: this.simulation,
      connected: this.connected,
    };
  }

  gridWithTempWalls() {
    const g = this.map.grid.map((r) => [...r]);
    this.tempWalls.forEach(({ row, col }) => { g[row][col] = 1; });
    return g;
  }

  plan(goal) {
    const path = aStar(this.gridWithTempWalls(), this.pos, goal);
    if (!path) return null;
    return { path, steps: buildSteps(path, this.heading, this.map.cellCm) };
  }

  start(goal, plan) {
    this.token++;
    this.destination = goal;
    this.route = plan.path;
    this.commands = plan.steps.map((s) => s.cmd);
    this.done = 0;
    this.tempWalls = [];
    this.state = 'driving';
    this.message = 'Driving to destination.';
    this.run(this.token, plan.steps, 0);
  }

  async run(token, steps, reroutes) {
    for (const step of steps) {
      if (token !== this.token) return;
      const result = await this.exec(step, token);
      if (token !== this.token) return;
      if (result === 'blocked') return this.handleBlocked(token, reroutes);
      this.done++;
    }
    this.state = 'arrived';
    this.message = 'Arrived.';
    this.onFinish?.(this);
  }

  async exec(step, token) {
    if (step.type === 'T') {
      if (this.simulation) await sleep(500);
      else if ((await this.send(step.cmd)) !== 'DONE') return 'blocked';
      this.heading = (this.heading + step.turn) % 360;
      return 'ok';
    }
    // Forward
    const d = DIRS[this.heading];
    if (this.simulation) {
      for (let i = 0; i < step.cells; i++) {
        if (token !== this.token) return 'stopped';
        if (this.simBlockNext) { this.simBlockNext = false; return 'blocked'; }
        await sleep(600);
        this.pos = { row: this.pos.row + d.dr, col: this.pos.col + d.dc };
      }
      return 'ok';
    }
    const reply = await this.send(step.cmd);
    if (reply === 'BLOCKED') return 'blocked';
    this.pos = { row: this.pos.row + d.dr * step.cells, col: this.pos.col + d.dc * step.cells };
    return 'ok';
  }

  send(cmd) {
    return new Promise((resolve) => {
      if (!this.link) return resolve('BLOCKED');
      const timer = setTimeout(() => { this.waiter = null; resolve('TIMEOUT'); }, 60000);
      this.waiter = (line) => {
        if (line !== 'DONE' && line !== 'BLOCKED') return; // ignore progress chatter
        clearTimeout(timer);
        this.waiter = null;
        resolve(line);
      };
      this.link.write(cmd + '\n');
    });
  }

  handleBlocked(token, reroutes) {
    const d = DIRS[this.heading];
    const ahead = { row: this.pos.row + d.dr, col: this.pos.col + d.dc };
    const inside = this.map.grid[ahead.row]?.[ahead.col] !== undefined;
    if (inside) this.tempWalls.push(ahead);
    const plan = reroutes < 3 && this.plan(this.destination);
    if (!plan) {
      this.state = 'blocked';
      this.message = 'Obstacle ahead and no other route. Remove it or pick another cell.';
      this.onFinish?.(this);
      return;
    }
    this.message = 'Obstacle found. Rerouting.';
    this.route = plan.path;
    this.commands = plan.steps.map((s) => s.cmd);
    this.done = 0;
    this.run(token, plan.steps, reroutes + 1);
  }

  stop() {
    this.token++;
    if (this.link?.isOpen) this.link.write('STOP\n');
    this.waiter?.('BLOCKED');
    if (this.state === 'driving') {
      this.state = 'stopped';
      this.message = 'Stopped by user.';
      this.onFinish?.(this);
    }
  }
}
