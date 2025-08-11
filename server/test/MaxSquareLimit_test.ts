import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import { describe, it, before, after, beforeEach } from "mocha";
import appConfig from "../src/app.config";

describe("Maximum Square Selection Limit", () => {
  let colyseus: ColyseusTestServer;

  before(async () => colyseus = await boot(appConfig));
  after(async () => await colyseus.shutdown());
  beforeEach(async () => await colyseus.cleanup());

  describe("3-Square Maximum Validation", () => {
    it("should prevent selecting more than 3 squares when playing a card", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      // Wait for initial state
      await room.waitForNextPatch();

      // Draw a card
      room.send(client, "drawCard", {});
      await room.waitForNextPatch();

      const player = room.state.players.get(client.sessionId);
      assert(player !== undefined);
      assert.strictEqual(player.drawnCards.length, 1);

      // Play the card
      const cardId = player.drawnCards[0].id;
      room.send(client, "playCard", { cardId });
      await room.waitForNextPatch();

      // Manually create a test scenario by selecting 3 squares first
      const currentRoom = room.state.getCurrentRoom()!;
      const entranceX = currentRoom.entranceX;
      const entranceY = currentRoom.entranceY;

      // Find at least one valid square adjacent to entrance
      let firstSquare = null;
      const adjacentPositions = [
        {x: entranceX, y: entranceY + 1},
        {x: entranceX + 1, y: entranceY},
        {x: entranceX, y: entranceY - 1},
        {x: entranceX - 1, y: entranceY}
      ];

      for (const pos of adjacentPositions) {
        if (pos.x >= 0 && pos.x < currentRoom.width && pos.y >= 0 && pos.y < currentRoom.height) {
          const square = currentRoom.getSquare(pos.x, pos.y);
          if (square && !square.wall && !square.checked) {
            firstSquare = pos;
            break;
          }
        }
      }

      if (firstSquare) {
        // Select first square
        const result1 = room.state.selectSquareForCard(client.sessionId, 0, firstSquare.x, firstSquare.y);
        assert.strictEqual(result1.success, true, "Should successfully select first square");

        // Find a second square adjacent to the first
        let secondSquare = null;
        const secondAdjacent = [
          {x: firstSquare.x, y: firstSquare.y + 1},
          {x: firstSquare.x + 1, y: firstSquare.y},
          {x: firstSquare.x, y: firstSquare.y - 1},
          {x: firstSquare.x - 1, y: firstSquare.y}
        ];

        for (const pos of secondAdjacent) {
          if (pos.x >= 0 && pos.x < currentRoom.width && pos.y >= 0 && pos.y < currentRoom.height) {
            const square = currentRoom.getSquare(pos.x, pos.y);
            if (square && !square.wall && !square.checked && !(pos.x === entranceX && pos.y === entranceY)) {
              secondSquare = pos;
              break;
            }
          }
        }

        if (secondSquare) {
          // Select second square
          const result2 = room.state.selectSquareForCard(client.sessionId, 0, secondSquare.x, secondSquare.y);
          assert.strictEqual(result2.success, true, "Should successfully select second square");

          // Find a third square adjacent to either first or second
          let thirdSquare = null;
          const thirdAdjacent = [
            ...secondAdjacent,
            {x: secondSquare.x, y: secondSquare.y + 1},
            {x: secondSquare.x + 1, y: secondSquare.y},
            {x: secondSquare.x, y: secondSquare.y - 1},
            {x: secondSquare.x - 1, y: secondSquare.y}
          ];

          for (const pos of thirdAdjacent) {
            if (pos.x >= 0 && pos.x < currentRoom.width && pos.y >= 0 && pos.y < currentRoom.height) {
              const square = currentRoom.getSquare(pos.x, pos.y);
              if (square && !square.wall && !square.checked && 
                  !(pos.x === entranceX && pos.y === entranceY) &&
                  !(pos.x === firstSquare.x && pos.y === firstSquare.y) &&
                  !(pos.x === secondSquare.x && pos.y === secondSquare.y)) {
                thirdSquare = pos;
                break;
              }
            }
          }

          if (thirdSquare) {
            // Select third square - this should auto-complete due to 3-square limit
            const result3 = room.state.selectSquareForCard(client.sessionId, 0, thirdSquare.x, thirdSquare.y);
            assert.strictEqual(result3.success, true, "Should successfully select third square and auto-complete");
            assert.strictEqual(result3.completed, true, "Should auto-complete when 3rd square is selected");

            // Verify card action is completed and no more selections are possible
            const cardState = room.state.getCardSelectionState(client.sessionId);
            assert.strictEqual(cardState.hasActiveCard, false, "Should no longer have active card after completion");
            assert.strictEqual(cardState.selectedCount, 0, "Should have cleared selection count after completion");
          } else {
            console.log("Skipping max limit test - couldn't find third connected square");
          }
        } else {
          console.log("Skipping max limit test - couldn't find second connected square");
        }
      } else {
        console.log("Skipping max limit test - couldn't find first valid square");
      }
    });

    it("should allow selecting exactly 3 squares and confirming", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      // Wait for initial state
      await room.waitForNextPatch();

      // Draw and play a card
      room.send(client, "drawCard", {});
      await room.waitForNextPatch();

      const player = room.state.players.get(client.sessionId);
      const cardId = player!.drawnCards[0].id;
      room.send(client, "playCard", { cardId });
      await room.waitForNextPatch();

      // Find 3 connected squares
      const currentRoom = room.state.getCurrentRoom()!;
      const entranceX = currentRoom.entranceX;
      const entranceY = currentRoom.entranceY;

      const squares: Array<{x: number, y: number}> = [];
      
      // Find 3 connected squares
      for (let i = 1; i <= 3; i++) {
        const testX = entranceX;
        const testY = entranceY + i;
        
        if (testY < currentRoom.height) {
          const square = currentRoom.getSquare(testX, testY);
          if (square && !square.wall && !square.checked) {
            squares.push({x: testX, y: testY});
          } else {
            break;
          }
        }
      }

      if (squares.length >= 3) {
        // Select exactly 3 squares
        for (let i = 0; i < 3; i++) {
          const result = room.state.selectSquareForCard(client.sessionId, 0, squares[i].x, squares[i].y);
          assert.strictEqual(result.success, true);
          
          // Check the message for the 3rd square
          if (i === 2) {
            assert(result.message?.includes("Maximum reached"), "Should indicate maximum reached for 3rd square");
          }
        }

        // Confirm the action
        const confirmResult = room.state.confirmCardAction(client.sessionId);
        assert.strictEqual(confirmResult.success, true);
        assert.strictEqual(confirmResult.completed, true);

        // Verify squares are crossed
        for (const square of squares) {
          const roomSquare = currentRoom.getSquare(square.x, square.y);
          assert.strictEqual(roomSquare!.checked, true, `Square at ${square.x},${square.y} should be crossed`);
        }
      } else {
        console.log("Skipping 3-square confirmation test - couldn't find 3 connected squares");
      }
    });

    it("should allow selecting fewer than 3 squares and confirming", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      // Wait for initial state
      await room.waitForNextPatch();

      // Draw and play a card
      room.send(client, "drawCard", {});
      await room.waitForNextPatch();

      const player = room.state.players.get(client.sessionId);
      const cardId = player!.drawnCards[0].id;
      room.send(client, "playCard", { cardId });
      await room.waitForNextPatch();

      // Find 1 square adjacent to entrance
      const currentRoom = room.state.getCurrentRoom()!;
      const entranceX = currentRoom.entranceX;
      const entranceY = currentRoom.entranceY;

      let testSquare = null;
      
      // Try adjacent squares
      const adjacentPositions = [
        {x: entranceX, y: entranceY + 1},
        {x: entranceX + 1, y: entranceY},
        {x: entranceX, y: entranceY - 1},
        {x: entranceX - 1, y: entranceY}
      ];

      for (const pos of adjacentPositions) {
        if (pos.x >= 0 && pos.x < currentRoom.width && pos.y >= 0 && pos.y < currentRoom.height) {
          const square = currentRoom.getSquare(pos.x, pos.y);
          if (square && !square.wall && !square.checked) {
            testSquare = pos;
            break;
          }
        }
      }

      if (testSquare) {
        // Select only 1 square
        const result = room.state.selectSquareForCard(client.sessionId, 0, testSquare.x, testSquare.y);
        assert.strictEqual(result.success, true);
        assert(result.message?.includes("(1/3)"), "Should show 1/3 in message");

        // Confirm with just 1 square
        const confirmResult = room.state.confirmCardAction(client.sessionId);
        assert.strictEqual(confirmResult.success, true);
        assert.strictEqual(confirmResult.completed, true);

        // Verify the square is crossed
        const roomSquare = currentRoom.getSquare(testSquare.x, testSquare.y);
        assert.strictEqual(roomSquare!.checked, true);
      } else {
        console.log("Skipping 1-square test - couldn't find valid adjacent square");
      }
    });

    it("should enforce 3-square maximum limit directly", async () => {
      const room = await colyseus.createRoom("dungeon", {});
      const client = await colyseus.connectTo(room, { name: "TestPlayer" });

      // Wait for initial state
      await room.waitForNextPatch();

      // Draw and play a card
      room.send(client, "drawCard", {});
      await room.waitForNextPatch();

      const player = room.state.players.get(client.sessionId);
      const cardId = player!.drawnCards[0].id;
      room.send(client, "playCard", { cardId });
      await room.waitForNextPatch();

      // Manually set up the selection state to have 3 squares already selected
      // This simulates the state just before trying to select a 4th square
      room.state.selectedSquares.set(client.sessionId, "0:1,1;0:1,2;0:2,1");
      room.state.selectedSquareCount.set(client.sessionId, 3);

      // Try to select a 4th square - this should fail due to the limit
      const result = room.state.selectSquareForCard(client.sessionId, 0, 2, 2);
      
      assert.strictEqual(result.success, false, "Should fail to select 4th square");
      assert.strictEqual(result.error, "Maximum of 3 squares can be selected per card");
      assert.strictEqual(result.invalidSquare, true);

      // Verify the selection count is still 3
      const finalCount = room.state.selectedSquareCount.get(client.sessionId);
      assert.strictEqual(finalCount, 3, "Selection count should remain at 3");
    });
  });
});