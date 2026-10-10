import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Robot } from './robot.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const map = JSON.parse(fs.readFileSync(path.join(__dirname, 'map.json'), 'utf8'));

// ---- optional MongoDB run history (falls back to memory) ----
const memoryHistory = [];
let Run = null;
if (process.env.MONGO_URI) {
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 4000 });
    Run = mongoose.model('Run', new mongoose.Schema({
      destination: { row: Number, col: Number },
      commands: [String],
      outcome: String,
      createdAt: { type: Date, default: Date.now },
    }));
    console.log('MongoDB connected');
  } catch (e) {
    console.log('MongoDB not available, using in-memory history:', e.message);
  }
}

async function saveRun(robot) {
  const entry = {
    destination: robot.destination,
    commands: robot.commands,
    outcome: robot.state,
    createdAt: new Date(),
  };
  if (Run) await Run.create(entry).catch(() => {});
  else { memoryHistory.unshift(entry); memoryHistory.length = Math.min(memoryHistory.length, 20); }
}

const robot = new Robot(map, {
  port: process.env.ROBOT_PORT,
  baud: Number(process.env.ROBOT_BAUD) || 115200,
  onFinish: saveRun,
});

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/map', (_req, res) => {
  res.json({ ...map, simulation: robot.simulation });
});

app.get('/api/status', (_req, res) => res.json(robot.snapshot()));

app.post('/api/go', (req, res) => {
  const { row, col } = req.body || {};
  const rows = map.grid.length, cols = map.grid[0].length;
  if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 || row >= rows || col >= cols)
    return res.status(400).json({ error: 'That cell is outside the map.' });
  if (map.grid[row][col] === 1)
    return res.status(400).json({ error: 'That cell is a wall. Pick a free cell.' });
  if (robot.state === 'driving')
    return res.status(409).json({ error: 'Robot is already driving. Stop it first.' });
  if (!robot.connected)
    return res.status(503).json({ error: 'Robot connection lost. Check the USB cable.' });
  if (robot.pos.row === row && robot.pos.col === col)
    return res.status(400).json({ error: 'Robot is already on that cell.' });

  const plan = robot.plan({ row, col });
  if (!plan) return res.status(422).json({ error: 'No route to that cell.' });
  robot.start({ row, col }, plan);
  res.json({ path: plan.path, commands: robot.commands });
});

app.post('/api/stop', (_req, res) => { robot.stop(); res.json(robot.snapshot()); });

app.post('/api/reset', (_req, res) => {
  if (robot.state === 'driving') return res.status(409).json({ error: 'Stop the robot first.' });
  robot.reset();
  res.json(robot.snapshot());
});

// Simulation only: pretend the ultrasonic sensor sees something on the next step.
app.post('/api/simulate-block', (_req, res) => {
  if (!robot.simulation) return res.status(400).json({ error: 'Only available in simulation mode.' });
  robot.simBlockNext = true;
  res.json({ ok: true });
});

app.get('/api/history', async (_req, res) => {
  if (Run) return res.json(await Run.find().sort({ createdAt: -1 }).limit(20).lean());
  res.json(memoryHistory);
});

// Serve the built React app so phones only need port 5000
const dist = path.join(__dirname, '../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const port = process.env.PORT || 5000;
app.listen(port, '0.0.0.0', () =>
  console.log(`Server on http://0.0.0.0:${port} (${robot.simulation ? 'simulation' : 'ESP32'} mode)`));
