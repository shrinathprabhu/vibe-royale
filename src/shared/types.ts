export interface Player {
  id: string;
  name: string;
  position: Vector3;
  rotation: Vector3;
  health: number;
  armor: number;
  helmet: number;
  shield: number;
  weapon: Weapon;
  kills: number;
  deaths: number;
  isZooming: boolean;
  zoomLevel: number;
  isThirdPerson: boolean;
  showStats: boolean;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Weapon {
  type: WeaponType;
  ammo?: number;
  level?: number;
  position?: Vector3;
}

export enum WeaponType {
  PISTOL = "pistol",
  SHOTGUN = "shotgun",
  RIFLE = "rifle",
  SNIPER = "sniper",
}

export interface GameState {
  players: { [id: string]: Player };
  weapons: Weapon[];
  collectibles: Collectible[];
  birds: Bird[];
  chickens: Chicken[];
  walls: Wall[];
  bloodSplashes: BloodSplash[];
  deadPlayerWeapons: Weapon[];
  totalPlayers: number;
  alivePlayers: number;
}

export interface Bird {
  id: string;
  position: Vector3;
  rotation: Vector3;
  color: string;
  health: number;
}

export interface Chicken {
  id: string;
  position: Vector3;
  rotation: Vector3;
  color: string;
  health: number;
}

export interface Wall {
  id: string;
  position: Vector3;
  size: {
    width: number;
    height: number;
    depth: number;
  };
  color: string;
}

export interface BloodSplash {
  id: string;
  position: Vector3;
  timestamp: number;
}

export interface Collectible {
  id: string;
  type: CollectibleType;
  position: Vector3;
}

export enum CollectibleType {
  HEALTH_KIT = "healthKit",
  ARMOR = "armor",
  HELMET = "helmet",
  SHIELD = "shield",
}

export interface GameConfig {
  mapSize: number;
  viewDistance: number;
  maxPlayers: number;
  minBots: number;
  weaponStats: {
    [key in WeaponType]: {
      damage: number;
      range: number;
      maxAmmo: number;
      level: number;
    };
  };
}
