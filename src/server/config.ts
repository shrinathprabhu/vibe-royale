import { GameConfig, WeaponType } from "../shared/types";

export const config: GameConfig = {
  mapSize: 1000, // 1km x 1km
  viewDistance: 300, // 300m view distance
  maxPlayers: 50,
  minBots: 50, // Increased from 20 to 50
  weaponStats: {
    [WeaponType.PISTOL]: {
      damage: 10,
      range: 100,
      maxAmmo: 45,
      level: 1,
    },
    [WeaponType.SHOTGUN]: {
      damage: 25,
      range: 50,
      maxAmmo: 30,
      level: 2,
    },
    [WeaponType.RIFLE]: {
      damage: 35,
      range: 300,
      maxAmmo: 60,
      level: 3,
    },
    [WeaponType.SNIPER]: {
      damage: 100,
      range: 1000,
      maxAmmo: 15,
      level: 4,
    },
  },
};
