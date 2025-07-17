import { Schema, type, ArraySchema } from '@colyseus/schema';
import { DungeonSquare } from './DungeonSquare';

export class Room extends Schema {
  @type("number") width: number;
  @type("number") height: number;
  @type([ DungeonSquare ]) squares = new ArraySchema<DungeonSquare>();
  @type("string") entranceDirection: string = "none"; // Direction from which player entered
  @type("number") entranceX: number = -1;
  @type("number") entranceY: number = -1;
  @type(["string"]) exitDirections = new ArraySchema<string>(); // Directions where exits are placed
  @type(["number"]) exitX = new ArraySchema<number>();
  @type(["number"]) exitY = new ArraySchema<number>();
  
  // Grid coordinate properties
  @type("number") gridX: number = 0;
  @type("number") gridY: number = 0;
  
  // Connection tracking properties
  @type(["number"]) connectedRoomIndices = new ArraySchema<number>(); // Which rooms connect to each exit
  @type(["boolean"]) exitConnected = new ArraySchema<boolean>(); // Whether each exit connects to discovered room

  getSquare(x: number, y: number): DungeonSquare | undefined {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return undefined;
    }
    return this.squares[y * this.width + x];
  }

  // Get the opposite direction
  getOppositeDirection(direction: string): string {
    switch (direction) {
      case "north": return "south";
      case "east": return "west";
      case "south": return "north";
      case "west": return "east";
      default: return "none";
    }
  }
}
