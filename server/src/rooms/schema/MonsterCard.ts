import { Schema, type, ArraySchema } from "@colyseus/schema";
import { MonsterSquare } from "./MonsterSquare";

export class MonsterCard extends Schema {
  constructor(id: string, name: string, width: number, height: number) {
    super();
    this.id = id;
    this.name = name;
    this.width = width;
    this.height = height;
    this.squares = new ArraySchema<MonsterSquare>();
    this.playerOwnerId = "";
    this.connectedToRoomIndex = -1;
    
    // Initialize empty grid
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        this.squares.push(new MonsterSquare(x, y, false));
      }
    }
  }

  @type("string") id: string;
  @type("string") name: string; // bat, goblin, rat, troll, slime
  @type("number") width: number;
  @type("number") height: number;
  @type([MonsterSquare]) squares = new ArraySchema<MonsterSquare>();
  @type("string") playerOwnerId: string = ""; // SessionId of player who owns this monster, empty if unowned
  @type("number") connectedToRoomIndex: number = -1; // Index of room this monster is connected to (-1 if in player area)

  /**
   * Set a square as part of the monster pattern
   */
  setSquareFilled(x: number, y: number, filled: boolean = true): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      const index = y * this.width + x;
      if (index >= 0 && index < this.squares.length) {
        this.squares[index].filled = filled;
      }
    }
  }

  /**
   * Get a square at the specified coordinates
   */
  getSquare(x: number, y: number): MonsterSquare | null {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      const index = y * this.width + x;
      if (index >= 0 && index < this.squares.length) {
        return this.squares[index];
      }
    }
    return null;
  }

  /**
   * Check if the monster is completely crossed off
   */
  isCompleted(): boolean {
    for (let i = 0; i < this.squares.length; i++) {
      const square = this.squares[i];
      if (square.filled && !square.checked) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get the total number of filled squares
   */
  getTotalSquares(): number {
    return this.squares.filter(square => square.filled).length;
  }

  /**
   * Get the number of crossed squares
   */
  getCrossedSquares(): number {
    return this.squares.filter(square => square.filled && square.checked).length;
  }
}