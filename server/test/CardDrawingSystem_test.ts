import assert from "assert";
import { ColyseusTestServer } from "@colyseus/testing";
import { describe, it, before, after, beforeEach } from "mocha";
import appConfig from "../src/app.config";
import { CARD_DEFINITIONS } from "../src/rooms/cards/CardRegistry";
import {
  bootSandboxSafe,
  cleanupSandboxSafe,
  shutdownSandboxSafe
} from "./helpers/colyseusTestUtils";

const STARTER_DECK_SIZE = CARD_DEFINITIONS.length * 2;

describe("Card Drawing System", () => {
  let colyseus: ColyseusTestServer | undefined;

  before(async function () {
    colyseus = await bootSandboxSafe(this, appConfig);
  });
  after(async () => await shutdownSandboxSafe(colyseus));
  beforeEach(async () => await cleanupSandboxSafe(colyseus));

  describe("Basic Card Drawing", () => {
    it("should successfully draw a card when conditions are met", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const player = room.state.players.get(client.sessionId)!;
      
      // Verify initial state
      assert.strictEqual(player.deck.length, STARTER_DECK_SIZE);
      assert.strictEqual(player.drawnCards.length, 0);
      assert.strictEqual(player.hasDrawnCard, false);
      assert.strictEqual(player.turnStatus, "not_started");

      // Draw a card
      const result = room.state.drawCard(client.sessionId);
      
      // Verify successful result
      assert.strictEqual(result.success, true);
      assert(result.message?.includes("Drew card:"));
      
      // Verify state changes
      assert.strictEqual(player.deck.length, STARTER_DECK_SIZE - 1);
      assert.strictEqual(player.drawnCards.length, 1);
      assert.strictEqual(player.hasDrawnCard, true);
      assert.strictEqual(player.turnStatus, "playing_turn");
    });

    it("should draw the top card from deck", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const player = room.state.players.get(client.sessionId)!;
      const topCardId = player.deck[0].id;
      
      // Draw a card
      room.state.drawCard(client.sessionId);
      
      // Verify the drawn card is the one that was on top
      assert.strictEqual(player.drawnCards[0].id, topCardId);
    });

    it("should handle drawCard message correctly", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const player = room.state.players.get(client.sessionId)!;

      // Send drawCard message
      client.send("drawCard", {});
      await room.waitForNextPatch();

      // Verify state changed
      assert.strictEqual(player.drawnCards.length, 1);
      assert.strictEqual(player.hasDrawnCard, true);
      assert.strictEqual(player.turnStatus, "playing_turn");
    });
  });

  describe("Card Drawing Restrictions", () => {
    it("should prevent drawing multiple cards per turn", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const player = room.state.players.get(client.sessionId)!;
      
      // Draw first card successfully
      const result1 = room.state.drawCard(client.sessionId);
      assert.strictEqual(result1.success, true);
      
      // Try to draw second card - should fail
      const result2 = room.state.drawCard(client.sessionId);
      assert.strictEqual(result2.success, false);
      assert(result2.error?.includes("Cannot draw card"));
      
      // Verify state hasn't changed
      assert.strictEqual(player.deck.length, STARTER_DECK_SIZE - 1);
      assert.strictEqual(player.drawnCards.length, 1);
      assert.strictEqual(player.hasDrawnCard, true);
      assert.strictEqual(player.turnStatus, "playing_turn");
    });

    it("should prevent drawing when player status is turn_complete", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client1 = await colyseus.connectTo(room, { name: "Player1" });
      const client2 = await colyseus.connectTo(room, { name: "Player2" });

      const player1 = room.state.players.get(client1.sessionId)!;
      
      // Set player1 to turn_complete status
      room.state.updatePlayerTurnStatus(client1.sessionId, "playing_turn");
      room.state.updatePlayerTurnStatus(client1.sessionId, "turn_complete");
      
      // Try to draw card - should fail
      const result = room.state.drawCard(client1.sessionId);
      assert.strictEqual(result.success, false);
      assert(result.error?.includes("Cannot draw card"));
      
      // Verify state hasn't changed
      assert.strictEqual(player1.deck.length, STARTER_DECK_SIZE);
      assert.strictEqual(player1.drawnCards.length, 0);
      assert.strictEqual(player1.hasDrawnCard, false);
    });

    it("should prevent drawing when deck is empty", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const player = room.state.players.get(client.sessionId)!;
      
      // Empty the deck
      player.deck.clear();
      
      // Try to draw card - should fail
      const result = room.state.drawCard(client.sessionId);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, "No cards left in deck");
      
      // Verify state hasn't changed
      assert.strictEqual(player.deck.length, 0);
      assert.strictEqual(player.drawnCards.length, 0);
      assert.strictEqual(player.hasDrawnCard, false);
      assert.strictEqual(player.turnStatus, "not_started");
    });

    it("should handle non-existent player gracefully", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      
      // Try to draw card for non-existent player
      const result = room.state.drawCard("non-existent-id");
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, "Player not found");
    });
  });

  describe("Card Drawing in Multi-Player Scenarios", () => {
    it("should allow each player to draw independently", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client1 = await colyseus.connectTo(room, { name: "Player1" });
      const client2 = await colyseus.connectTo(room, { name: "Player2" });

      const player1 = room.state.players.get(client1.sessionId)!;
      const player2 = room.state.players.get(client2.sessionId)!;
      
      // Both players should be able to draw cards
      const result1 = room.state.drawCard(client1.sessionId);
      const result2 = room.state.drawCard(client2.sessionId);
      
      assert.strictEqual(result1.success, true);
      assert.strictEqual(result2.success, true);
      
      // Verify both players have drawn cards
      assert.strictEqual(player1.drawnCards.length, 1);
      assert.strictEqual(player2.drawnCards.length, 1);
      assert.strictEqual(player1.hasDrawnCard, true);
      assert.strictEqual(player2.hasDrawnCard, true);
      assert.strictEqual(player1.turnStatus, "playing_turn");
      assert.strictEqual(player2.turnStatus, "playing_turn");
    });

    it("should maintain separate deck states for each player", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client1 = await colyseus.connectTo(room, { name: "Player1" });
      const client2 = await colyseus.connectTo(room, { name: "Player2" });

      const player1 = room.state.players.get(client1.sessionId)!;
      const player2 = room.state.players.get(client2.sessionId)!;
      
      // Get initial top cards
      const player1TopCard = player1.deck[0].id;
      const player2TopCard = player2.deck[0].id;
      
      // Draw cards
      room.state.drawCard(client1.sessionId);
      room.state.drawCard(client2.sessionId);
      
      // Verify each player drew their own top card
      assert.strictEqual(player1.drawnCards[0].id, player1TopCard);
      assert.strictEqual(player2.drawnCards[0].id, player2TopCard);
      
      // Verify deck counts are independent
      assert.strictEqual(player1.deck.length, STARTER_DECK_SIZE - 1);
      assert.strictEqual(player2.deck.length, STARTER_DECK_SIZE - 1);
    });
  });

  describe("Card Drawing State Transitions", () => {
    it("should transition from not_started to playing_turn", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const player = room.state.players.get(client.sessionId)!;
      
      // Verify initial state
      assert.strictEqual(player.turnStatus, "not_started");
      assert.strictEqual(player.hasDrawnCard, false);
      
      // Draw card
      room.state.drawCard(client.sessionId);
      
      // Verify state transition
      assert.strictEqual(player.turnStatus, "playing_turn");
      assert.strictEqual(player.hasDrawnCard, true);
    });

    it("should maintain playing_turn status after drawing", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const player = room.state.players.get(client.sessionId)!;
      
      // Draw card
      room.state.drawCard(client.sessionId);
      
      // Verify status remains playing_turn
      assert.strictEqual(player.turnStatus, "playing_turn");
      
      // Try to draw again (should fail but not change status)
      room.state.drawCard(client.sessionId);
      assert.strictEqual(player.turnStatus, "playing_turn");
    });
  });

  describe("Card Properties After Drawing", () => {
    it("should maintain card properties when drawn", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const player = room.state.players.get(client.sessionId)!;
      
      // Draw card
      room.state.drawCard(client.sessionId);
      
      // Verify drawn card properties
      const drawnCard = player.drawnCards[0];
      const expectedTypes = new Set([
        "cross_connected_squares",
        "cross_any_two_room_or_monster",
        "cross_two_connected_each_monster",
        "cross_row_room",
        "cross_two_horizontal_then_two_horizontal"
      ]);
      assert(expectedTypes.has(drawnCard.type), `Unexpected type: ${drawnCard.type}`);
      assert.strictEqual(typeof drawnCard.description, "string");
      assert(drawnCard.description.length > 0);
      assert.strictEqual(typeof drawnCard.selectionTarget, "string");
      assert.strictEqual(typeof drawnCard.selectionMode, "string");
      assert.strictEqual(drawnCard.isActive, false);
      assert(drawnCard.id.startsWith("card_"));
    });

    it("should preserve card ID when moving from deck to drawn", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const player = room.state.players.get(client.sessionId)!;
      const originalCardId = player.deck[0].id;
      
      // Draw card
      room.state.drawCard(client.sessionId);
      
      // Verify same card ID
      assert.strictEqual(player.drawnCards[0].id, originalCardId);
    });
  });

  describe("Error Handling", () => {
    it("should handle concurrent draw attempts gracefully", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const player = room.state.players.get(client.sessionId)!;
      
      // Simulate concurrent draw attempts
      const result1 = room.state.drawCard(client.sessionId);
      const result2 = room.state.drawCard(client.sessionId);
      
      // One should succeed, one should fail
      assert.strictEqual(result1.success, true);
      assert.strictEqual(result2.success, false);
      
      // Verify final state is consistent
      assert.strictEqual(player.deck.length, STARTER_DECK_SIZE - 1);
      assert.strictEqual(player.drawnCards.length, 1);
      assert.strictEqual(player.hasDrawnCard, true);
    });

    it("should provide meaningful error messages", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      // Test various error conditions
      const nonExistentResult = room.state.drawCard("fake-id");
      assert(nonExistentResult.error?.includes("Player not found"));
      
      // Draw a card first
      room.state.drawCard(client.sessionId);
      
      // Try to draw again
      const duplicateResult = room.state.drawCard(client.sessionId);
      assert(duplicateResult.error?.includes("Cannot draw card"));
      
      // Empty deck
      const player = room.state.players.get(client.sessionId)!;
      player.deck.clear();
      player.hasDrawnCard = false;
      player.turnStatus = "not_started";
      
      const emptyDeckResult = room.state.drawCard(client.sessionId);
      assert.strictEqual(emptyDeckResult.error, "No cards left in deck");
    });
  });
});
