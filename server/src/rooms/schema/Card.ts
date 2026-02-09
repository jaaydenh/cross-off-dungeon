import { Schema, type } from "@colyseus/schema";

export type CardDefenseSymbol = "empty" | "block" | "counter";

export class Card extends Schema {
  constructor(
    id: string,
    type: string,
    description: string,
    selectionTarget: string,
    selectionMode: string,
    minSelections: number,
    maxSelections: number,
    requiresConnected: boolean,
    requiresRoomStartAdjacency: boolean,
    requiresMonsterStartAdjacency: boolean,
    defenseSymbol: CardDefenseSymbol = "empty"
  ) {
    super();
    this.id = id;
    this.type = type;
    this.description = description;
    this.selectionTarget = selectionTarget;
    this.selectionMode = selectionMode;
    this.minSelections = minSelections;
    this.maxSelections = maxSelections;
    this.requiresConnected = requiresConnected;
    this.requiresRoomStartAdjacency = requiresRoomStartAdjacency;
    this.requiresMonsterStartAdjacency = requiresMonsterStartAdjacency;
    this.defenseSymbol = defenseSymbol;
    this.isActive = false;
  }

  @type("string") id: string;
  @type("string") type: string;
  @type("string") description: string;
  @type("string") selectionTarget: string;
  @type("string") selectionMode: string;
  @type("number") minSelections: number = 1;
  @type("number") maxSelections: number = 0;
  @type("boolean") requiresConnected: boolean = false;
  @type("boolean") requiresRoomStartAdjacency: boolean = false;
  @type("boolean") requiresMonsterStartAdjacency: boolean = false;
  @type("string") defenseSymbol: CardDefenseSymbol = "empty"; // empty, block, counter
  @type("boolean") isActive: boolean = false;
}
