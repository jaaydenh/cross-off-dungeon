import { Schema, Context, type } from "@colyseus/schema";

export class Player extends Schema {
  constructor(name: string) {
    super();
    this.name = name;
  }

  @type("string") name: string;
}