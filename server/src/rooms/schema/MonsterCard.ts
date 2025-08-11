import { Schema, type, ArraySchema } from "@colyseus/schema";
import { MonsterSquare } from "./MonsterSquare";

/**
 * Represents a monster card (deck and in play).
 * assignedRoomIndex: -1 if not assigned to a room, else room index.
 * ownerSessionId: "" if not claimed, else sessionId of owning player.
 */
export class MonsterCard extends Schema {
  @type("string") id: string = "";
  @type("string") name: string = "";
  @type("number") width: number = 0;
  @type("number") height: number = 0;
  @type([MonsterSquare]) squares = new ArraySchema<MonsterSquare>();
  @type("number") assignedRoomIndex: number = -1;
  @type("string") ownerSessionId: string = "";

  constructor(
    id = "",
    name = "",
    width = 0,
    height = 0,
    filledCoords: Array<[number, number]> = []
  ) {
    super();
    this.id = id;
    this.name = name;
    this.width = width;
    this.height = height;
    // Fill squares array: row-major order (y*width + x)
    const filledSet = new Set(filledCoords.map(([x, y]) => `${x},${y}`));
    for (let y = 0; y &lt; height; y++) {
      for (let x = 0; x &lt; width; x++) {
        const filled = filledSet.has(`${x},${y}`);
        this.squares.push(new MonsterSquare(filled));
      }
    }
    this.assignedRoomIndex = -1;
    this.ownerSessionId = "";
  }

  /**
   * Get square at (x, y) within the monster's grid.
   * Returns undefined if out of bounds.
   */
  getSquare(x: number, y: number): MonsterSquare | undefined {
    if (
      x &lt; 0 ||
      x &gt;= this.width ||
      y &lt; 0 ||
      y &gt;= this.height
    ) return undefined;
    return this.squares[y * this.width + x];
  }
}