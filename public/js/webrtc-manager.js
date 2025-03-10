/**
 * WebRTC Connection Manager
 * Handles peer-to-peer connections for low-latency game updates
 */
class WebRTCManager {
  constructor(socket, onPeerMessage) {
    this.socket = socket;
    this.onPeerMessage = onPeerMessage;
    this.peers = new Map(); // Map of peer connections
    this.setupSignaling();
    this.connectionState = {};
  }

  /**
   * Set up signaling events for WebRTC
   */
  setupSignaling() {
    // Handle incoming signals (offers, answers, ICE candidates)
    this.socket.on("signal", (data) => {
      const { peerId, signal } = data;

      // If we don't have this peer yet, create it
      if (!this.peers.has(peerId)) {
        this.createPeer(peerId, false);
      }

      // Process the signal
      try {
        const peer = this.peers.get(peerId);
        peer.signal(signal);
      } catch (error) {
        console.error("Error processing signal:", error);
      }
    });

    // Initiate a connection with another peer
    this.socket.on("initiate-peer", (data) => {
      const { targetId } = data;
      this.createPeer(targetId, true);
    });

    // Handle peer disconnection
    this.socket.on("peer-disconnected", (data) => {
      const { peerId } = data;
      this.destroyPeer(peerId);
    });
  }

  /**
   * Create a new peer connection
   * @param {string} peerId - The ID of the peer to connect to
   * @param {boolean} initiator - Whether this peer should initiate the connection
   */
  createPeer(peerId, initiator) {
    if (this.peers.has(peerId)) {
      console.log(`Peer ${peerId} already exists`);
      return;
    }

    try {
      console.log(
        `Creating ${initiator ? "initiating" : "receiving"} peer for ${peerId}`
      );

      // Create the peer using simple-peer with optimized settings
      const peer = new SimplePeer({
        initiator,
        trickle: true,
        sdpTransform: (sdp) => {
          // Optimize SDP for lower bandwidth and better performance
          // Prefer VP8 codec and lower resolution/bandwidth
          return sdp.replace(
            /(a=fmtp:\d+ .*)\r\n/g,
            "$1;x-google-max-bitrate=1000;x-google-min-bitrate=500;x-google-start-bitrate=750\r\n"
          );
        },
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:global.stun.twilio.com:3478" },
          ],
        },
      });

      // Set a timeout for connection establishment
      const connectionTimeout = setTimeout(() => {
        if (this.connectionState[peerId] === "connecting") {
          console.warn(`Connection to peer ${peerId} timed out`);
          this.destroyPeer(peerId);
        }
      }, 15000); // 15 seconds timeout

      // Handle connection events
      peer.on("signal", (signal) => {
        // Send the signal to the target peer via the server
        try {
          this.socket.emit("signal", {
            targetId: peerId,
            signal: signal,
          });
        } catch (error) {
          console.error(`Error sending signal to ${peerId}:`, error);
        }
      });

      peer.on("connect", () => {
        console.log(`Connected to peer ${peerId}`);
        this.connectionState[peerId] = "connected";
        clearTimeout(connectionTimeout);
      });

      peer.on("data", (data) => {
        try {
          const message = JSON.parse(data.toString());
          // Pass the message to the handler
          if (this.onPeerMessage) {
            this.onPeerMessage(peerId, message);
          }
        } catch (e) {
          console.error("Error parsing peer message:", e);
        }
      });

      peer.on("error", (err) => {
        console.error("Peer connection error:", err);
        this.connectionState[peerId] = "error";
        // Don't immediately destroy on error - some errors are recoverable
        if (
          err.code === "ERR_ICE_CONNECTION_FAILURE" ||
          err.code === "ERR_CONNECTION_FAILURE"
        ) {
          this.destroyPeer(peerId);
        }
      });

      peer.on("close", () => {
        console.log(`Connection to peer ${peerId} closed`);
        clearTimeout(connectionTimeout);
        this.destroyPeer(peerId);
      });

      // Store the peer
      this.peers.set(peerId, peer);
      this.connectionState[peerId] = "connecting";
    } catch (error) {
      console.error("Error creating peer:", error);
    }
  }

  /**
   * Send a message to a specific peer
   * @param {string} peerId - The ID of the peer to send to
   * @param {object} message - The message to send
   */
  sendToPeer(peerId, message) {
    if (this.peers.has(peerId)) {
      const peer = this.peers.get(peerId);
      if (peer && peer.connected) {
        try {
          peer.send(JSON.stringify(message));
          return true;
        } catch (error) {
          console.error(`Error sending to peer ${peerId}:`, error);
        }
      }
    }
    return false;
  }

  /**
   * Broadcast a message to all connected peers
   * @param {object} message - The message to broadcast
   */
  broadcast(message) {
    const jsonMessage = JSON.stringify(message);
    let successCount = 0;

    this.peers.forEach((peer, peerId) => {
      if (peer.connected) {
        try {
          peer.send(jsonMessage);
          successCount++;
        } catch (error) {
          console.error(`Error broadcasting to peer ${peerId}:`, error);
        }
      }
    });

    return successCount;
  }

  /**
   * Destroy a peer connection
   * @param {string} peerId - The ID of the peer to destroy
   */
  destroyPeer(peerId) {
    if (this.peers.has(peerId)) {
      const peer = this.peers.get(peerId);
      try {
        // Remove all listeners before destroying to prevent memory leaks
        peer.removeAllListeners("signal");
        peer.removeAllListeners("connect");
        peer.removeAllListeners("data");
        peer.removeAllListeners("error");
        peer.removeAllListeners("close");

        // Then destroy the peer
        peer.destroy();
      } catch (e) {
        console.error(`Error destroying peer ${peerId}:`, e);
      }
      this.peers.delete(peerId);
      delete this.connectionState[peerId];
    }
  }

  /**
   * Clean up all peer connections
   */
  destroyAll() {
    this.peers.forEach((peer, peerId) => {
      this.destroyPeer(peerId);
    });
  }

  /**
   * Check if connected to a specific peer
   * @param {string} peerId - The ID of the peer to check
   * @returns {boolean} - Whether connected to the peer
   */
  isConnectedToPeer(peerId) {
    return this.peers.has(peerId) && this.peers.get(peerId).connected;
  }

  /**
   * Get the number of connected peers
   * @returns {number} - The number of connected peers
   */
  getConnectedPeerCount() {
    let count = 0;
    this.peers.forEach((peer) => {
      if (peer.connected) count++;
    });
    return count;
  }
}
