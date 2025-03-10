/**
 * Ping Manager
 * Handles ping measurement and display
 */
class PingManager {
  constructor(socket) {
    this.socket = socket;
    this.pingStart = 0;
    this.currentPing = 0;
    this.pingDisplay = null;
    this.pingInterval = 2000; // Time between ping checks in ms
    this.setupPingDisplay();
    this.setupPingHandler();
    this.startPingInterval();
  }

  /**
   * Create the ping display element
   */
  setupPingDisplay() {
    // Create a div to display ping
    this.pingDisplay = document.createElement("div");
    this.pingDisplay.id = "pingDisplay";
    this.pingDisplay.style.position = "fixed";
    this.pingDisplay.style.top = "50px"; // Position it below the stats
    this.pingDisplay.style.right = "10px";
    this.pingDisplay.style.background = "rgba(0, 0, 0, 0.5)";
    this.pingDisplay.style.color = "white";
    this.pingDisplay.style.padding = "5px 10px";
    this.pingDisplay.style.borderRadius = "5px";
    this.pingDisplay.style.fontSize = "14px";
    this.pingDisplay.style.fontWeight = "bold";
    this.pingDisplay.style.zIndex = "100";
    this.pingDisplay.textContent = "Ping: -- ms";
    document.body.appendChild(this.pingDisplay);
  }

  /**
   * Set up the ping response handler
   */
  setupPingHandler() {
    this.socket.on("pong", (timestamp) => {
      if (timestamp === this.pingStart) {
        this.currentPing = Date.now() - this.pingStart;
        this.updatePingDisplay();
      }
    });
  }

  /**
   * Start the ping interval
   */
  startPingInterval() {
    setInterval(() => this.checkPing(), this.pingInterval);
  }

  /**
   * Send a ping request
   */
  checkPing() {
    if (!this.socket || !this.socket.connected) return;

    this.pingStart = Date.now();
    this.socket.emit("ping", this.pingStart);
  }

  /**
   * Update the ping display
   */
  updatePingDisplay() {
    if (!this.pingDisplay) return;

    this.pingDisplay.textContent = `Ping: ${this.currentPing} ms`;

    // Color-code the ping display
    if (this.currentPing < 50) {
      this.pingDisplay.style.color = "#00ff00"; // Green for good ping
    } else if (this.currentPing < 100) {
      this.pingDisplay.style.color = "#ffff00"; // Yellow for okay ping
    } else {
      this.pingDisplay.style.color = "#ff0000"; // Red for bad ping
    }
  }

  /**
   * Get the current ping
   */
  getPing() {
    return this.currentPing;
  }
}
