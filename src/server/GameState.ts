import {
  Bird,
  Chicken,
  Collectible,
  GameState,
  Player,
  Vector3,
  Weapon,
  WeaponType,
  BloodSplash,
} from "../shared/types";
import { config } from "./config";

export class GameStateManager {
  private state: GameState;
  private botNames = [
    "Bot1",
    "Bot2",
    "Bot3",
    "Bot4",
    "Bot5",
    "Bot6",
    "Bot7",
    "Bot8",
    "Bot9",
    "Bot10",
    "Bot11",
    "Bot12",
    "Bot13",
    "Bot14",
    "Bot15",
    "Bot16",
    "Bot17",
    "Bot18",
    "Bot19",
    "Bot20",
    "Bot21",
    "Bot22",
    "Bot23",
    "Bot24",
    "Bot25",
    "Bot26",
    "Bot27",
    "Bot28",
    "Bot29",
    "Bot30",
    "Bot31",
    "Bot32",
    "Bot33",
    "Bot34",
    "Bot35",
    "Bot36",
    "Bot37",
    "Bot38",
    "Bot39",
    "Bot40",
    "Bot41",
    "Bot42",
    "Bot43",
    "Bot44",
    "Bot45",
    "Bot46",
    "Bot47",
    "Bot48",
    "Bot49",
    "Bot50",
  ];
  private wallHeight = 50; // Height of boundary walls

  constructor() {
    this.state = {
      players: {},
      weapons: [],
      collectibles: [],
      birds: [],
      chickens: [],
      walls: [],
      bloodSplashes: [],
      deadPlayerWeapons: [],
      totalPlayers: 0,
      alivePlayers: 0,
    };
    this.initializeBirdsAndChickens();
    this.initializeWalls();
  }

  private initializeWalls() {
    const halfSize = config.mapSize / 2;
    const wallThickness = 10;

    // North wall
    this.state.walls.push({
      id: "wall-north",
      position: { x: 0, y: this.wallHeight / 2, z: -halfSize },
      size: {
        width: config.mapSize,
        height: this.wallHeight,
        depth: wallThickness,
      },
      color: "#CCCCCC", // Light gray
    });

    // South wall
    this.state.walls.push({
      id: "wall-south",
      position: { x: 0, y: this.wallHeight / 2, z: halfSize },
      size: {
        width: config.mapSize,
        height: this.wallHeight,
        depth: wallThickness,
      },
      color: "#CCCCCC",
    });

    // East wall
    this.state.walls.push({
      id: "wall-east",
      position: { x: halfSize, y: this.wallHeight / 2, z: 0 },
      size: {
        width: wallThickness,
        height: this.wallHeight,
        depth: config.mapSize,
      },
      color: "#CCCCCC",
    });

    // West wall
    this.state.walls.push({
      id: "wall-west",
      position: { x: -halfSize, y: this.wallHeight / 2, z: 0 },
      size: {
        width: wallThickness,
        height: this.wallHeight,
        depth: config.mapSize,
      },
      color: "#CCCCCC",
    });
  }

  private initializeBirdsAndChickens() {
    // Add 20 birds
    for (let i = 0; i < 20; i++) {
      this.state.birds.push({
        id: `bird-${i}`,
        position: this.getRandomPosition(),
        rotation: { x: 0, y: 0, z: 0 },
        color: i % 2 === 0 ? "#000080" : "#FFC0CB", // Dark blue and pink
        health: 100,
      });
    }

    // Add 10 chickens
    for (let i = 0; i < 10; i++) {
      this.state.chickens.push({
        id: `chicken-${i}`,
        position: this.getRandomGroundPosition(),
        rotation: { x: 0, y: 0, z: 0 },
        color: i % 2 === 0 ? "#FFFFFF" : "#FF0000", // White and red
        health: 100,
      });
    }
  }

  private getRandomPosition(): Vector3 {
    const halfSize = config.mapSize / 2 - 50; // Keep away from walls
    return {
      x: (Math.random() - 0.5) * 2 * halfSize,
      y: Math.random() * 100 + 50, // Birds fly between 50-150 units high
      z: (Math.random() - 0.5) * 2 * halfSize,
    };
  }

  private getRandomGroundPosition(): Vector3 {
    const halfSize = config.mapSize / 2 - 50; // Keep away from walls
    const riverWidth = 50;
    let x = 0;
    let z = 0;
    let validPosition = false;

    // Keep trying until we get a position on green land
    while (!validPosition) {
      x = (Math.random() - 0.5) * 2 * halfSize;
      z = (Math.random() - 0.5) * 2 * halfSize;

      // Check if position is not in the river (main river runs along z-axis at x=0)
      if (Math.abs(x) > riverWidth / 2) {
        // Also check if not in the Y-shaped branch of the river
        // The Y-branch is around z=0 when x is negative
        if (!(x < 0 && Math.abs(z) < riverWidth / 2)) {
          validPosition = true;
        }
      }
    }

    return {
      x,
      y: 0,
      z,
    };
  }

  public addPlayer(id: string, name: string): Player {
    const player: Player = {
      id,
      name,
      position: this.getRandomGroundPosition(),
      rotation: { x: 0, y: 0, z: 0 },
      health: 100,
      armor: 100,
      helmet: 100,
      shield: 100,
      weapon: this.getNewWeapon(),
      kills: 0,
      deaths: 0,
      isZooming: false,
      zoomLevel: 1,
      isThirdPerson: false,
      showStats: true,
    };

    this.state.players[id] = player;
    this.balanceWeapons();
    this.updatePlayerCounts();
    return player;
  }

  public removePlayer(id: string) {
    delete this.state.players[id];
    this.balanceWeapons();
    this.updatePlayerCounts();
  }

  public updatePlayer(id: string, updates: Partial<Player>) {
    if (this.state.players[id]) {
      this.state.players[id] = { ...this.state.players[id], ...updates };
    }
  }

  private balanceWeapons() {
    const playerCount = Object.keys(this.state.players).length;
    const desiredWeaponCount = Math.max(playerCount - 1, 0); // -1 because each player starts with a pistol

    // Remove excess weapons
    while (this.state.weapons.length > desiredWeaponCount) {
      this.state.weapons.pop();
    }

    // Add weapons if needed
    while (this.state.weapons.length < desiredWeaponCount) {
      const weaponTypes = [
        WeaponType.SHOTGUN,
        WeaponType.RIFLE,
        WeaponType.SNIPER,
      ];
      const type = weaponTypes[Math.floor(Math.random() * weaponTypes.length)];
      const weapon: Weapon = {
        type,
      };
      this.state.weapons.push(weapon);
    }
  }

  public getState(): GameState {
    return this.state;
  }

  public updateBirdsAndChickens() {
    // Update bird positions
    this.state.birds = this.state.birds.map((bird) => ({
      ...bird,
      position: {
        x: bird.position.x + (Math.random() - 0.5) * 2,
        y: Math.max(
          50,
          Math.min(150, bird.position.y + (Math.random() - 0.5) * 2)
        ),
        z: bird.position.z + (Math.random() - 0.5) * 2,
      },
    }));

    // Update chicken positions
    this.state.chickens = this.state.chickens.map((chicken) => ({
      ...chicken,
      position: {
        x: chicken.position.x + (Math.random() - 0.5),
        y: 0,
        z: chicken.position.z + (Math.random() - 0.5),
      },
    }));

    // Remove old blood splashes
    this.state.bloodSplashes = this.state.bloodSplashes.filter((splash) => {
      return Date.now() - splash.timestamp < 2000; // Remove after 2 seconds
    });
  }

  public addBots() {
    const playerCount = Object.keys(this.state.players).length;
    const botsNeeded = Math.max(0, config.minBots - playerCount);

    for (let i = 0; i < botsNeeded; i++) {
      const botId = `bot-${Date.now()}-${i}`;
      this.addPlayer(botId, this.botNames[i % this.botNames.length]);

      // Move bots randomly
      setInterval(() => {
        if (this.state.players[botId]) {
          const randomMove = Math.random();
          const currentPos = this.state.players[botId].position;
          const newPos = { ...currentPos };

          if (randomMove < 0.25) newPos.x += Math.random() * 10;
          else if (randomMove < 0.5) newPos.x -= Math.random() * 10;
          else if (randomMove < 0.75) newPos.z += Math.random() * 10;
          else newPos.z -= Math.random() * 10;

          // Keep within map bounds
          const halfSize = config.mapSize / 2 - 10;
          newPos.x = Math.max(-halfSize, Math.min(halfSize, newPos.x));
          newPos.z = Math.max(-halfSize, Math.min(halfSize, newPos.z));

          this.updatePlayer(botId, { position: newPos });
        }
      }, 1000 + Math.random() * 2000); // Random interval between 1-3 seconds
    }

    this.updatePlayerCounts();
  }

  private updatePlayerCounts() {
    this.state.totalPlayers = Object.keys(this.state.players).length;
    this.state.alivePlayers = Object.values(this.state.players).filter(
      (p) => p.health > 0
    ).length;
  }

  public handleShot(shooterId: string, direction: Vector3): boolean {
    const shooter = this.state.players[shooterId];

    // Remove ammo check - weapons now have infinite ammo
    if (!shooter) return false;

    let hit = false;

    // Check for hits on players
    Object.entries(this.state.players).forEach(([id, target]) => {
      if (id === shooterId || target.health <= 0) return;

      const distance = this.calculateDistance(
        shooter.position,
        target.position
      );
      if (
        distance <= config.weaponStats[shooter.weapon.type].range &&
        this.isInLineOfSight(shooter.position, target.position, direction)
      ) {
        hit = true;
        this.applyDamage(
          id,
          config.weaponStats[shooter.weapon.type].damage,
          shooterId
        );

        // Add blood splash
        this.addBloodSplash(target.position);
      }
    });

    // Check for hits on birds - one-shot kill
    this.state.birds.forEach((bird, index) => {
      if (bird.health <= 0) return;

      const distance = this.calculateDistance(shooter.position, bird.position);
      if (
        distance <= config.weaponStats[shooter.weapon.type].range &&
        this.isInLineOfSight(shooter.position, bird.position, direction)
      ) {
        hit = true;
        bird.health = 0; // One-shot kill

        // Add blood splash
        this.addBloodSplash(bird.position);
      }
    });

    // Check for hits on chickens - one-shot kill
    this.state.chickens.forEach((chicken, index) => {
      if (chicken.health <= 0) return;

      const distance = this.calculateDistance(
        shooter.position,
        chicken.position
      );
      if (
        distance <= config.weaponStats[shooter.weapon.type].range &&
        this.isInLineOfSight(shooter.position, chicken.position, direction)
      ) {
        hit = true;
        chicken.health = 0; // One-shot kill

        // Add blood splash
        this.addBloodSplash(chicken.position);
      }
    });

    // Return hit status for sound effects
    return hit;
  }

  public addBloodSplash(position: Vector3) {
    this.state.bloodSplashes.push({
      id: `blood-${Date.now()}-${Math.random()}`,
      position: { ...position },
      timestamp: Date.now(),
    });
  }

  private calculateDistance(pos1: Vector3, pos2: Vector3): number {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    const dz = pos2.z - pos1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private isInLineOfSight(
    from: Vector3,
    to: Vector3,
    direction: Vector3
  ): boolean {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Normalize the direction vector
    const dirX = dx / distance;
    const dirY = dy / distance;
    const dirZ = dz / distance;

    // Calculate dot product
    const dot = dirX * direction.x + dirY * direction.y + dirZ * direction.z;
    return dot > 0.7; // Allow for some deviation (about 45 degrees)
  }

  private applyDamage(playerId: string, damage: number, shooterId?: string) {
    const player = this.state.players[playerId];
    if (!player) return;

    // Apply damage to shield first
    if (player.shield > 0) {
      player.shield = Math.max(0, player.shield - damage);
      return;
    }

    // Then to armor
    if (player.armor > 0) {
      player.armor = Math.max(0, player.armor - damage);
      return;
    }

    // Finally to health
    player.health = Math.max(0, player.health - damage);

    // Add blood splash
    this.addBloodSplash(player.position);

    if (player.health === 0) {
      this.handlePlayerDeath(playerId, shooterId);
    }
  }

  private handlePlayerDeath(playerId: string, killerId?: string) {
    const player = this.state.players[playerId];
    if (!player) return;

    player.deaths++;

    // Drop player's weapon
    this.dropPlayerWeapon(player);

    // Increment killer's kills
    if (killerId && this.state.players[killerId]) {
      this.state.players[killerId].kills++;
    }

    // Don't automatically respawn - wait for client request
    // this.respawnPlayer(playerId);

    this.updatePlayerCounts();
  }

  private dropPlayerWeapon(player: Player) {
    // Only drop non-pistol weapons
    if (player.weapon.type !== WeaponType.PISTOL) {
      const droppedWeapon: Weapon = {
        type: player.weapon.type,
        position: { ...player.position },
      };

      // Add to dead player weapons
      this.state.deadPlayerWeapons.push(droppedWeapon);

      // Limit the number of dead player weapons to prevent memory issues
      if (this.state.deadPlayerWeapons.length > 20) {
        this.state.deadPlayerWeapons.shift(); // Remove oldest weapon
      }
    }
  }

  public respawnPlayer(playerId: string) {
    const player = this.state.players[playerId];
    if (!player) return;

    player.position = this.getRandomGroundPosition();
    player.health = 100;
    player.armor = 100;
    player.shield = 100;
    player.weapon = this.getNewWeapon();
  }

  public useHealthKit(playerId: string) {
    const player = this.state.players[playerId];
    if (!player || player.health >= 100) return;
    player.health = 100;
  }

  public useShield(playerId: string) {
    const player = this.state.players[playerId];
    if (!player || player.shield >= 100) return;
    player.shield = 100;
  }

  public toggleView(playerId: string) {
    const player = this.state.players[playerId];
    if (!player) return;
    player.isThirdPerson = !player.isThirdPerson;
  }

  public toggleStats(playerId: string) {
    const player = this.state.players[playerId];
    if (!player) return;
    player.showStats = !player.showStats;
  }

  public pickupWeapon(
    playerId: string,
    weaponIndex: number,
    isDeadPlayerWeapon: boolean
  ) {
    const player = this.state.players[playerId];
    if (!player) return;

    let weapon: Weapon | undefined;

    if (isDeadPlayerWeapon) {
      const realIndex = weaponIndex - 1000;
      if (realIndex >= 0 && realIndex < this.state.deadPlayerWeapons.length) {
        weapon = this.state.deadPlayerWeapons[realIndex];
        // Remove from dead player weapons
        this.state.deadPlayerWeapons.splice(realIndex, 1);
      }
    } else {
      if (weaponIndex >= 0 && weaponIndex < this.state.weapons.length) {
        weapon = this.state.weapons[weaponIndex];
        // Remove from weapons
        this.state.weapons.splice(weaponIndex, 1);
        // Add a new weapon to maintain balance
        this.balanceWeapons();
      }
    }

    if (weapon) {
      // Store old weapon if not pistol
      if (player.weapon.type !== WeaponType.PISTOL) {
        const oldWeapon: Weapon = {
          type: player.weapon.type,
          position: { ...player.position },
        };

        // Add to weapons array
        this.state.weapons.push(oldWeapon);
      }

      // Update player's weapon
      player.weapon = {
        type: weapon.type,
      };
    }
  }

  public refillAmmo(
    playerId: string,
    weaponIndex: number,
    isDeadPlayerWeapon: boolean
  ) {
    const player = this.state.players[playerId];
    if (!player) return;

    let weapon: Weapon | undefined;

    if (isDeadPlayerWeapon) {
      const realIndex = weaponIndex - 1000;
      if (realIndex >= 0 && realIndex < this.state.deadPlayerWeapons.length) {
        weapon = this.state.deadPlayerWeapons[realIndex];
        // Remove from dead player weapons
        this.state.deadPlayerWeapons.splice(realIndex, 1);
      }
    } else {
      if (weaponIndex >= 0 && weaponIndex < this.state.weapons.length) {
        weapon = this.state.weapons[weaponIndex];
        // Remove from weapons
        this.state.weapons.splice(weaponIndex, 1);
        // Add a new weapon to maintain balance
        this.balanceWeapons();
      }
    }

    if (weapon && weapon.type === player.weapon.type) {
      // Refill ammo
      player.weapon = {
        type: weapon.type,
      };
    }
  }

  private getNewWeapon(type: WeaponType = WeaponType.PISTOL): Weapon {
    return {
      type,
      // No ammo property needed anymore
    };
  }
}
