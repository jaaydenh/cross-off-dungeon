import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import { describe, it, before, after, beforeEach } from "mocha";
import appConfig from "../src/app.config";
import { DungeonState } from "../src/rooms/schema/DungeonState";

describe("Turn Management", () => {
  let colyseus: ColyseusTestServer;

  before(async () => colyseus = await boot(appConfig));
  after(async () => await colyseus.shutdown());

  beforeEach(async () => await colyseus.cleanup());

  describe("Turn State Initialization", () => {
    it("should initialize turn state when first player joins", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client1 = await colyseus.connectTo(room, { name: "Player1" });

      // Check that turn state is initialized
      assert.strictEqual(room.state.currentTurn, 1);
      assert.strictEqual(room.state.turnInProgress, true);
      assert.strictEqual(room.state.turnOrder.length, 1);
      assert.strictEqual(room.state.turnOrder[0], client1.sessionId);

      // Check player status
      const player = room.state.players.get(client1.sessionId);
      assert(player !== undefined);
      assert.strictEqual(player!.turnStatus, "not_started");
      assert.strictEqual(player!.hasDrawnCard, false);
    });

    it("should add players to turn order when they join", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client1 = await colyseus.connectTo(room, { name: "Player1" });
      const client2 = await colyseus.connectTo(room, { name: "Player2" });

      assert.strictEqual(room.state.turnOrder.length, 2);
      assert(room.state.turnOrder.includes(client1.sessionId));
      assert(room.state.turnOrder.includes(client2.sessionId));
    });

    it("should remove players from turn order when they leave", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client1 = await colyseus.connectTo(room, { name: "Player1" });
      const client2 = await colyseus.connectTo(room, { name: "Player2" });

      assert.strictEqual(room.state.turnOrder.length, 2);

      await client1.leave();

      assert.strictEqual(room.state.turnOrder.length, 1);
      assert.strictEqual(room.state.turnOrder[0], client2.sessionId);
    });
  });

  describe("Turn Status Management", () => {
    it("should update player turn status correctly", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client1 = await colyseus.connectTo(room, { name: "Player1" });

      const player = room.state.players.get(client1.sessionId)!;
      assert.strictEqual(player.turnStatus, "not_started");

      // Update to playing_turn
      const success1 = room.state.updatePlayerTurnStatus(client1.sessionId, "playing_turn");
      assert.strictEqual(success1, true);
      assert.strictEqual(player.turnStatus, "playing_turn");

      // Update to turn_complete - with single player, turn advances immediately and resets status
      const success2 = room.state.updatePlayerTurnStatus(client1.sessionId, "turn_complete");
      assert.strictEqual(success2, true);
      // With single player, turn advances immediately and status resets to "not_started"
      assert.strictEqual(player.turnStatus, "not_started");
      assert.strictEqual(room.state.currentTurn, 2);
    });

    it("should reject invalid status transitions", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client1 = await colyseus.connectTo(room, { name: "Player1" });

      // Try to go directly from not_started to turn_complete (should fail)
      const success = room.state.updatePlayerTurnStatus(client1.sessionId, "turn_complete");
      assert.strictEqual(success, false);

      const player = room.state.players.get(client1.sessionId)!;
      assert.strictEqual(player.turnStatus, "not_started");
    });

    it("should handle endTurn message correctly", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client1 = await colyseus.connectTo(room, { name: "Player1" });

      // First set player to playing_turn
      room.state.updatePlayerTurnStatus(client1.sessionId, "playing_turn");

      // Send endTurn message
      client1.send("endTurn", {});

      // Wait for message processing
      await room.waitForNextPatch();

      const player = room.state.players.get(client1.sessionId)!;
      // With single player, turn advances immediately and status resets to "not_started"
      assert.strictEqual(player.turnStatus, "not_started");
      assert.strictEqual(room.state.currentTurn, 2);
    });

    it("should provide detailed feedback for endTurn message", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client1 = await colyseus.connectTo(room, { name: "Player1" });

      // Set up message listener to capture the response
      let endTurnResult: any = null;
      client1.onMessage("endTurnResult", (message) => {
        endTurnResult = message;
      });

      // First set player to playing_turn
      room.state.updatePlayerTurnStatus(client1.sessionId, "playing_turn");

      // Send endTurn message
      client1.send("endTurn", {});

      // Wait for message processing
      await room.waitForNextPatch();

      // Verify the enhanced response
      assert(endTurnResult !== null, "Should receive endTurnResult message");
      assert.strictEqual(endTurnResult.success, true);
      assert.strictEqual(endTurnResult.message, "Turn ended successfully");
      // With single player, turn advances immediately, so turnAdvanced should be true
      assert.strictEqual(endTurnResult.turnAdvanced, true);
      assert.strictEqual(endTurnResult.currentTurn, 2);
    });

    it("should reject endTurn when player is not in playing_turn status", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client1 = await colyseus.connectTo(room, { name: "Player1" });

      // Set up message listener to capture the response
      let endTurnResult: any = null;
      client1.onMessage("endTurnResult", (message) => {
        endTurnResult = message;
      });

      // Don't set player to playing_turn - leave in "not_started"
      
      // Send endTurn message
      client1.send("endTurn", {});

      // Wait for message processing
      await room.waitForNextPatch();

      // Verify the error response
      assert(endTurnResult !== null, "Should receive endTurnResult message");
      assert.strictEqual(endTurnResult.success, false);
      assert.strictEqual(endTurnResult.error, "Cannot end turn: player must be in 'playing_turn' status");
      
      // Verify player status didn't change
      const player = room.state.players.get(client1.sessionId)!;
      assert.strictEqual(player.turnStatus, "not_started");
      assert.strictEqual(room.state.currentTurn, 1);
    });

    it("should handle multi-player endTurn with proper turn advancement notification", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client1 = await colyseus.connectTo(room, { name: "Player1" });
      const client2 = await colyseus.connectTo(room, { name: "Player2" });

      // Set up message listeners to capture responses
      let endTurnResult1: any = null;
      let endTurnResult2: any = null;
      let turnAdvancedMessages: any[] = [];

      client1.onMessage("endTurnResult", (message) => {
        endTurnResult1 = message;
      });
      client2.onMessage("endTurnResult", (message) => {
        endTurnResult2 = message;
      });
      client1.onMessage("turnAdvanced", (message) => {
        turnAdvancedMessages.push(message);
      });
      client2.onMessage("turnAdvanced", (message) => {
        turnAdvancedMessages.push(message);
      });

      // Set both players to playing_turn
      room.state.updatePlayerTurnStatus(client1.sessionId, "playing_turn");
      room.state.updatePlayerTurnStatus(client2.sessionId, "playing_turn");

      // First player ends turn - should not advance turn yet
      client1.send("endTurn", {});
      await room.waitForNextPatch();

      assert(endTurnResult1 !== null, "Player1 should receive endTurnResult");
      assert.strictEqual(endTurnResult1.success, true);
      assert.strictEqual(endTurnResult1.turnAdvanced, false);
      assert.strictEqual(endTurnResult1.currentTurn, 1);

      // Second player ends turn - should advance turn
      client2.send("endTurn", {});
      await room.waitForNextPatch();

      assert(endTurnResult2 !== null, "Player2 should receive endTurnResult");
      assert.strictEqual(endTurnResult2.success, true);
      assert.strictEqual(endTurnResult2.turnAdvanced, true);
      assert.strictEqual(endTurnResult2.currentTurn, 2);

      // Both clients should receive turnAdvanced broadcast
      assert.strictEqual(turnAdvancedMessages.length, 2, "Should receive 2 turnAdvanced messages");
      assert.strictEqual(turnAdvancedMessages[0].newTurn, 2);
      assert.strictEqual(turnAdvancedMessages[0].message, "Turn 2 has begun");
    });
  });

  describe("Turn Advancement", () => {
    it("should advance turn when all players are ready", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client1 = await colyseus.connectTo(room, { name: "Player1" });
      const client2 = await colyseus.connectTo(room, { name: "Player2" });

      assert.strictEqual(room.state.currentTurn, 1);

      // Set both players to playing_turn
      room.state.updatePlayerTurnStatus(client1.sessionId, "playing_turn");
      room.state.updatePlayerTurnStatus(client2.sessionId, "playing_turn");

      // Complete first player's turn
      room.state.updatePlayerTurnStatus(client1.sessionId, "turn_complete");
      assert.strictEqual(room.state.currentTurn, 1); // Should not advance yet

      // Complete second player's turn - should advance turn
      room.state.updatePlayerTurnStatus(client2.sessionId, "turn_complete");
      assert.strictEqual(room.state.currentTurn, 2);

      // Check that player statuses are reset
      const player1 = room.state.players.get(client1.sessionId)!;
      const player2 = room.state.players.get(client2.sessionId)!;
      assert.strictEqual(player1.turnStatus, "not_started");
      assert.strictEqual(player2.turnStatus, "not_started");
      assert.strictEqual(player1.hasDrawnCard, false);
      assert.strictEqual(player2.hasDrawnCard, false);
    });

    it("should check if all players are ready correctly", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client1 = await colyseus.connectTo(room, { name: "Player1" });
      const client2 = await colyseus.connectTo(room, { name: "Player2" });

      assert.strictEqual(room.state.areAllPlayersReady(), false);

      // Set first player to turn_complete
      room.state.updatePlayerTurnStatus(client1.sessionId, "playing_turn");
      room.state.updatePlayerTurnStatus(client1.sessionId, "turn_complete");
      assert.strictEqual(room.state.areAllPlayersReady(), false);

      // Set second player to turn_complete - this will advance the turn and reset statuses
      room.state.updatePlayerTurnStatus(client2.sessionId, "playing_turn");
      room.state.updatePlayerTurnStatus(client2.sessionId, "turn_complete");
      
      // After turn advancement, all players are reset to "not_started", so they're not ready
      assert.strictEqual(room.state.areAllPlayersReady(), false);
      assert.strictEqual(room.state.currentTurn, 2);
    });
  });

  describe("Action Validation", () => {
    it("should validate player actions based on turn status", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client1 = await colyseus.connectTo(room, { name: "Player1" });
      const client2 = await colyseus.connectTo(room, { name: "Player2" });

      // Player should be able to draw card when not_started
      assert.strictEqual(room.state.canPlayerPerformAction(client1.sessionId, "drawCard"), true);
      assert.strictEqual(room.state.canPlayerPerformAction(client1.sessionId, "playCard"), false);
      assert.strictEqual(room.state.canPlayerPerformAction(client1.sessionId, "endTurn"), false);

      // Set player to playing_turn and hasDrawnCard
      room.state.updatePlayerTurnStatus(client1.sessionId, "playing_turn");
      const player = room.state.players.get(client1.sessionId)!;
      player.hasDrawnCard = true;

      assert.strictEqual(room.state.canPlayerPerformAction(client1.sessionId, "drawCard"), false);
      assert.strictEqual(room.state.canPlayerPerformAction(client1.sessionId, "playCard"), true);
      assert.strictEqual(room.state.canPlayerPerformAction(client1.sessionId, "endTurn"), true);

      // Set player to turn_complete (but don't advance turn since there are 2 players)
      room.state.updatePlayerTurnStatus(client1.sessionId, "turn_complete");

      assert.strictEqual(room.state.canPlayerPerformAction(client1.sessionId, "drawCard"), false);
      assert.strictEqual(room.state.canPlayerPerformAction(client1.sessionId, "playCard"), false);
      assert.strictEqual(room.state.canPlayerPerformAction(client1.sessionId, "endTurn"), false);
    });
  });

  describe("Turn Status Summary", () => {
    it("should provide accurate turn status summary", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client1 = await colyseus.connectTo(room, { name: "Player1" });
      const client2 = await colyseus.connectTo(room, { name: "Player2" });

      const status = room.state.getTurnStatus();
      assert.strictEqual(status.currentTurn, 1);
      assert.strictEqual(status.turnInProgress, true);
      assert.strictEqual(status.totalPlayers, 2);
      assert.strictEqual(status.playersReady, 0);
      assert.strictEqual(status.playerStatuses[client1.sessionId], "not_started");
      assert.strictEqual(status.playerStatuses[client2.sessionId], "not_started");

      // Complete one player's turn
      room.state.updatePlayerTurnStatus(client1.sessionId, "playing_turn");
      room.state.updatePlayerTurnStatus(client1.sessionId, "turn_complete");

      const status2 = room.state.getTurnStatus();
      assert.strictEqual(status2.playersReady, 1);
      assert.strictEqual(status2.playerStatuses[client1.sessionId], "turn_complete");
    });
  });

  describe("Card Drawing Functionality", () => {
    it("should successfully draw a card when player can draw", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client1 = await colyseus.connectTo(room, { name: "Player1" });

      const player = room.state.players.get(client1.sessionId)!;
      
      // Verify initial state
      assert.strictEqual(player.deck.length, 8);
      assert.strictEqual(player.drawnCards.length, 0);
      assert.strictEqual(player.hasDrawnCard, false);
      assert.strictEqual(player.turnStatus, "not_started");

      // Draw a card
      const result = room.state.drawCard(client1.sessionId);
      
      // Verify successful result
      assert.strictEqual(result.success, true);
      assert(result.message?.includes("Drew card:"));
      
      // Verify state changes
      assert.strictEqual(player.deck.length, 7);
      assert.strictEqual(player.drawnCards.length, 1);
      assert.strictEqual(player.hasDrawnCard, true);
      assert.strictEqual(player.turnStatus, "playing_turn");
      
      // Verify the drawn card
      const drawnCard = player.drawnCards[0];
      assert(drawnCard !== undefined);
      const expectedTypes = new Set([
        "cross_connected_squares",
        "cross_any_two_room_or_monster",
        "cross_two_connected_each_monster",
        "cross_row_room"
      ]);
      assert(expectedTypes.has(drawnCard.type), `Unexpected type: ${drawnCard.type}`);
      assert.strictEqual(typeof drawnCard.description, "string");
      assert(drawnCard.description.length > 0);
      assert.strictEqual(drawnCard.isActive, false);
    });

    it("should prevent drawing multiple cards per turn", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client1 = await colyseus.connectTo(room, { name: "Player1" });

      const player = room.state.players.get(client1.sessionId)!;
      
      // Draw first card successfully
      const result1 = room.state.drawCard(client1.sessionId);
      assert.strictEqual(result1.success, true);
      
      // Try to draw second card - should fail
      const result2 = room.state.drawCard(client1.sessionId);
      assert.strictEqual(result2.success, false);
      assert(result2.error?.includes("Cannot draw card"));
      
      // Verify state hasn't changed
      assert.strictEqual(player.deck.length, 7);
      assert.strictEqual(player.drawnCards.length, 1);
      assert.strictEqual(player.hasDrawnCard, true);
      assert.strictEqual(player.turnStatus, "playing_turn");
    });

    it("should prevent drawing when not player's turn", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client1 = await colyseus.connectTo(room, { name: "Player1" });
      const client2 = await colyseus.connectTo(room, { name: "Player2" });

      const player1 = room.state.players.get(client1.sessionId)!;
      
      // Set player1 to turn_complete status (but don't advance turn since there are 2 players)
      room.state.updatePlayerTurnStatus(client1.sessionId, "playing_turn");
      room.state.updatePlayerTurnStatus(client1.sessionId, "turn_complete");
      
      // Verify player1 is in turn_complete status
      assert.strictEqual(player1.turnStatus, "turn_complete");
      
      // Try to draw card - should fail
      const result = room.state.drawCard(client1.sessionId);
      assert.strictEqual(result.success, false);
      assert(result.error?.includes("Cannot draw card"));
      
      // Verify state hasn't changed
      assert.strictEqual(player1.deck.length, 8);
      assert.strictEqual(player1.drawnCards.length, 0);
      assert.strictEqual(player1.hasDrawnCard, false);
    });

    it("should handle empty deck gracefully", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client1 = await colyseus.connectTo(room, { name: "Player1" });

      const player = room.state.players.get(client1.sessionId)!;
      
      // Empty the deck
      player.deck.clear();
      
      // Try to draw card - should fail
      const result = room.state.drawCard(client1.sessionId);
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

    it("should handle drawCard message correctly", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client1 = await colyseus.connectTo(room, { name: "Player1" });

      const player = room.state.players.get(client1.sessionId)!;
      
      // Send drawCard message
      client1.send("drawCard", {});

      // Wait for message processing
      await room.waitForNextPatch();

      // Verify state changes
      assert.strictEqual(player.deck.length, 7);
      assert.strictEqual(player.drawnCards.length, 1);
      assert.strictEqual(player.hasDrawnCard, true);
      assert.strictEqual(player.turnStatus, "playing_turn");
    });

    it("should maintain card order when drawing from deck", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client1 = await colyseus.connectTo(room, { name: "Player1" });

      const player = room.state.players.get(client1.sessionId)!;
      
      // Get the first card ID before drawing
      const firstCardId = player.deck[0].id;
      
      // Draw a card
      const result = room.state.drawCard(client1.sessionId);
      assert.strictEqual(result.success, true);
      
      // Verify the drawn card is the one that was on top
      const drawnCard = player.drawnCards[0];
      assert.strictEqual(drawnCard.id, firstCardId);
    });
  });
});
