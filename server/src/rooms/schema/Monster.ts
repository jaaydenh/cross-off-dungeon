import { Schema, type, ArraySchema } from "@colyseus/schema";

// A square on a monster card that can be crossed off
export class MonsterSquare extends Schema {
  @type("number") x: number;
  @type("number") y: number;
  @type("boolean") crossedOff: boolean = false;

  constructor(x: number = 0, y: number = 0) {
    super();
    this.x = x;
    this.y = y;
    this.crossedOff = false;
  }
}

export class Monster extends Schema {
  @type("string") name: string = "Goblin";
  @type("number") hp: number = 10;
  @type([ MonsterSquare ]) pattern = new ArraySchema<MonsterSquare>();
  @type("boolean") isAssigned: boolean = false; // Whether this monster is assigned to a player area

  constructor(name: string = "Goblin", hp: number = 10, pattern: MonsterSquare[] = []) {
    super();
    this.name = name;
    this.hp = hp;
    this.pattern = new ArraySchema<MonsterSquare>(...pattern);
    this.isAssigned = false;
  }

  // Utility: Are all squares crossed off?
  isDefeated(): boolean {
    return this.pattern.every(sq => sq.crossedOff);
  }
}