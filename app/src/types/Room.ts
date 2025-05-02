import { Schema, type, ArraySchema } from '@colyseus/schema';
import { DungeonSquare } from './DungeonSquare';

export class Room extends Schema {
  @type("number") width: number = 0;
  @type("number") height: number = 0;
  @type([ DungeonSquare ]) squares = new ArraySchema<DungeonSquare>();

  getSquare(x: number, y: number): DungeonSquare | undefined {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return undefined;
    }
    return this.squares[y * this.width + x];
  }

  isWalkable(x: number, y: number): boolean {
    const square = this.getSquare(x, y);
    return square ? !square.wall : false;
  }
}

