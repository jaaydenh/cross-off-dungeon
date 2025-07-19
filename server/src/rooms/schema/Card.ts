import { Schema, type } from "@colyseus/schema";

export class Card extends Schema {
  constructor(id: string, type: string, description: string) {
    super();
    this.id = id;
    this.type = type;
    this.description = description;
    this.isActive = false;
  }

  @type("string") id: string;
  @type("string") type: string;
  @type("string") description: string;
  @type("boolean") isActive: boolean = false;
}