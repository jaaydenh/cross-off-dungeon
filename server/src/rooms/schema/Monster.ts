import { Schema, type } from "@colyseus/schema";

export class Monster extends Schema {
  @type("string") name: string = "Goblin";
  @type("number") hp: number = 10;
  @type("number") x: number = 0;
  @type("number") y: number = 0;

  constructor(name: string = "Goblin", hp: number = 10, x: number = 0, y: number = 0) {
    super();
    this.name = name;
    this.hp = hp;
    this.x = x;
    this.y = y;
  }
}