# Vibe Royale

A Vibe Coded Battle Royale Game built with Three.js, Socket.IO, WebRTC, and Fastify.

## Features

- 3D first-person shooter gameplay
- Multiplayer support with real-time updates
- WebRTC peer-to-peer connections for low-latency gameplay
- Simple map with terrain, river, and obstacles
- Various weapons with different damage levels
- Birds and chickens as shooting targets
- Basic physics with gravity and jumping
- Health, armor, and shield system
- Analytics tracking with @useoutline/analytics

## Controls

- W/Arrow Up: Move forward
- S/Arrow Down: Move backward
- A/Arrow Left: Move left
- D/Arrow Right: Move right
- Mouse: Look around
- Left Click/Space: Shoot
- Right Click/Z: Zoom in
- X: Zoom out
- H: Use health kit
- C: Use shield
- Left Shift: Jump
- Ctrl+D: Toggle WebRTC debug information

## Setup

1. Install dependencies:

```bash
npm install
```

2. Build the TypeScript code:

```bash
npm run build
```

3. Start the server:

```bash
npm start
```

4. Open your browser and navigate to `http://localhost:5601`

## Development

To run the server in development mode with auto-reload:

```bash
npm run dev
```

## Game Rules

- Players start with a pistol, basic armor, helmet, and shield
- Collect better weapons around the map
- Kill other players to score points
- Use health kits to restore health
- Use shields for protection
- Shoot birds and chickens for fun (no points)
- Respawn after death with basic equipment

## Network Architecture

The game uses a hybrid networking approach:

- **Socket.IO**: Used for reliable game state synchronization, authoritative server decisions, and WebRTC signaling
- **WebRTC**: Used for low-latency peer-to-peer communication for time-sensitive actions like player movement and shooting

This hybrid approach provides several benefits:

- Reduced server load as peers communicate directly
- Lower latency for critical gameplay actions
- Fallback to Socket.IO when WebRTC is not available
- Server remains authoritative for game state to prevent cheating

## WebRTC Implementation

The WebRTC implementation includes:

- Automatic peer discovery and connection setup
- Fallback to Socket.IO when WebRTC is unavailable
- Latency measurement between peers
- Debug tools (press Ctrl+D during gameplay)
- Connection status display

## Analytics

The game uses @useoutline/analytics to track:

- Player join events
- Player leave events with time played
- Custom game events
