"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Player = void 0;
const schema_1 = require("@colyseus/schema");
const Card_1 = require("./Card");
class Player extends schema_1.Schema {
    constructor(name) {
        super();
        this.deck = new schema_1.ArraySchema();
        this.drawnCards = new schema_1.ArraySchema();
        this.discardPile = new schema_1.ArraySchema();
        this.turnStatus = "not_started";
        this.hasDrawnCard = false;
        this.name = name;
        this.deck = new schema_1.ArraySchema();
        this.drawnCards = new schema_1.ArraySchema();
        this.discardPile = new schema_1.ArraySchema();
        this.turnStatus = "not_started";
        this.hasDrawnCard = false;
        // Initialize shuffled deck of 10 cards
        this.initializeDeck();
    }
    initializeDeck() {
        // Create 10 cards of type "cross_connected_squares"
        const cards = [];
        for (let i = 1; i <= 10; i++) {
            const card = new Card_1.Card(`card_${i}`, "cross_connected_squares", "Cross up to 3 connected squares");
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
exports.Player = Player;
__decorate([
    (0, schema_1.type)("string")
], Player.prototype, "name", void 0);
__decorate([
    (0, schema_1.type)([Card_1.Card])
], Player.prototype, "deck", void 0);
__decorate([
    (0, schema_1.type)([Card_1.Card])
], Player.prototype, "drawnCards", void 0);
__decorate([
    (0, schema_1.type)([Card_1.Card])
], Player.prototype, "discardPile", void 0);
__decorate([
    (0, schema_1.type)("string")
], Player.prototype, "turnStatus", void 0);
__decorate([
    (0, schema_1.type)("boolean")
], Player.prototype, "hasDrawnCard", void 0);
