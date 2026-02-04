import { Schema, type, ArraySchema } from "@colyseus/schema";
import { Card } from "./Card";

export class Player extends Schema {
  constructor(name: string) {
    super();
    this.name = name;
    this.deck = new ArraySchema<Card>();
    this.drawnCards = new ArraySchema<Card>();
    this.discardPile = new ArraySchema<Card>();
    this.turnStatus = "not_started";
    this.hasDrawnCard = false;

    // Initialize shuffled deck of 10 cards
    this.initializeDeck();
  }

  @type("string") name: string;
  @type([Card]) deck = new ArraySchema<Card>();
  @type([Card]) drawnCards = new ArraySchema<Card>();
  @type([Card]) discardPile = new ArraySchema<Card>();
  @type("string") turnStatus: "not_started" | "playing_turn" | "turn_complete" = "not_started";
  @type("boolean") hasDrawnCard: boolean = false;

  private initializeDeck(): void {
    // Create 10 cards of type "cross_connected_squares"
    const cards: Card[] = [];
    for (let i = 1; i <= 10; i++) {
      const card = new Card(
        `card_${i}`,
        "cross_connected_squares",
        "Cross any 3 connected squares"
      );
      cards.push(card);
    }

    // Shuffle the cards using Fisher-Yates algorithm
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }

    // Add shuffled cards to deck
    cards.forEach(card => this.deck.push(card));
  }
}