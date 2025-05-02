import { Schema, type, ArraySchema } from "@colyseus/schema";
import { DungeonSquare } from "./DungeonSquare";

export class Room extends Schema {
  @type("number") width: number;
  @type("number") height: number;
  @type([ DungeonSquare ]) squares = new ArraySchema<DungeonSquare>();

  constructor(width: number = 8, height: number = 8) {
    super();
    this.width = width;
    this.height = height;
    this.initializeSquares();
  }

  private initializeSquares() {
    // Clear existing squares
    this.squares.clear();

    // Create squares based on width and height
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const square = new DungeonSquare();
        
        // Set some squares as walls (for example, border walls)
        if (x === 0 || y === 0 || x === this.width - 1 || y === this.height - 1) {
          square.wall = true;
        }
        
        this.squares.push(square);
      }
    }
  }

  // Get square at specific coordinates
  getSquare(x: number, y: number): DungeonSquare | undefined {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return undefined;
    }
    return this.squares[y * this.width + x];
  }

  // Set square at specific coordinates
  setSquare(x: number, y: number, square: DungeonSquare): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return false;
    }
    this.squares[y * this.width + x] = square;
    return true;
  }

  // Check if coordinates are valid
  isValidPosition(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  // Check if a square is walkable (not a wall)
  isWalkable(x: number, y: number): boolean {
    const square = this.getSquare(x, y);
    return square ? !square.wall : false;
  }
}

