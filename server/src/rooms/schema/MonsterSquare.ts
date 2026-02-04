import { Schema, type } from "@colyseus/schema";

export class MonsterSquare extends Schema {
  constructor(x: number = 0, y: number = 0, filled: boolean = false) {
    super();
    this.x = x;
    this.y = y;
    this.filled = filled;
    this.checked = false;
  }

  @type("number") x: number;
  @type("number") y: number;
  @type("boolean") filled: boolean = false; // Whether this square is part of the monster pattern
  @type("boolean") checked: boolean = false; // Whether player has crossed this square
}