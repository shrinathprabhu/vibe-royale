import { Socket } from "socket.io";

// This class manages the WebRTC signaling process
export class PeerConnectionManager {
  private activePlayers: Set<string> = new Set();

  constructor(private io: any) {}

  // Add a player to the active list and initiate peer connections with other players
  public addPlayer(socket: Socket): void {
    const playerId = socket.id;

    // Notify existing players about the new player
    if (this.activePlayers.size > 0) {
      // Notify the new player about all existing players first
      this.activePlayers.forEach((existingPlayerId) => {
        if (existingPlayerId !== playerId) {
          // Tell new player to create an offer for the existing player
          socket.emit("initiate-peer", { targetId: existingPlayerId });
        }
      });
    }

    // Add the player to active player list
    this.activePlayers.add(playerId);
  }

  // Handle when a player leaves
  public removePlayer(playerId: string): void {
    this.activePlayers.delete(playerId);

    // Let remaining peers know to close this connection
    this.io.emit("peer-disconnected", { peerId: playerId });
  }

  // Set up signaling event handlers for a socket
  public setupSignaling(socket: Socket): void {
    const playerId = socket.id;

    // Handle WebRTC signaling: offers, answers, and ICE candidates
    socket.on("signal", (data: { targetId: string; signal: any }) => {
      const { targetId, signal } = data;

      // Forward the signal to the target peer
      this.io.to(targetId).emit("signal", {
        peerId: playerId,
        signal: signal,
      });
    });
  }
}
