import { Schema, type } from "@colyseus/schema";

export type CardDefenseSymbol = "empty" | "block" | "counter";
export type CardColor = "clear" | "red" | "blue" | "green";

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
    defenseSymbol: CardDefenseSymbol = "empty",
    drawCardsOnResolve: number = 0,
    color: CardColor = "clear",
    name: string = ""
  ) {
    super();
    this.id = id;
    this.type = type;
    this.name = name;
    this.description = description;
    this.selectionTarget = selectionTarget;
    this.selectionMode = selectionMode;
    this.minSelections = minSelections;
    this.maxSelections = maxSelections;
    this.requiresConnected = requiresConnected;
    this.requiresRoomStartAdjacency = requiresRoomStartAdjacency;
    this.requiresMonsterStartAdjacency = requiresMonsterStartAdjacency;
    this.defenseSymbol = defenseSymbol;
    this.drawCardsOnResolve = Math.max(0, Math.floor(drawCardsOnResolve || 0));
    this.color = color;
    this.isActive = false;
  }

  @type("string") id: string;
  @type("string") type: string;
  @type("string") name: string;
  @type("string") description: string;
  @type("string") selectionTarget: string;
  @type("string") selectionMode: string;
  @type("number") minSelections: number = 1;
  @type("number") maxSelections: number = 0;
  @type("boolean") requiresConnected: boolean = false;
  @type("boolean") requiresRoomStartAdjacency: boolean = false;
  @type("boolean") requiresMonsterStartAdjacency: boolean = false;
  @type("string") defenseSymbol: CardDefenseSymbol = "empty"; // empty, block, counter
  @type("number") drawCardsOnResolve: number = 0;
  @type("string") color: CardColor = "clear";
  @type("boolean") isActive: boolean = false;
}
