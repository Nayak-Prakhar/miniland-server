const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("MiniLand server running"));

let rooms = {};

function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array(4).fill(0).map(() => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function createColorTiles() {
  const colors = ["red", "green", "blue", "yellow"];
  let tiles = [];
  for (let i = 0; i < 4; i++) {
    tiles.push({
      color: colors[i],
      x: 200 * i,
      y: 500,
      size: 200
    });
  }
  return tiles;
}

io.on("connection", (socket) => {
  socket.on("createRoom", (name) => {
    const roomCode = generateRoomCode();
    socket.join(roomCode);
    rooms[roomCode] = {
      host: socket.id,
      players: [],
      gameStarted: false
    };
    const player = { id: socket.id, name, x: 400, y: 100, color: "white" };
    rooms[roomCode].players.push(player);
    socket.emit("roomJoined", { room: roomCode, id: socket.id });
  });

  socket.on("joinRoom", ({ name, room }) => {
    if (rooms[room]) {
      socket.join(room);
      const player = { id: socket.id, name, x: 400, y: 100, color: "white" };
      rooms[room].players.push(player);
      socket.emit("roomJoined", { room, id: socket.id });
    }
  });

  socket.on("move", (dx) => {
    for (let room in rooms) {
      const player = rooms[room].players.find(p => p.id === socket.id);
      if (player) {
        player.x += dx;
        if (player.x < 0) player.x = 0;
        if (player.x > 770) player.x = 770;
      }
    }
  });
});

setInterval(() => {
  for (let room in rooms) {
    const game = rooms[room];
    if (!game.players.length) continue;

    if (!game.tiles) {
      game.tiles = createColorTiles();
      game.targetColor = game.tiles[Math.floor(Math.random() * 4)].color;
      io.to(room).emit("status", `Stand on: ${game.targetColor}`);
    }

    for (let p of game.players) {
      const tile = game.tiles.find(t =>
        p.x >= t.x && p.x <= t.x + t.size && t.color === game.targetColor
      );
      if (!tile) p.out = true;
    }

    game.players = game.players.filter(p => !p.out);
    if (game.players.length === 1) {
      io.to(room).emit("status", `${game.players[0].name} WINS!`);
      delete rooms[room].tiles;
      return;
    }

    io.to(room).emit("update", {
      players: game.players,
      tiles: game.tiles
    });

    // Reset tiles every 5 seconds
    if (game.tick) game.tick++;
    else game.tick = 1;

    if (game.tick % 20 === 0) {
      game.tiles = createColorTiles();
      game.targetColor = game.tiles[Math.floor(Math.random() * 4)].color;
      io.to(room).emit("status", `Stand on: ${game.targetColor}`);
    }
  }
}, 250);
