# Autonomous Navigation Robot - MERN web app

MongoDB + Express + React + Node. Replaces the Flask server from the project doc
and keeps the same API (`/api/map`, `/api/status`, `/api/go`, `/api/stop`).

## Run it

```bash
# 1. server (port 5000)
cd server
npm install
cp .env.example .env        # edit if needed
npm start                   # simulation mode (robot moves on screen only)

# 2. client (dev mode, port 5173)
cd ../client
npm install
npm run dev
```

Real robot: set `ROBOT_PORT=/dev/ttyUSB0` in `server/.env` and `npm install serialport` in `server/`.

Use from a phone (no internet needed): build once, then open `http://<board-ip>:5000`.

```bash
cd client && npm run build   # server serves client/dist automatically
```

MongoDB is optional. Set `MONGO_URI` in `.env` to save run history; without it the app works fine and history is kept in memory.

## Your map

Edit `server/map.json` (grid of 0 = free, 1 = wall, cellCm, start, startHeading).

## ESP32 serial protocol (115200 baud, one command per line)

Server sends: `F<cm>`, `R90`, `L90`, `R180`, `STOP`
ESP32 must reply, after each command finishes:

- `DONE`    command completed
- `BLOCKED` ultrasonic sensor stopped the robot

On BLOCKED the server marks the cell ahead as a wall, replans from the current cell, and continues. If no other route exists the page shows "Blocked".
