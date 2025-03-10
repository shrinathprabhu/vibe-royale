import fastify from "fastify";
import { Server } from "socket.io";
import { join } from "path";
import fastifyStatic from "@fastify/static";
import { GameStateManager } from "./GameState";
import { Player, Vector3 } from "../shared/types";
import { PeerConnectionManager } from "./PeerConnectionManager";

const server = fastify();
const gameState = new GameStateManager();

// Serve static files
server.register(fastifyStatic, {
  root: join(__dirname, "../../public"),
  prefix: "/",
});

// Set up Socket.IO
const io = new Server(server.server, {
  // Enable more frequent updates with lower latency
  pingInterval: 2000,
  pingTimeout: 5000,
});

// Create the peer connection manager for WebRTC signaling
const peerManager = new PeerConnectionManager(io);

// Game update interval (60 FPS)
const TICK_RATE = 1000 / 60;

// Socket.IO event handling
io.on("connection", (socket) => {
  let player: Player | null = null;

  // Set up WebRTC signaling
  peerManager.setupSignaling(socket);

  socket.on("join", (name: string) => {
    player = gameState.addPlayer(socket.id, name);
    socket.emit("gameState", gameState.getState());
    gameState.addBots(); // Add bots if needed

    // Initialize WebRTC connections
    peerManager.addPlayer(socket);
  });

  socket.on("updatePlayer", (updates: Partial<Player>) => {
    if (player) {
      gameState.updatePlayer(socket.id, updates);
      // Immediately emit the update to all clients for faster feedback
      io.emit("playerUpdate", { id: socket.id, updates });
    }
  });

  socket.on("shoot", (direction: Vector3) => {
    if (player) {
      const hit = gameState.handleShot(socket.id, direction);
      socket.emit("shotFeedback", { hit });
      io.emit("gameState", gameState.getState());
    }
  });

  socket.on(
    "botShoot",
    ({ botId, direction }: { botId: string; direction: Vector3 }) => {
      // Handle bot shooting
      const hit = gameState.handleShot(botId, direction);
      if (hit) {
        io.emit("gameState", gameState.getState());
      }
    }
  );

  socket.on("useHealthKit", () => {
    if (player) {
      gameState.useHealthKit(socket.id);
      io.emit("gameState", gameState.getState());
    }
  });

  socket.on("useShield", () => {
    if (player) {
      gameState.useShield(socket.id);
      io.emit("gameState", gameState.getState());
    }
  });

  socket.on("toggleView", () => {
    if (player) {
      gameState.toggleView(socket.id);
      socket.emit("gameState", gameState.getState());
    }
  });

  socket.on("toggleStats", () => {
    if (player) {
      gameState.toggleStats(socket.id);
      socket.emit("gameState", gameState.getState());
    }
  });

  socket.on("addBloodSplash", (data: { position: Vector3 }) => {
    gameState.addBloodSplash(data.position);
    io.emit("gameState", gameState.getState());
  });

  socket.on(
    "pickupWeapon",
    (data: { weaponIndex: number; isDeadPlayerWeapon: boolean }) => {
      if (player) {
        gameState.pickupWeapon(
          socket.id,
          data.weaponIndex,
          data.isDeadPlayerWeapon
        );
        io.emit("gameState", gameState.getState());
      }
    }
  );

  socket.on(
    "refillAmmo",
    (data: { weaponIndex: number; isDeadPlayerWeapon: boolean }) => {
      // No-op: Ammo is now infinite, so no need to refill
      // We keep the event handler for backward compatibility
    }
  );

  // Handle ping requests for latency measurement
  socket.on("ping", (timestamp) => {
    socket.emit("pong", timestamp);
  });

  socket.on("disconnect", () => {
    if (player) {
      gameState.removePlayer(socket.id);
      io.emit("gameState", gameState.getState());
      // Notify peers about disconnection
      peerManager.removePlayer(socket.id);
    }
  });

  // Handle manual respawn requests
  socket.on("requestRespawn", () => {
    if (player) {
      // Only respawn if player is actually dead
      const currentState = gameState.getState();
      const currentPlayer = currentState.players[socket.id];

      if (currentPlayer && currentPlayer.health <= 0) {
        gameState.respawnPlayer(socket.id);
        io.emit("gameState", gameState.getState());
      }
    }
  });
});

// Game loop
setInterval(() => {
  gameState.updateBirdsAndChickens();
  io.emit("gameState", gameState.getState());
}, TICK_RATE);

// Start server
const start = async () => {
  try {
    await server.listen({ port: 5601, host: "0.0.0.0" });
    console.log("Server running on http://localhost:5601");
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
