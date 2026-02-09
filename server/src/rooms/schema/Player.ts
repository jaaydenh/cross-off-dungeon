import { Schema, type, ArraySchema } from "@colyseus/schema";
import { Card } from "./Card";
import { createStarterDeck } from "../cards/CardRegistry";

export class Player extends Schema {
  constructor(name: string) {
    super();
    this.name = name;
    this.deck = new ArraySchema<Card>();
    this.drawnCards = new ArraySchema<Card>();
    this.discardPile = new ArraySchema<Card>();
    this.turnStatus = "not_started";
    this.hasDrawnCard = false;

    // Initialize shuffled deck (2x each starter card type)
    this.initializeDeck();
  }

  @type("string") name: string;
  @type([Card]) deck = new ArraySchema<Card>();
  @type([Card]) drawnCards = new ArraySchema<Card>();
  @type([Card]) discardPile = new ArraySchema<Card>();
  @type("string") turnStatus: "not_started" | "playing_turn" | "turn_complete" = "not_started";
  @type("boolean") hasDrawnCard: boolean = false;

  private initializeDeck(): void {
    const cards: Card[] = createStarterDeck();

    // Add shuffled cards to deck
    cards.forEach(card => this.deck.push(card));
  }
}
