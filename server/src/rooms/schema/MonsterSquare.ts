import { Schema, type } from "@colyseus/schema";

/**
 * Represents a single square in a monster's shape.
 */
export class MonsterSquare extends Schema {
  @type("boolean") filled: boolean = false;
  @type("boolean") checked: boolean = false;

  constructor(filled = false) {
    super();
    this.filled = filled;
    this.checked = false;
  }
}