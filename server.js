const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("MiniLand Server running"));

let players = {};
let sockets = {};
let bombs = [];
let gameInterval;

function dropBomb() {
  bombs.push({ x: Math.random() * 770 + 10, y: 0 });
}

function updateBombs() {
  bombs.forEach(b => b.y += 5);
  bombs = bombs.filter(b => b.y < 600);
}

function checkHit() {
  for (let name in players) {
    let x = players[name];
    bombs.forEach(bomb => {
      if (bomb.x > x && bomb.x < x + 30 && bomb.y > 550 && bomb.y < 580) {
        io.to(sockets[name]).emit("dead");
        delete players[name];
      }
    });
  }

  if (Object.keys(players).length === 1) {
    const winner = Object.keys(players)[0];
    io.emit("winner", winner);
    clearInterval(gameInterval);
  }
}

io.on("connection", socket => {
  socket.on("join", name => {
    players[name] = 400;
    sockets[name] = socket.id;
    if (Object.keys(players).length === 1) {
      gameInterval = setInterval(() => {
        dropBomb();
        updateBombs();
        checkHit();
        io.emit("state", { players, bombs });
      }, 300);
    }
  });

  socket.on("move", x => {
    for (let name in sockets) {
      if (sockets[name] === socket.id) {
        players[name] = x;
      }
    }
  });

  socket.on("disconnect", () => {
    for (let name in sockets) {
      if (sockets[name] === socket.id) {
        delete players[name];
        delete sockets[name];
      }
    }
  });
});
