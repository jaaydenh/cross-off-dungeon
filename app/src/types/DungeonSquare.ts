import { Schema, type, ArraySchema, MapSchema, SetSchema, DataChange } from '@colyseus/schema';

export class DungeonSquare extends Schema {
  @type("boolean") checked: boolean = false;
  @type("boolean") entrance: boolean = false;
  @type("boolean") exit: boolean = false;
  @type("boolean") treasure: boolean = false;
  @type("boolean") monster: boolean = false;
  @type("boolean") wall: boolean = false;
}
