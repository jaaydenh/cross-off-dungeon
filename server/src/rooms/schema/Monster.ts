import { Schema, type, ArraySchema } from "@colyseus/schema";

/**
 * Each Monster has a unique pattern of squares (2D array), where 1 = active square, 0 = empty.
 * Each monster also tracks which squares are crossed off by the player.
 */
export class Monster extends Schema {
  @type("string") name: string = "Goblin";
  @type("number") width: number = 3;
  @type("number") height: number = 3;

  // The pattern of the monster: 2D array (flattened) showing monster's shape. 1 = square exists, 0 = empty.
  @type([ "number" ]) pattern: ArraySchema<number> = new ArraySchema<number>();

  // The crossed-off state for each square (same layout as pattern, 0 = not crossed, 1 = crossed)
  @type([ "number" ]) crossed: ArraySchema<number> = new ArraySchema<number>();

  // If true, monster is currently in a player's area (not guarding a room)
  @type("boolean") inPlayerArea: boolean = false;

  // SessionId of the player who currently owns this monster, or "" if guarding a room
  @type("string") ownerPlayerId: string = "";

  // The index of the room the monster is currently guarding, or -1 if not on a room
  @type("number") guardingRoomIndex: number = -1;

  constructor(
    name: string,
    pattern: number[][] // 2D array of 0/1
  ) {
    super();
    this.name = name;
    this.width = pattern[0].length;
    this.height = pattern.length;
    // Flatten pattern for serialization
    this.pattern = new ArraySchema<number>(...pattern.flat());
    this.crossed = new ArraySchema<number>(...Array(this.width * this.height).fill(0));
  }

  /**
   * Cross off a square (x, y) if it is part of the monster pattern.
   * Returns true if successful, false if square is not part of monster or already crossed.
   */
  crossSquare(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
    const idx = y * this.width + x;
    if (this.pattern[idx] !== 1) return false;
    if (this.crossed[idx] === 1) return false;
    this.crossed[idx] = 1;
    return true;
  }

  /**
   * Returns true if all monster squares have been crossed off (i.e., monster defeated).
   */
  isDefeated(): boolean {
    for (let i = 0; i < this.pattern.length; i++) {
      if (this.pattern[i] === 1 && this.crossed[i] === 0) return false;
    }
    return true;
  }
}

/**
 * Predefined monster patterns (shapes):
 * Each array is a 2D grid of 0/1, where 1 indicates part of the monster.
 */
export const MONSTER_DEFINITIONS: { [name: string]: number[][] } = {
  "Bat": [
    [0,1,0],
    [1,1,1],
    [1,0,1],
    [0,1,0]
  ],
  "Goblin": [
    [0,1,0],
    [1,1,1],
    [0,1,0],
    [1,1,1]
  ],
  "Rat": [
    [1,1,0],
    [0,1,1],
    [0,1,0],
    [1,1,1]
  ],
  "Troll": [
    [1,1,1],
    [1,0,1],
    [1,1,1],
    [1,1,1]
  ],
  "Slime": [
    [0,1,0],
    [1,1,1],
    [1,1,1],
    [0,1,0]
  ]
};

/**
 * Factory for creating a Monster instance by name.
 */
export function createMonsterByName(name: string): Monster {
  const pattern = MONSTER_DEFINITIONS[name];
  if (!pattern) throw new Error("Unknown monster: " + name);
  return new Monster(name, pattern);
}