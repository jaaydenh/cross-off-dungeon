import assert from "assert";
import { describe, it } from "mocha";
import { Player } from "../src/rooms/schema/Player";
import { Card } from "../src/rooms/schema/Card";

describe("Player Schema Extensions", () => {
  describe("Player Construction", () => {
    it("should create a player with correct initial properties", () => {
      const player = new Player("TestPlayer");
      
      assert.strictEqual(player.name, "TestPlayer");
      assert.strictEqual(player.deck.length, 10);
      assert.strictEqual(player.drawnCards.length, 0);
      assert.strictEqual(player.discardPile.length, 0);
      assert.strictEqual(player.turnStatus, "not_started");
      assert.strictEqual(player.hasDrawnCard, false);
    });

    it("should initialize deck with 10 cards", () => {
      const player = new Player("TestPlayer");
      
      assert.strictEqual(player.deck.length, 10);
      
      // Verify all cards are of correct type
      for (let i = 0; i < player.deck.length; i++) {
        const card = player.deck[i];
        assert.strictEqual(card.type, "cross_connected_squares");
        assert.strictEqual(card.description, "Cross any 3 connected squares");
        assert.strictEqual(card.isActive, false);
        assert(card.id.startsWith("card_"));
      }
    });

    it("should create unique card IDs", () => {
      const player = new Player("TestPlayer");
      const cardIds = new Set();
      
      for (let i = 0; i < player.deck.length; i++) {
        const cardId = player.deck[i].id;
        assert(!cardIds.has(cardId), `Duplicate card ID found: ${cardId}`);
        cardIds.add(cardId);
      }
      
      assert.strictEqual(cardIds.size, 10);
    });

    it("should shuffle deck randomly", () => {
      // Create multiple players and check that their deck orders are different
      const player1 = new Player("Player1");
      const player2 = new Player("Player2");
      
      // Get the order of card IDs
      const deck1Order = player1.deck.map(card => card.id);
      const deck2Order = player2.deck.map(card => card.id);
      
      // While it's theoretically possible for two shuffled decks to be identical,
      // it's extremely unlikely (1 in 10! = 3,628,800)
      // We'll check that at least one position is different
      let foundDifference = false;
      for (let i = 0; i < deck1Order.length; i++) {
        if (deck1Order[i] !== deck2Order[i]) {
          foundDifference = true;
          break;
        }
      }
      
      // If they're identical, create a few more players to increase confidence
      if (!foundDifference) {
        const player3 = new Player("Player3");
        const deck3Order = player3.deck.map(card => card.id);
        
        for (let i = 0; i < deck1Order.length; i++) {
          if (deck1Order[i] !== deck3Order[i]) {
            foundDifference = true;
            break;
          }
        }
      }
      
      // Note: This test might occasionally fail due to random chance, but it's very unlikely
      assert(foundDifference, "Deck shuffling should produce different orders");
    });
  });

  describe("Turn Status Management", () => {
    it("should initialize with not_started status", () => {
      const player = new Player("TestPlayer");
      assert.strictEqual(player.turnStatus, "not_started");
    });

    it("should allow valid status transitions", () => {
      const player = new Player("TestPlayer");
      
      player.turnStatus = "playing_turn";
      assert.strictEqual(player.turnStatus, "playing_turn");
      
      player.turnStatus = "turn_complete";
      assert.strictEqual(player.turnStatus, "turn_complete");
      
      player.turnStatus = "not_started";
      assert.strictEqual(player.turnStatus, "not_started");
    });
  });

  describe("Card Drawing State", () => {
    it("should initialize hasDrawnCard as false", () => {
      const player = new Player("TestPlayer");
      assert.strictEqual(player.hasDrawnCard, false);
    });

    it("should allow setting hasDrawnCard to true", () => {
      const player = new Player("TestPlayer");
      player.hasDrawnCard = true;
      assert.strictEqual(player.hasDrawnCard, true);
    });

    it("should allow resetting hasDrawnCard to false", () => {
      const player = new Player("TestPlayer");
      player.hasDrawnCard = true;
      player.hasDrawnCard = false;
      assert.strictEqual(player.hasDrawnCard, false);
    });
  });

  describe("Card Collections", () => {
    it("should allow adding cards to drawnCards", () => {
      const player = new Player("TestPlayer");
      const card = new Card("test_card", "cross_connected_squares", "Test card");
      
      player.drawnCards.push(card);
      assert.strictEqual(player.drawnCards.length, 1);
      assert.strictEqual(player.drawnCards[0].id, "test_card");
    });

    it("should allow adding cards to discardPile", () => {
      const player = new Player("TestPlayer");
      const card = new Card("test_card", "cross_connected_squares", "Test card");
      
      player.discardPile.push(card);
      assert.strictEqual(player.discardPile.length, 1);
      assert.strictEqual(player.discardPile[0].id, "test_card");
    });

    it("should allow removing cards from deck", () => {
      const player = new Player("TestPlayer");
      const initialCount = player.deck.length;
      
      const removedCard = player.deck.shift();
      assert(removedCard !== undefined);
      assert.strictEqual(player.deck.length, initialCount - 1);
    });

    it("should maintain card references when moving between collections", () => {
      const player = new Player("TestPlayer");
      
      // Move a card from deck to drawnCards
      const card = player.deck.shift();
      assert(card !== undefined);
      player.drawnCards.push(card!);
      
      // Verify the card maintains its properties
      assert.strictEqual(player.drawnCards[0].type, "cross_connected_squares");
      assert.strictEqual(player.drawnCards[0].description, "Cross any 3 connected squares");
      
      // Move card from drawnCards to discardPile
      const drawnCard = player.drawnCards.shift();
      assert(drawnCard !== undefined);
      player.discardPile.push(drawnCard!);
      
      // Verify the card is the same reference
      assert.strictEqual(player.discardPile[0], card);
    });
  });

  describe("Deck Integrity", () => {
    it("should contain exactly 10 cards with sequential IDs", () => {
      const player = new Player("TestPlayer");
      
      // Collect all card IDs and sort them
      const cardIds = player.deck.map(card => card.id).sort();
      
      // Verify we have cards 1-10
      for (let i = 1; i <= 10; i++) {
        assert(cardIds.includes(`card_${i}`), `Missing card_${i}`);
      }
    });

    it("should not have duplicate cards in deck", () => {
      const player = new Player("TestPlayer");
      const cardIds = new Set();
      
      for (const card of player.deck) {
        assert(!cardIds.has(card.id), `Duplicate card found: ${card.id}`);
        cardIds.add(card.id);
      }
    });

    it("should maintain deck integrity after multiple operations", () => {
      const player = new Player("TestPlayer");
      
      // Perform various operations
      const card1 = player.deck.shift();
      const card2 = player.deck.shift();
      
      if (card1) player.drawnCards.push(card1);
      if (card2) player.discardPile.push(card2);
      
      // Verify total cards remain 10
      const totalCards = player.deck.length + player.drawnCards.length + player.discardPile.length;
      assert.strictEqual(totalCards, 10);
      
      // Verify no duplicates across all collections
      const allCardIds = new Set();
      
      [...player.deck, ...player.drawnCards, ...player.discardPile].forEach(card => {
        assert(!allCardIds.has(card.id), `Duplicate card found: ${card.id}`);
        allCardIds.add(card.id);
      });
      
      assert.strictEqual(allCardIds.size, 10);
    });
  });

  describe("Player Name Handling", () => {
    it("should handle empty name", () => {
      const player = new Player("");
      assert.strictEqual(player.name, "");
      assert.strictEqual(player.deck.length, 10); // Deck should still be initialized
    });

    it("should handle special characters in name", () => {
      const specialName = "Player@#$%^&*()";
      const player = new Player(specialName);
      assert.strictEqual(player.name, specialName);
    });

    it("should handle very long names", () => {
      const longName = "A".repeat(1000);
      const player = new Player(longName);
      assert.strictEqual(player.name, longName);
    });
  });
});