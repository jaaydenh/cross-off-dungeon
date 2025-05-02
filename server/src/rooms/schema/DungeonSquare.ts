import { Schema, type } from "@colyseus/schema";

export class DungeonSquare extends Schema {
  constructor() {
    super();
    this.checked = false;
    this.entrance = false;
    this.exit = false;
    this.treasure = false;
    this.monster = false;
    this.wall = false;
  }

  @type("boolean") checked: boolean;
  @type("boolean") entrance: boolean;
  @type("boolean") exit: boolean;
  @type("boolean") treasure: boolean;
  @type("boolean") monster: boolean;
  @type("boolean") wall: boolean;
}
