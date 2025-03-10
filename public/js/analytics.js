/**
 * Analytics Manager for Vibe Royale
 * Tracks game events using @useoutline/analytics
 */
class AnalyticsManager {
  constructor() {
    this.trackingId = "OA-0ixXoyMnujIP";
    this.playerJoinTime = null;
    this.playerId = null;
    this.analytics = null;
    this.isInitialized = false;

    // Check if analytics is already initialized via the script tag
    this.initWhenReady();
  }

  /**
   * Wait for analytics to be ready and initialize
   */
  initWhenReady() {
    // Analytics might not be immediately available if the script is still loading
    if (window.useOutlineAnalytics) {
      this.initializeAnalytics();
    } else {
      // Wait a short time and try again
      setTimeout(() => this.initWhenReady(), 100);
    }
  }

  /**
   * Initialize analytics
   */
  initializeAnalytics() {
    if (window.useOutlineAnalytics) {
      this.analytics = window.useOutlineAnalytics(this.trackingId);
      this.isInitialized = true;
      console.log("Analytics initialized with tracking ID:", this.trackingId);
    } else {
      console.error(
        "Analytics not available - the script tag may be missing or blocked"
      );
    }
  }

  /**
   * Track player join event
   * @param {string} playerId - The ID of the player
   * @param {string} playerName - The name of the player
   */
  trackPlayerJoin(playerId, playerName) {
    if (!this.isInitialized || !this.analytics) return;

    this.playerId = playerId;
    this.playerJoinTime = Date.now();

    this.analytics.sendEvent("player_join", {
      player_id: playerId,
      player_name: playerName,
      timestamp: new Date().toISOString(),
    });

    console.log("Tracked player join:", playerName);
  }

  /**
   * Track player leave event
   */
  trackPlayerLeave() {
    if (
      !this.isInitialized ||
      !this.analytics ||
      !this.playerId ||
      !this.playerJoinTime
    )
      return;

    const timePlayedSeconds = Math.floor(
      (Date.now() - this.playerJoinTime) / 1000
    );

    this.analytics.sendEvent("player_leave", {
      player_id: this.playerId,
      time_played: timePlayedSeconds,
      timestamp: new Date().toISOString(),
    });

    console.log(
      "Tracked player leave. Time played:",
      timePlayedSeconds,
      "seconds"
    );
  }

  /**
   * Track a custom event
   * @param {string} eventName - The name of the event
   * @param {Object} properties - Additional properties for the event
   */
  trackEvent(eventName, properties = {}) {
    if (!this.isInitialized || !this.analytics) return;

    this.analytics.sendEvent(eventName, {
      ...properties,
      timestamp: new Date().toISOString(),
    });
  }
}
