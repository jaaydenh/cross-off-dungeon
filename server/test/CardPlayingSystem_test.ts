import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import { describe, it, before, after, beforeEach } from "mocha";
import appConfig from "../src/app.config";
import { Card } from "../src/rooms/schema/Card";

const makeConnectedRoomCard = (id: string) =>
  new Card(
    id,
    "cross_connected_squares",
    "Cross off up to 3 connected squares",
    "room",
    "squares",
    1,
    3,
    true,
    true,
    false
  );

describe("Card Playing System", () => {
  let colyseus: ColyseusTestServer;

  before(async () => colyseus = await boot(appConfig));
  after(async () => await colyseus.shutdown());
  beforeEach(async () => await colyseus.cleanup());

  describe("Card Activation", () => {
    it("should successfully activate a drawn card", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const player = room.state.players.get(client.sessionId)!;
      player.deck.clear();
      player.deck.push(makeConnectedRoomCard("card_test_1"));

      // Draw a card first
      room.state.drawCard(client.sessionId);
      const cardId = player.drawnCards[0].id;

      // Activate the card
      const result = room.state.playCard(client.sessionId, cardId);

      assert.strictEqual(result.success, true);
      assert(result.message?.includes("Activated card"));

      // Verify card is activated
      assert.strictEqual(player.drawnCards[0].isActive, true);

      // Verify card selection state
      const cardState = room.state.getCardSelectionState(client.sessionId);
      assert.strictEqual(cardState.hasActiveCard, true);
      assert.strictEqual(cardState.activeCardId, cardId);
      assert.strictEqual(cardState.selectedCount, 0);
    });

    it("should handle playCard message correctly", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const player = room.state.players.get(client.sessionId)!;
      player.deck.clear();
      player.deck.push(makeConnectedRoomCard("card_test_1"));

      // Draw a card first
      room.state.drawCard(client.sessionId);
      const cardId = player.drawnCards[0].id;

      // Send playCard message
      client.send("playCard", { cardId });
      await room.waitForNextPatch();

      // Re-fetch player reference and verify state changed (card activated)
      const updatedPlayer = room.state.players.get(client.sessionId)!;
      assert.strictEqual(updatedPlayer.drawnCards[0].isActive, true);
    });
  });

  describe("Card Activation Restrictions", () => {
    it("should prevent activating card when player cannot play card", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      // Try to activate card without drawing first
      const result = room.state.playCard(client.sessionId, "fake_card_id");

      assert.strictEqual(result.success, false);
      assert(result.error?.includes("Cannot play card"));
    });

    it("should prevent activating non-existent card", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      // Draw a card first
      room.state.drawCard(client.sessionId);

      // Try to activate non-existent card
      const result = room.state.playCard(client.sessionId, "non_existent_card");

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, "Card not found in drawn cards");
    });

    it("should prevent activating multiple cards simultaneously", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const player = room.state.players.get(client.sessionId)!;
      player.deck.clear();
      player.deck.push(makeConnectedRoomCard("card_test_1"));
      player.deck.push(makeConnectedRoomCard("card_test_2"));

      // Draw a card and manually add another for testing
      room.state.drawCard(client.sessionId);
      const secondCard = player.deck.shift();
      if (secondCard) {
        player.drawnCards.push(secondCard);
      }

      const firstCardId = player.drawnCards[0].id;
      const secondCardId = player.drawnCards[1].id;

      // Activate first card
      const result1 = room.state.playCard(client.sessionId, firstCardId);
      assert.strictEqual(result1.success, true);

      // Try to activate second card
      const result2 = room.state.playCard(client.sessionId, secondCardId);
      assert.strictEqual(result2.success, false);
      assert(result2.error?.includes("already has an active card"));
    });

    it("should prevent activation when player status is not playing_turn", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client1 = await colyseus.connectTo(room, { name: "Player1" });
      const client2 = await colyseus.connectTo(room, { name: "Player2" });

      const player1 = room.state.players.get(client1.sessionId)!;

      // Draw card and set to turn_complete
      room.state.drawCard(client1.sessionId);
      const cardId = player1.drawnCards[0].id;
      room.state.updatePlayerTurnStatus(client1.sessionId, "turn_complete");

      // Try to activate card
      const result = room.state.playCard(client1.sessionId, cardId);
      assert.strictEqual(result.success, false);
      assert(result.error?.includes("Cannot play card"));
    });
  });

  describe("Card Action Cancellation", () => {
    it("should successfully cancel active card", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const player = room.state.players.get(client.sessionId)!;
      player.deck.clear();
      player.deck.push(makeConnectedRoomCard("card_test_1"));

      // Draw and activate card
      room.state.drawCard(client.sessionId);
      const cardId = player.drawnCards[0].id;
      room.state.playCard(client.sessionId, cardId);

      // Cancel the card action
      const result = room.state.cancelCardAction(client.sessionId);

      assert.strictEqual(result.success, true);
      assert(result.message?.includes("Card action cancelled"));

      // Verify card is deactivated
      assert.strictEqual(player.drawnCards[0].isActive, false);

      // Verify selection state is cleared
      const cardState = room.state.getCardSelectionState(client.sessionId);
      assert.strictEqual(cardState.hasActiveCard, false);
      assert.strictEqual(cardState.selectedCount, 0);
    });

    it("should handle cancelCardAction message correctly", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const player = room.state.players.get(client.sessionId)!;
      player.deck.clear();
      player.deck.push(makeConnectedRoomCard("card_test_1"));

      // Draw and activate card
      room.state.drawCard(client.sessionId);
      const cardId = player.drawnCards[0].id;
      room.state.playCard(client.sessionId, cardId);

      let cancelResult: any = null;
      client.onMessage("cancelCardActionResult", (message) => {
        cancelResult = message;
      });

      // Send cancelCardAction message
      client.send("cancelCardAction", {});
      await room.waitForNextPatch();

      // Verify response
      assert(cancelResult !== null);
      assert.strictEqual(cancelResult.success, true);
      assert(cancelResult.message?.includes("Card action cancelled"));
    });

    it("should prevent cancellation when no active card exists", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      // Try to cancel without active card
      const result = room.state.cancelCardAction(client.sessionId);

      assert.strictEqual(result.success, false);
      assert(result.error?.includes("No active card"));
    });

    it("should handle cancellation after square selection", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const player = room.state.players.get(client.sessionId)!;
      player.deck.clear();
      player.deck.push(makeConnectedRoomCard("card_test_1"));

      // Draw and activate card
      room.state.drawCard(client.sessionId);
      const cardId = player.drawnCards[0].id;
      room.state.playCard(client.sessionId, cardId);

      // Select a square
      const currentRoom = room.state.getCurrentRoom()!;
      const entranceX = currentRoom.entranceX;
      const entranceY = currentRoom.entranceY;
      let adjacentY = entranceY - 1;
      if (adjacentY < 0 || currentRoom.getSquare(entranceX, adjacentY)?.wall) {
        adjacentY = entranceY + 1;
      }

      room.state.selectSquareForCard(client.sessionId, 0, entranceX, adjacentY);

      // Verify square was selected
      let cardState = room.state.getCardSelectionState(client.sessionId);
      assert.strictEqual(cardState.selectedCount, 1);

      // Cancel the action
      room.state.cancelCardAction(client.sessionId);

      // Verify selection is cleared
      cardState = room.state.getCardSelectionState(client.sessionId);
      assert.strictEqual(cardState.hasActiveCard, false);
      assert.strictEqual(cardState.selectedCount, 0);
    });
  });

  describe("Card Action Completion", () => {
    it("should complete card action after selecting 3 valid squares", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const player = room.state.players.get(client.sessionId)!;
      player.deck.clear();
      player.deck.push(makeConnectedRoomCard("card_test_1"));

      // Draw and activate card
      room.state.drawCard(client.sessionId);
      const initialDrawnCount = player.drawnCards.length;
      const initialDiscardCount = player.discardPile.length;
      const cardId = player.drawnCards[0].id;

      room.state.playCard(client.sessionId, cardId);

      // Find 3 connected squares
      const currentRoom = room.state.getCurrentRoom()!;
      const entranceX = currentRoom.entranceX;
      const entranceY = currentRoom.entranceY;

      // Find valid adjacent squares for testing
      const squares: Array<{ x: number; y: number }> = [];
      let testY = entranceY - 1;
      if (testY >= 0 && !currentRoom.getSquare(entranceX, testY)?.wall) {
        squares.push({ x: entranceX, y: testY });

        // Try to find second square adjacent to first
        if (testY - 1 >= 0 && !currentRoom.getSquare(entranceX, testY - 1)?.wall) {
          squares.push({ x: entranceX, y: testY - 1 });
        } else if (testY + 1 < currentRoom.height && !currentRoom.getSquare(entranceX, testY + 1)?.wall) {
          squares.push({ x: entranceX, y: testY + 1 });
        }

        // Try to find third square
        if (entranceX + 1 < currentRoom.width && !currentRoom.getSquare(entranceX + 1, testY)?.wall) {
          squares.push({ x: entranceX + 1, y: testY });
        } else if (entranceX - 1 >= 0 && !currentRoom.getSquare(entranceX - 1, testY)?.wall) {
          squares.push({ x: entranceX - 1, y: testY });
        }
      }

      // If we couldn't find 3 squares going north, try south
      if (squares.length < 3) {
        squares.length = 0;
        testY = entranceY + 1;
        if (testY < currentRoom.height && !currentRoom.getSquare(entranceX, testY)?.wall) {
          squares.push({ x: entranceX, y: testY });

          if (testY + 1 < currentRoom.height && !currentRoom.getSquare(entranceX, testY + 1)?.wall) {
            squares.push({ x: entranceX, y: testY + 1 });
          }

          if (entranceX + 1 < currentRoom.width && !currentRoom.getSquare(entranceX + 1, testY)?.wall) {
            squares.push({ x: entranceX + 1, y: testY });
          }
        }
      }

      // Select the squares
      if (squares.length >= 3) {
        room.state.selectSquareForCard(client.sessionId, 0, squares[0].x, squares[0].y);
        room.state.selectSquareForCard(client.sessionId, 0, squares[1].x, squares[1].y);

        // Select the third square then confirm to complete the action
        const result = room.state.selectSquareForCard(client.sessionId, 0, squares[2].x, squares[2].y);

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.completed, false);

        const confirm = room.state.confirmCardAction(client.sessionId);
        assert.strictEqual(confirm.success, true);
        assert.strictEqual(confirm.completed, true);

        // Check card moved to discard pile
        assert.strictEqual(player.drawnCards.length, initialDrawnCount - 1);
        assert.strictEqual(player.discardPile.length, initialDiscardCount + 1);

        // Check squares are crossed
        for (const square of squares) {
          const roomSquare = currentRoom.getSquare(square.x, square.y);
          assert.strictEqual(roomSquare?.checked, true);
        }

        // Check card selection state is cleared
        const cardState = room.state.getCardSelectionState(client.sessionId);
        assert.strictEqual(cardState.hasActiveCard, false);
        assert.strictEqual(cardState.selectedCount, 0);
      } else {
        // Skip this test if we can't find 3 connected squares
        console.log("Skipping completion test - couldn't find 3 connected squares");
      }
    });

    it("should move completed card to discard pile with correct properties", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const player = room.state.players.get(client.sessionId)!;
      player.deck.clear();
      player.deck.push(makeConnectedRoomCard("card_test_1"));

      // Draw and activate card
      room.state.drawCard(client.sessionId);
      const originalCard = player.drawnCards[0];
      const cardId = originalCard.id;

      room.state.playCard(client.sessionId, cardId);

      // Manually complete the action by calling completeCardAction
      const selectedPositions = [
        { roomIndex: 0, x: 1, y: 1 },
        { roomIndex: 0, x: 1, y: 2 },
        { roomIndex: 0, x: 2, y: 1 }
      ];

      // Set up the selection state manually for testing
      room.state.activeCardPlayers.set(client.sessionId, cardId);
      room.state.selectedSquares.set(client.sessionId, "0:1,1;0:1,2;0:2,1");
      room.state.selectedSquareCount.set(client.sessionId, 3);

      // Complete the action
      const result = (room.state as any).completeCardAction(client.sessionId, selectedPositions);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.completed, true);

      // Verify card is in discard pile with correct properties
      assert.strictEqual(player.discardPile.length, 1);
      const discardedCard = player.discardPile[0];
      assert.strictEqual(discardedCard.id, cardId);
      assert.strictEqual(discardedCard.type, originalCard.type);
      assert.strictEqual(discardedCard.description, originalCard.description);
      assert.strictEqual(discardedCard.isActive, false);
    });
  });

  describe("Multi-Player Card Playing", () => {
    it("should allow multiple players to have active cards simultaneously", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client1 = await colyseus.connectTo(room, { name: "Player1" });
      const client2 = await colyseus.connectTo(room, { name: "Player2" });

      const player1 = room.state.players.get(client1.sessionId)!;
      const player2 = room.state.players.get(client2.sessionId)!;
      player1.deck.clear();
      player2.deck.clear();
      player1.deck.push(makeConnectedRoomCard("card_p1"));
      player2.deck.push(makeConnectedRoomCard("card_p2"));

      // Both players draw and activate cards
      room.state.drawCard(client1.sessionId);
      room.state.drawCard(client2.sessionId);

      const card1Id = player1.drawnCards[0].id;
      const card2Id = player2.drawnCards[0].id;

      const result1 = room.state.playCard(client1.sessionId, card1Id);
      const result2 = room.state.playCard(client2.sessionId, card2Id);

      assert.strictEqual(result1.success, true);
      assert.strictEqual(result2.success, true);

      // Verify both cards are active
      assert.strictEqual(player1.drawnCards[0].isActive, true);
      assert.strictEqual(player2.drawnCards[0].isActive, true);

      // Verify both players have active card states
      const cardState1 = room.state.getCardSelectionState(client1.sessionId);
      const cardState2 = room.state.getCardSelectionState(client2.sessionId);

      assert.strictEqual(cardState1.hasActiveCard, true);
      assert.strictEqual(cardState2.hasActiveCard, true);
      assert.strictEqual(cardState1.activeCardId, card1Id);
      assert.strictEqual(cardState2.activeCardId, card2Id);
    });

    it("should maintain separate card selection states for each player", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client1 = await colyseus.connectTo(room, { name: "Player1" });
      const client2 = await colyseus.connectTo(room, { name: "Player2" });

      const player1 = room.state.players.get(client1.sessionId)!;
      const player2 = room.state.players.get(client2.sessionId)!;
      player1.deck.clear();
      player2.deck.clear();
      player1.deck.push(makeConnectedRoomCard("card_p1"));
      player2.deck.push(makeConnectedRoomCard("card_p2"));

      // Both players draw and activate cards
      room.state.drawCard(client1.sessionId);
      room.state.drawCard(client2.sessionId);

      room.state.playCard(client1.sessionId, player1.drawnCards[0].id);
      room.state.playCard(client2.sessionId, player2.drawnCards[0].id);

      // Player1 cancels their action
      room.state.cancelCardAction(client1.sessionId);

      // Verify only player1's state is cleared
      const cardState1 = room.state.getCardSelectionState(client1.sessionId);
      const cardState2 = room.state.getCardSelectionState(client2.sessionId);

      assert.strictEqual(cardState1.hasActiveCard, false);
      assert.strictEqual(cardState2.hasActiveCard, true);
      assert.strictEqual(player1.drawnCards[0].isActive, false);
      assert.strictEqual(player2.drawnCards[0].isActive, true);
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid player ID gracefully", async () => {
      const room = await colyseus.createRoom("dungeon", {});

      const result = room.state.playCard("invalid-id", "card-id");
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, "Player not found");
    });

    it("should provide meaningful error messages for various failure cases", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      // Test without drawing card first
      const noCardResult = room.state.playCard(client.sessionId, "fake-id");
      assert(noCardResult.error?.includes("Cannot play card"));

      // Draw card and test with wrong ID
      room.state.drawCard(client.sessionId);
      const wrongIdResult = room.state.playCard(client.sessionId, "wrong-id");
      assert.strictEqual(wrongIdResult.error, "Card not found in drawn cards");

      // Test cancellation without active card
      const noCancelResult = room.state.cancelCardAction(client.sessionId);
      assert(noCancelResult.error?.includes("No active card"));
    });
  });
});
