import { ColyseusTestServer } from "@colyseus/testing";
import { Dungeon } from "../src/rooms/Dungeon";
import assert from "assert";
import { describe, it, before, after, beforeEach } from "mocha";
import appConfig from "../src/app.config";
import { Card } from "../src/rooms/schema/Card";
import { MonsterCard } from "../src/rooms/schema/MonsterCard";
import {
  bootSandboxSafe,
  cleanupSandboxSafe,
  shutdownSandboxSafe
} from "./helpers/colyseusTestUtils";

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

const makeAnyTwoRoomOrMonsterCard = (id: string) =>
  new Card(
    id,
    "cross_any_two_room_or_monster",
    "Cross off up to 2 squares on a single room or monster",
    "room_or_monster",
    "squares",
    1,
    2,
    false,
    false,
    false,
    "block"
  );

const makeRepositionCard = (id: string) =>
  new Card(
    id,
    "reposition",
    "Move 2 then draw another card",
    "room",
    "squares",
    2,
    2,
    true,
    true,
    false,
    "empty",
    1
  );

const makeMonsterAnywhereCard = (id: string) =>
  new Card(
    id,
    "monster_anywhere_test",
    "Cross off 1 monster square",
    "monster",
    "squares",
    1,
    1,
    false,
    false,
    true
  );

describe("Card-Based Square Selection System", () => {
  let colyseus: ColyseusTestServer | undefined;

  before(async function () {
    colyseus = await bootSandboxSafe(this, appConfig);
  });
  after(async () => await shutdownSandboxSafe(colyseus));
  beforeEach(async () => await cleanupSandboxSafe(colyseus));

  describe("Card Activation", () => {
    it("should activate a drawn card for square selection", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const seededPlayer = room.state.players.get(client.sessionId)!;
      seededPlayer.deck.clear();
      seededPlayer.deck.push(makeConnectedRoomCard("card_test_1"));

      // Draw a card first
      room.send(client, "drawCard", {});
      await room.waitForNextPatch();

      const player = room.state.players.get(client.sessionId);
      assert(player, "Player should exist");
      assert.strictEqual(player.drawnCards.length, 1, "Player should have 1 drawn card");

      const cardId = player.drawnCards[0].id;

      // Activate the card
      room.send(client, "playCard", { cardId });
      await room.waitForNextPatch();

      // Check card is activated
      assert.strictEqual(player.drawnCards[0].isActive, true, "Card should be active");
      
      // Check player has active card state
      const cardState = room.state.getCardSelectionState(client.sessionId);
      assert.strictEqual(cardState.hasActiveCard, true, "Player should have active card");
      assert.strictEqual(cardState.activeCardId, cardId, "Active card ID should match");
      assert.strictEqual(cardState.selectedCount, 0, "Should start with 0 selected squares");
    });

    it("should prevent activating card when player cannot play card", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      // Try to activate card without drawing first
      const result = room.state.playCard(client.sessionId, "fake_card_id");
      
      assert.strictEqual(result.success, false, "Should fail to activate card");
      assert(result.error?.includes("Cannot play card"), "Should have appropriate error message");
    });

    it("should prevent activating multiple cards simultaneously", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      // Manually add multiple cards to drawn cards to simulate having multiple cards
      const player = room.state.players.get(client.sessionId);
      player!.deck.clear();
      player!.deck.push(makeConnectedRoomCard("card_test_1"));
      player!.deck.push(makeConnectedRoomCard("card_test_2"));
      
      // Draw a card first
      room.send(client, "drawCard", {});
      await room.waitForNextPatch();

      // Manually add another card to drawn cards for testing
      const secondCard = player!.deck.shift();
      if (secondCard) {
        player!.drawnCards.push(secondCard);
      }

      const firstCardId = player!.drawnCards[0].id;
      const secondCardId = player!.drawnCards[1].id;

      // Activate first card
      room.send(client, "playCard", { cardId: firstCardId });
      await room.waitForNextPatch();

      // Try to activate the second card while first is still active
      const result = room.state.playCard(client.sessionId, secondCardId);
      
      assert.strictEqual(result.success, false, "Should fail to activate second card");
      assert(result.error?.includes("already has an active card"), "Should have appropriate error message");
    });
  });

  describe("Square Selection for Cards", () => {
    it("should allow selecting valid starting square adjacent to entrance", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const seededPlayer = room.state.players.get(client.sessionId)!;
      seededPlayer.deck.clear();
      seededPlayer.deck.push(makeConnectedRoomCard("card_test_1"));

      // Draw and activate card
      room.send(client, "drawCard", {});
      await room.waitForNextPatch();
      const player = room.state.players.get(client.sessionId);
      const cardId = player!.drawnCards[0].id;
      room.send(client, "playCard", { cardId });
      await room.waitForNextPatch();

      // Get entrance position
      const currentRoom = room.state.getCurrentRoom();
      assert(currentRoom, "Current room should exist");
      
      // Find a square adjacent to entrance
      const entranceX = currentRoom.entranceX;
      const entranceY = currentRoom.entranceY;
      
      // Try adjacent square (assuming entrance is not at edge)
      let adjacentX = entranceX;
      let adjacentY = entranceY - 1; // Try north of entrance
      
      // Make sure the adjacent square is valid and not a wall
      if (adjacentY < 0 || currentRoom.getSquare(adjacentX, adjacentY)?.wall) {
        adjacentY = entranceY + 1; // Try south of entrance
      }

      const result = room.state.selectSquareForCard(client.sessionId, 0, adjacentX, adjacentY);
      
      assert.strictEqual(result.success, true, "Should successfully select valid starting square");
      
      const cardState = room.state.getCardSelectionState(client.sessionId);
      assert.strictEqual(cardState.selectedCount, 1, "Should have 1 selected square");
    });

    it("should allow selecting the entrance square as a valid starting square", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const seededPlayer = room.state.players.get(client.sessionId)!;
      seededPlayer.deck.clear();
      seededPlayer.deck.push(makeConnectedRoomCard("card_test_1"));

      // Draw and activate card
      room.send(client, "drawCard", {});
      await room.waitForNextPatch();
      const player = room.state.players.get(client.sessionId);
      const cardId = player!.drawnCards[0].id;
      room.send(client, "playCard", { cardId });
      await room.waitForNextPatch();

      // Get entrance position
      const currentRoom = room.state.getCurrentRoom();
      assert(currentRoom, "Current room should exist");

      const entranceX = currentRoom.entranceX;
      const entranceY = currentRoom.entranceY;

      const result = room.state.selectSquareForCard(client.sessionId, 0, entranceX, entranceY);
      assert.strictEqual(result.success, true, "Should successfully select entrance square as starting square");

      const cardState = room.state.getCardSelectionState(client.sessionId);
      assert.strictEqual(cardState.selectedCount, 1, "Should have 1 selected square");
    });

    it("should reject invalid starting square not adjacent to entrance or crossed square", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const seededPlayer = room.state.players.get(client.sessionId)!;
      seededPlayer.deck.clear();
      seededPlayer.deck.push(makeConnectedRoomCard("card_test_1"));

      // Draw and activate card
      room.send(client, "drawCard", {});
      await room.waitForNextPatch();
      const player = room.state.players.get(client.sessionId);
      const cardId = player!.drawnCards[0].id;
      room.send(client, "playCard", { cardId });
      await room.waitForNextPatch();

      // Find a square that's within bounds but not adjacent to entrance
      const currentRoom = room.state.getCurrentRoom()!;
      const entranceX = currentRoom.entranceX;
      const entranceY = currentRoom.entranceY;
      
      // Find a square that's at least 2 squares away from entrance
      let testX = 0, testY = 0;
      for (let x = 0; x < currentRoom.width; x++) {
        for (let y = 0; y < currentRoom.height; y++) {
          const square = currentRoom.getSquare(x, y);
          if (square && !square.wall) {
            const dx = Math.abs(x - entranceX);
            const dy = Math.abs(y - entranceY);
            // Make sure it's not adjacent (distance > 1)
            if (dx > 1 || dy > 1) {
              testX = x;
              testY = y;
              break;
            }
          }
        }
        if (testX !== 0 || testY !== 0) break;
      }

      const result = room.state.selectSquareForCard(client.sessionId, 0, testX, testY);
      
      assert.strictEqual(result.success, false, "Should fail to select invalid starting square");
      assert.strictEqual(result.invalidSquare, true, "Should mark as invalid square");
      assert(result.error?.includes("entrance"), "Should have appropriate error message");
    });

    it("should require orthogonal connectivity for subsequent squares", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const seededPlayer = room.state.players.get(client.sessionId)!;
      seededPlayer.deck.clear();
      seededPlayer.deck.push(makeConnectedRoomCard("card_test_1"));

      // Draw and activate card
      room.send(client, "drawCard", {});
      await room.waitForNextPatch();
      const player = room.state.players.get(client.sessionId);
      const cardId = player!.drawnCards[0].id;
      room.send(client, "playCard", { cardId });
      await room.waitForNextPatch();

      // Select first valid square
      const currentRoom = room.state.getCurrentRoom()!;
      const entranceX = currentRoom.entranceX;
      const entranceY = currentRoom.entranceY;
      
      let firstX = entranceX;
      let firstY = entranceY - 1;
      if (firstY < 0 || currentRoom.getSquare(firstX, firstY)?.wall) {
        firstY = entranceY + 1;
      }

      room.state.selectSquareForCard(client.sessionId, 0, firstX, firstY);

      // Try to select non-adjacent square
      const result = room.state.selectSquareForCard(client.sessionId, 0, firstX + 2, firstY);
      
      assert.strictEqual(result.success, false, "Should fail to select non-adjacent square");
      assert.strictEqual(result.invalidSquare, true, "Should mark as invalid square");
      assert(result.error?.includes("orthogonally connected"), "Should have appropriate error message");
    });

    it("should prevent selecting wall squares", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const seededPlayer = room.state.players.get(client.sessionId)!;
      seededPlayer.deck.clear();
      seededPlayer.deck.push(makeConnectedRoomCard("card_test_1"));

      // Draw and activate card
      room.send(client, "drawCard", {});
      await room.waitForNextPatch();
      const player = room.state.players.get(client.sessionId);
      const cardId = player!.drawnCards[0].id;
      room.send(client, "playCard", { cardId });
      await room.waitForNextPatch();

      // Find a wall square and try to select it
      const currentRoom = room.state.getCurrentRoom()!;
      let wallX = -1, wallY = -1;
      
      for (let x = 0; x < currentRoom.width; x++) {
        for (let y = 0; y < currentRoom.height; y++) {
          const square = currentRoom.getSquare(x, y);
          if (square?.wall) {
            wallX = x;
            wallY = y;
            break;
          }
        }
        if (wallX !== -1) break;
      }

      if (wallX !== -1) {
        const result = room.state.selectSquareForCard(client.sessionId, 0, wallX, wallY);
        
        assert.strictEqual(result.success, false, "Should fail to select wall square");
        assert.strictEqual(result.invalidSquare, true, "Should mark as invalid square");
        assert(result.error?.includes("wall squares"), "Should have appropriate error message");
      }
    });

    it("should prevent selecting already crossed squares", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const seededPlayer = room.state.players.get(client.sessionId)!;
      seededPlayer.deck.clear();
      seededPlayer.deck.push(makeConnectedRoomCard("card_test_1"));

      // Find a non-wall square and cross it first
      const currentRoom = room.state.getCurrentRoom()!;
      let testX = -1, testY = -1;
      
      for (let x = 0; x < currentRoom.width; x++) {
        for (let y = 0; y < currentRoom.height; y++) {
          const square = currentRoom.getSquare(x, y);
          if (square && !square.wall) {
            testX = x;
            testY = y;
            square.checked = true; // Cross this square
            break;
          }
        }
        if (testX !== -1) break;
      }

      // Draw and activate card
      room.send(client, "drawCard", {});
      await room.waitForNextPatch();
      const player = room.state.players.get(client.sessionId);
      const cardId = player!.drawnCards[0].id;
      room.send(client, "playCard", { cardId });
      await room.waitForNextPatch();

      // Try to select the already crossed square
      const result = room.state.selectSquareForCard(client.sessionId, 0, testX, testY);
      
      assert.strictEqual(result.success, false, "Should fail to select already crossed square");
      assert.strictEqual(result.invalidSquare, true, "Should mark as invalid square");
      assert(result.error?.includes("already crossed"), "Should have appropriate error message");
    });

    it("should allow selecting a monster square even when not adjacent to an existing crossed monster square", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const seededPlayer = room.state.players.get(client.sessionId)!;
      seededPlayer.deck.clear();
      seededPlayer.deck.push(makeMonsterAnywhereCard("card_test_monster_anywhere"));

      const monster = new MonsterCard("monster_test_anywhere", "slime", 3, 3, 1);
      for (let y = 0; y < monster.height; y++) {
        for (let x = 0; x < monster.width; x++) {
          monster.setSquareFilled(x, y, true);
        }
      }
      monster.playerOwnerId = client.sessionId;
      monster.connectedToRoomIndex = -1;
      const preCrossed = monster.getSquare(0, 0);
      assert(preCrossed, "Monster should have a square at 0,0");
      preCrossed.checked = true;
      room.state.activeMonsters.push(monster);

      room.send(client, "drawCard", {});
      await room.waitForNextPatch();

      const player = room.state.players.get(client.sessionId)!;
      const cardId = player.drawnCards[0].id;
      room.send(client, "playCard", { cardId });
      await room.waitForNextPatch();

      const selection = room.state.crossMonsterSquare(client.sessionId, monster.id, 2, 2);
      assert.strictEqual(selection.success, true, "Should allow selecting any monster square");

      const confirm = room.state.confirmCardAction(client.sessionId);
      assert.strictEqual(confirm.success, true, "Should confirm monster selection");
      assert.strictEqual(confirm.completed, true, "Should complete card action");
      assert.strictEqual(monster.getSquare(2, 2)?.checked, true, "Selected monster square should be crossed");
    });
  });

  describe("Card Action Completion", () => {
    it("should complete card action after selecting 3 valid squares", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const seededPlayer = room.state.players.get(client.sessionId)!;
      seededPlayer.deck.clear();
      seededPlayer.deck.push(makeConnectedRoomCard("card_test_1"));

      // Draw and activate card
      room.send(client, "drawCard", {});
      await room.waitForNextPatch();
      const player = room.state.players.get(client.sessionId);
      const initialDrawnCount = player!.drawnCards.length;
      const initialDiscardCount = player!.discardPile.length;
      const cardId = player!.drawnCards[0].id;
      
      room.send(client, "playCard", { cardId });
      await room.waitForNextPatch();

      // Select 3 connected squares
      const currentRoom = room.state.getCurrentRoom()!;
      const entranceX = currentRoom.entranceX;
      const entranceY = currentRoom.entranceY;
      
      // Find valid adjacent squares
      let squares = [];
      let testY = entranceY - 1;
      if (testY >= 0 && !currentRoom.getSquare(entranceX, testY)?.wall) {
        squares.push({ x: entranceX, y: testY });
        squares.push({ x: entranceX, y: testY - 1 >= 0 ? testY - 1 : testY + 2 });
        squares.push({ x: entranceX + 1 < currentRoom.width ? entranceX + 1 : entranceX - 1, y: testY });
      } else {
        testY = entranceY + 1;
        squares.push({ x: entranceX, y: testY });
        squares.push({ x: entranceX, y: testY + 1 < currentRoom.height ? testY + 1 : testY - 2 });
        squares.push({ x: entranceX + 1 < currentRoom.width ? entranceX + 1 : entranceX - 1, y: testY });
      }

      // Select first two squares
      room.state.selectSquareForCard(client.sessionId, 0, squares[0].x, squares[0].y);
      room.state.selectSquareForCard(client.sessionId, 0, squares[1].x, squares[1].y);

      // Select third square - this should complete the action
      const result = room.state.selectSquareForCard(client.sessionId, 0, squares[2].x, squares[2].y);
      
      assert.strictEqual(result.success, true, "Should successfully select the third square");
      assert.strictEqual(result.completed, false, "Selection alone should not complete the action");

      const confirm = room.state.confirmCardAction(client.sessionId);
      assert.strictEqual(confirm.success, true, "Should successfully confirm card action");
      assert.strictEqual(confirm.completed, true, "Should indicate action is completed");

      // Check card moved to discard pile
      assert.strictEqual(player!.drawnCards.length, initialDrawnCount - 1, "Card should be removed from drawn cards");
      assert.strictEqual(player!.discardPile.length, initialDiscardCount + 1, "Card should be added to discard pile");

      // Check squares are crossed
      for (const square of squares) {
        const roomSquare = currentRoom.getSquare(square.x, square.y);
        assert.strictEqual(roomSquare?.checked, true, `Square at ${square.x},${square.y} should be crossed`);
      }

      // Check card selection state is cleared
      const cardState = room.state.getCardSelectionState(client.sessionId);
      assert.strictEqual(cardState.hasActiveCard, false, "Should not have active card after completion");
      assert.strictEqual(cardState.selectedCount, 0, "Should have 0 selected squares after completion");
    });

    it("should allow confirming the Any Two card after selecting only one room square", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const seededPlayer = room.state.players.get(client.sessionId)!;
      seededPlayer.deck.clear();
      seededPlayer.deck.push(makeAnyTwoRoomOrMonsterCard("card_test_any_two"));

      room.send(client, "drawCard", {});
      await room.waitForNextPatch();

      const player = room.state.players.get(client.sessionId)!;
      const initialDrawnCount = player.drawnCards.length;
      const initialDiscardCount = player.discardPile.length;
      const cardId = player.drawnCards[0].id;

      room.send(client, "playCard", { cardId });
      await room.waitForNextPatch();

      const roomIndex = room.state.currentRoomIndex;
      const currentRoom = room.state.getCurrentRoom()!;

      let targetSquare: { x: number; y: number } | null = null;
      for (let x = 0; x < currentRoom.width; x++) {
        for (let y = 0; y < currentRoom.height; y++) {
          const square = currentRoom.getSquare(x, y);
          if (square && !square.wall && !square.checked) {
            targetSquare = { x, y };
            break;
          }
        }
        if (targetSquare) break;
      }

      assert(targetSquare, "Should find a selectable room square");

      const selectionResult = room.state.selectSquareForCard(
        client.sessionId,
        roomIndex,
        targetSquare.x,
        targetSquare.y
      );
      assert.strictEqual(selectionResult.success, true, "Should select one square successfully");

      const confirmResult = room.state.confirmCardAction(client.sessionId);
      assert.strictEqual(confirmResult.success, true, "Should confirm with one square selected");
      assert.strictEqual(confirmResult.completed, true, "Should complete card action");

      assert.strictEqual(
        currentRoom.getSquare(targetSquare.x, targetSquare.y)?.checked,
        true,
        "Selected square should be crossed after confirm"
      );
      assert.strictEqual(player.drawnCards.length, initialDrawnCount - 1, "Card should leave drawn pile");
      assert.strictEqual(player.discardPile.length, initialDiscardCount + 1, "Card should move to discard pile");
    });

    it("should draw one additional card after completing Reposition", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const seededPlayer = room.state.players.get(client.sessionId)!;
      seededPlayer.deck.clear();
      seededPlayer.deck.push(makeRepositionCard("card_test_reposition"));
      seededPlayer.deck.push(makeConnectedRoomCard("card_followup"));

      room.send(client, "drawCard", {});
      await room.waitForNextPatch();

      const player = room.state.players.get(client.sessionId)!;
      assert.strictEqual(player.drawnCards.length, 1, "Should have drawn Reposition");
      assert.strictEqual(player.drawnCards[0].type, "reposition");
      assert.strictEqual(player.deck.length, 1, "Deck should have one card left before playing Reposition");

      room.send(client, "playCard", { cardId: player.drawnCards[0].id });
      await room.waitForNextPatch();

      const currentRoom = room.state.getCurrentRoom()!;
      const startX = currentRoom.entranceX;
      const startY = currentRoom.entranceY;
      const directions = [
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 }
      ];

      let secondSquare: { x: number; y: number } | null = null;
      for (const direction of directions) {
        const nextX = startX + direction.dx;
        const nextY = startY + direction.dy;
        if (!currentRoom.isValidPosition(nextX, nextY)) continue;
        const square = currentRoom.getSquare(nextX, nextY);
        if (!square || square.wall || square.checked) continue;
        secondSquare = { x: nextX, y: nextY };
        break;
      }

      assert(secondSquare, "Should find a valid adjacent square for Reposition");

      const selectFirst = room.state.selectSquareForCard(client.sessionId, room.state.currentRoomIndex, startX, startY);
      assert.strictEqual(selectFirst.success, true, "First Reposition square should be valid");

      const selectSecond = room.state.selectSquareForCard(
        client.sessionId,
        room.state.currentRoomIndex,
        secondSquare.x,
        secondSquare.y
      );
      assert.strictEqual(selectSecond.success, true, "Second Reposition square should be valid and adjacent");

      const confirmResult = room.state.confirmCardAction(client.sessionId);
      assert.strictEqual(confirmResult.success, true, "Reposition should confirm successfully");
      assert.strictEqual(confirmResult.completed, true, "Reposition should complete on confirm");

      assert.strictEqual(player.discardPile.length, 1, "Reposition should be moved to discard");
      assert.strictEqual(player.drawnCards.length, 1, "Reposition should draw one replacement card");
      assert.strictEqual(player.drawnCards[0].id, "card_followup", "Follow-up card should be drawn");
      assert.strictEqual(player.deck.length, 0, "Deck should now be empty");
    });
  });

  describe("Card Action Cancellation", () => {
    it("should cancel active card and clear selections", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const seededPlayer = room.state.players.get(client.sessionId)!;
      seededPlayer.deck.clear();
      seededPlayer.deck.push(makeConnectedRoomCard("card_test_1"));

      // Draw and activate card
      room.send(client, "drawCard", {});
      await room.waitForNextPatch();
      const player = room.state.players.get(client.sessionId);
      const cardId = player!.drawnCards[0].id;
      
      room.send(client, "playCard", { cardId });
      await room.waitForNextPatch();

      // Select a square
      const currentRoom = room.state.getCurrentRoom()!;
      const entranceX = currentRoom.entranceX;
      const entranceY = currentRoom.entranceY;
      let adjacentY = entranceY - 1;
      if (adjacentY < 0 || currentRoom.getSquare(entranceX, adjacentY)?.wall) {
        adjacentY = entranceY + 1;
      }
      
      room.state.selectSquareForCard(client.sessionId, 0, entranceX, adjacentY);

      // Cancel the card action
      room.send(client, "cancelCardAction", {});
      await room.waitForNextPatch();

      // Check card is deactivated
      assert.strictEqual(player!.drawnCards[0].isActive, false, "Card should be deactivated");

      // Check selection state is cleared
      const cardState = room.state.getCardSelectionState(client.sessionId);
      assert.strictEqual(cardState.hasActiveCard, false, "Should not have active card after cancellation");
      assert.strictEqual(cardState.selectedCount, 0, "Should have 0 selected squares after cancellation");
    });

    it("should handle cancellation when no active card exists", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      // Try to cancel without active card
      const result = room.state.cancelCardAction(client.sessionId);
      
      assert.strictEqual(result.success, false, "Should fail to cancel when no active card");
      assert(result.error?.includes("No active card"), "Should have appropriate error message");
    });
  });

  describe("Integration with crossSquare", () => {
    it("should route square clicks to card selection when card is active", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      const seededPlayer = room.state.players.get(client.sessionId)!;
      seededPlayer.deck.clear();
      seededPlayer.deck.push(makeConnectedRoomCard("card_test_1"));

      // Draw and activate card
      room.send(client, "drawCard", {});
      await room.waitForNextPatch();
      const player = room.state.players.get(client.sessionId);
      const cardId = player!.drawnCards[0].id;
      
      room.send(client, "playCard", { cardId });
      await room.waitForNextPatch();

      // Click a square - should go through card selection logic
      const currentRoom = room.state.getCurrentRoom()!;
      const entranceX = currentRoom.entranceX;
      const entranceY = currentRoom.entranceY;
      let adjacentY = entranceY - 1;
      if (adjacentY < 0 || currentRoom.getSquare(entranceX, adjacentY)?.wall) {
        adjacentY = entranceY + 1;
      }

      room.send(client, "crossSquare", { x: entranceX, y: adjacentY, roomIndex: 0 });
      await room.waitForNextPatch();

      // Check that square selection was processed (not regular crossing)
      const cardState = room.state.getCardSelectionState(client.sessionId);
      assert.strictEqual(cardState.selectedCount, 1, "Should have 1 selected square from card system");
      
      // Square should not be crossed yet (only after 3 selections)
      const square = currentRoom.getSquare(entranceX, adjacentY);
      assert.strictEqual(square?.checked, false, "Square should not be crossed until card action completes");
    });

    it("should reject crossing when no card is active", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      // Find a non-wall square to cross
      const currentRoom = room.state.getCurrentRoom()!;
      let testX = -1, testY = -1;
      
      for (let x = 0; x < currentRoom.width; x++) {
        for (let y = 0; y < currentRoom.height; y++) {
          const square = currentRoom.getSquare(x, y);
          if (square && !square.wall) {
            testX = x;
            testY = y;
            break;
          }
        }
        if (testX !== -1) break;
      }

      // Attempt to cross a square without an active card - should fail
      const result = room.state.crossSquare(client as any, { x: testX, y: testY, roomIndex: 0 });
      assert.strictEqual(result.success, false, "Should fail without an active card");

      // Check that the square was not crossed
      const updatedRoom = room.state.rooms[0];
      const square = updatedRoom.getSquare(testX, testY);
      assert.strictEqual(square?.checked, false, "Square should not be crossed without an active card");

      // Check no card selection state
      const cardState = room.state.getCardSelectionState(client.sessionId);
      assert.strictEqual(cardState.hasActiveCard, false, "Should not have active card");
      assert.strictEqual(cardState.selectedCount, 0, "Should have 0 selected squares");
    });
  });
});
