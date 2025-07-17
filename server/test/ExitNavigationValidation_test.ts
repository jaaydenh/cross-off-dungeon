import { ColyseusTestServer, boot } from "@colyseus/testing";
import { Dungeon } from "../src/rooms/Dungeon";
import { DungeonState } from "../src/rooms/schema/DungeonState";
import { NavigationValidator } from "../src/rooms/NavigationValidator";
import { Room } from "../src/rooms/schema/Room";
import { DungeonSquare } from "../src/rooms/schema/DungeonSquare";
import assert from "assert";

describe("Exit Navigation Validation Integration Tests", () => {
  let colyseus: ColyseusTestServer;

  before(async () => {
    colyseus = await boot({
      initializeGameServer: (gameServer) => {
        gameServer.define("dungeon", Dungeon);
      },
    });
  });

  after(async () => {
    await colyseus.shutdown();
  });

  describe("crossSquare method with exit navigation validation", () => {
    let room: any;
    let client1: any;

    beforeEach(async () => {
      room = await colyseus.createRoom("dungeon", {});
      client1 = await colyseus.connectTo(room, { name: "TestPlayer1" });
    });

    afterEach(async () => {
      await room.disconnect();
    });

    it("should allow exit navigation when crossed square is orthogonally adjacent", async () => {
      // Get the room state
      const state: DungeonState = room.state;
      const currentRoom = state.getCurrentRoom();
      
      // Ensure we have an exit to test with
      if (currentRoom && currentRoom.exitX.length > 0) {
        const exitX = currentRoom.exitX[0];
        const exitY = currentRoom.exitY[0];
        
        // Find an orthogonally adjacent position to the exit
        let adjacentX = exitX;
        let adjacentY = exitY;
        
        // Try different adjacent positions
        const adjacentPositions = [
          { x: exitX, y: exitY - 1 }, // North
          { x: exitX + 1, y: exitY }, // East
          { x: exitX, y: exitY + 1 }, // South
          { x: exitX - 1, y: exitY }  // West
        ];
        
        let validAdjacentFound = false;
        for (const pos of adjacentPositions) {
          if (currentRoom.isValidPosition(pos.x, pos.y)) {
            const square = currentRoom.getSquare(pos.x, pos.y);
            if (square && !square.wall) {
              adjacentX = pos.x;
              adjacentY = pos.y;
              validAdjacentFound = true;
              break;
            }
          }
        }
        
        if (validAdjacentFound) {
          // First cross the adjacent square
          await client1.send("crossSquare", { x: adjacentX, y: adjacentY });
          
          // Wait for state update
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // Now try to cross the exit - this should succeed
          const initialRoomCount = state.rooms.length;
          await client1.send("crossSquare", { x: exitX, y: exitY });
          
          // Wait for state update
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // Verify that navigation was successful (new room created or connected)
          const exitSquare = currentRoom.getSquare(exitX, exitY);
          assert.strictEqual(exitSquare?.checked, true, "Exit square should be crossed");
        }
      }
    });

    it("should prevent exit navigation when no crossed squares are orthogonally adjacent", async () => {
      // Get the room state
      const state: DungeonState = room.state;
      const currentRoom = state.getCurrentRoom();
      
      // Ensure we have an exit to test with
      if (currentRoom && currentRoom.exitX.length > 0) {
        const exitX = currentRoom.exitX[0];
        const exitY = currentRoom.exitY[0];
        
        // Try to cross the exit without any adjacent crossed squares
        const initialRoomCount = state.rooms.length;
        
        // Set up a listener for the response
        let responseReceived = false;
        let responseData: any = null;
        
        client1.onMessage("crossSquareResult", (data: any) => {
          responseReceived = true;
          responseData = data;
        });
        
        await client1.send("crossSquare", { x: exitX, y: exitY });
        
        // Wait for response
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Verify that navigation was prevented
        assert.strictEqual(responseReceived, true, "Should receive response from server");
        assert.strictEqual(responseData?.success, false, "Navigation should fail");
        assert.ok(responseData?.error?.includes("no crossed squares orthogonally adjacent"), 
                 "Error message should mention adjacency requirement");
        
        // Verify exit square was not crossed
        const exitSquare = currentRoom.getSquare(exitX, exitY);
        assert.strictEqual(exitSquare?.checked, false, "Exit square should not be crossed");
        
        // Verify no new room was created
        assert.strictEqual(state.rooms.length, initialRoomCount, "No new room should be created");
      }
    });

    it("should work with any room index, not just current room", async () => {
      // Get the room state
      const state: DungeonState = room.state;
      const currentRoom = state.getCurrentRoom();
      
      // Create a second room by navigating through an exit first
      if (currentRoom && currentRoom.exitX.length > 0) {
        const exitX = currentRoom.exitX[0];
        const exitY = currentRoom.exitY[0];
        
        // Find and cross an adjacent square
        const adjacentPositions = [
          { x: exitX, y: exitY - 1 }, // North
          { x: exitX + 1, y: exitY }, // East
          { x: exitX, y: exitY + 1 }, // South
          { x: exitX - 1, y: exitY }  // West
        ];
        
        for (const pos of adjacentPositions) {
          if (currentRoom.isValidPosition(pos.x, pos.y)) {
            const square = currentRoom.getSquare(pos.x, pos.y);
            if (square && !square.wall) {
              await client1.send("crossSquare", { x: pos.x, y: pos.y });
              break;
            }
          }
        }
        
        // Navigate through the exit to create a second room
        await client1.send("crossSquare", { x: exitX, y: exitY });
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Now we should have at least 2 rooms
        if (state.rooms.length >= 2) {
          const firstRoomIndex = 0;
          const firstRoom = state.rooms[firstRoomIndex];
          
          // Find a different exit in the first room (not the one we used to navigate)
          let testExitIndex = -1;
          let testExitX = -1;
          let testExitY = -1;
          
          for (let i = 0; i < firstRoom.exitX.length; i++) {
            const exitX = firstRoom.exitX[i];
            const exitY = firstRoom.exitY[i];
            
            // Check if this exit has any adjacent crossed squares
            const adjacentPositions = [
              { x: exitX, y: exitY - 1 }, // North
              { x: exitX + 1, y: exitY }, // East
              { x: exitX, y: exitY + 1 }, // South
              { x: exitX - 1, y: exitY }  // West
            ];
            
            let hasAdjacentCrossed = false;
            for (const pos of adjacentPositions) {
              if (firstRoom.isValidPosition(pos.x, pos.y)) {
                const square = firstRoom.getSquare(pos.x, pos.y);
                if (square && square.checked) {
                  hasAdjacentCrossed = true;
                  break;
                }
              }
            }
            
            // Use this exit if it has no adjacent crossed squares
            if (!hasAdjacentCrossed) {
              testExitIndex = i;
              testExitX = exitX;
              testExitY = exitY;
              break;
            }
          }
          
          if (testExitIndex !== -1) {
            // Set up response listener
            let responseReceived = false;
            let responseData: any = null;
            
            client1.onMessage("crossSquareResult", (data: any) => {
              responseReceived = true;
              responseData = data;
            });
            
            // Try to cross exit in first room without adjacent crossed squares
            await client1.send("crossSquare", { 
              x: testExitX, 
              y: testExitY, 
              roomIndex: firstRoomIndex 
            });
            
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Should fail due to no adjacent crossed squares
            assert.strictEqual(responseReceived, true, "Should receive response");
            assert.strictEqual(responseData?.success, false, "Should fail validation");
            assert.ok(responseData?.error?.includes("no crossed squares orthogonally adjacent"), 
                     "Should mention adjacency requirement");
          } else {
            // If no suitable exit found, test that we can successfully cross a regular square in a non-current room
            let testX = -1;
            let testY = -1;
            
            for (let x = 1; x < firstRoom.width - 1; x++) {
              for (let y = 1; y < firstRoom.height - 1; y++) {
                const square = firstRoom.getSquare(x, y);
                if (square && !square.wall && !square.exit && !square.entrance && !square.checked) {
                  testX = x;
                  testY = y;
                  break;
                }
              }
              if (testX !== -1) break;
            }
            
            if (testX !== -1 && testY !== -1) {
              // Set up response listener
              let responseReceived = false;
              let responseData: any = null;
              
              client1.onMessage("crossSquareResult", (data: any) => {
                responseReceived = true;
                responseData = data;
              });
              
              // Cross a regular square in the first room (not current room)
              await client1.send("crossSquare", { 
                x: testX, 
                y: testY, 
                roomIndex: firstRoomIndex 
              });
              
              await new Promise(resolve => setTimeout(resolve, 50));
              
              // Should succeed
              assert.strictEqual(responseReceived, true, "Should receive response");
              assert.strictEqual(responseData?.success, true, "Regular square crossing should succeed in any room");
              
              // Verify square was crossed
              const square = firstRoom.getSquare(testX, testY);
              assert.strictEqual(square?.checked, true, "Square should be marked as crossed");
            }
          }
        }
      }
    });

    it("should allow regular square crossing (non-exit squares)", async () => {
      // Get the room state
      const state: DungeonState = room.state;
      const currentRoom = state.getCurrentRoom();
      
      if (currentRoom) {
        // Find a non-exit, non-wall square
        let testX = -1;
        let testY = -1;
        
        for (let x = 1; x < currentRoom.width - 1; x++) {
          for (let y = 1; y < currentRoom.height - 1; y++) {
            const square = currentRoom.getSquare(x, y);
            if (square && !square.wall && !square.exit && !square.entrance) {
              testX = x;
              testY = y;
              break;
            }
          }
          if (testX !== -1) break;
        }
        
        if (testX !== -1 && testY !== -1) {
          // Set up response listener
          let responseReceived = false;
          let responseData: any = null;
          
          client1.onMessage("crossSquareResult", (data: any) => {
            responseReceived = true;
            responseData = data;
          });
          
          // Cross the regular square
          await client1.send("crossSquare", { x: testX, y: testY });
          
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Should succeed
          assert.strictEqual(responseReceived, true, "Should receive response");
          assert.strictEqual(responseData?.success, true, "Regular square crossing should succeed");
          
          // Verify square was crossed
          const square = currentRoom.getSquare(testX, testY);
          assert.strictEqual(square?.checked, true, "Square should be marked as crossed");
        }
      }
    });

    it("should prevent crossing wall squares", async () => {
      // Get the room state
      const state: DungeonState = room.state;
      const currentRoom = state.getCurrentRoom();
      
      if (currentRoom) {
        // Find a wall square
        let wallX = -1;
        let wallY = -1;
        
        for (let x = 0; x < currentRoom.width; x++) {
          for (let y = 0; y < currentRoom.height; y++) {
            const square = currentRoom.getSquare(x, y);
            if (square && square.wall) {
              wallX = x;
              wallY = y;
              break;
            }
          }
          if (wallX !== -1) break;
        }
        
        if (wallX !== -1 && wallY !== -1) {
          // Set up response listener
          let responseReceived = false;
          let responseData: any = null;
          
          client1.onMessage("crossSquareResult", (data: any) => {
            responseReceived = true;
            responseData = data;
          });
          
          // Try to cross the wall square
          await client1.send("crossSquare", { x: wallX, y: wallY });
          
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Should fail
          assert.strictEqual(responseReceived, true, "Should receive response");
          assert.strictEqual(responseData?.success, false, "Wall crossing should fail");
          assert.ok(responseData?.error?.includes("Cannot cross wall squares"), 
                   "Should mention wall crossing restriction");
          
          // Verify square was not crossed
          const square = currentRoom.getSquare(wallX, wallY);
          assert.strictEqual(square?.checked, false, "Wall square should not be crossed");
        }
      }
    });

    it("should handle invalid coordinates gracefully", async () => {
      // Set up response listener
      let responseReceived = false;
      let responseData: any = null;
      
      client1.onMessage("crossSquareResult", (data: any) => {
        responseReceived = true;
        responseData = data;
      });
      
      // Try to cross a square with invalid coordinates
      await client1.send("crossSquare", { x: -1, y: -1 });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Should fail gracefully
      assert.strictEqual(responseReceived, true, "Should receive response");
      assert.strictEqual(responseData?.success, false, "Invalid coordinates should fail");
      assert.ok(responseData?.error?.includes("Invalid coordinates"), 
               "Should mention invalid coordinates");
    });

    it("should validate diagonal adjacency is not sufficient for exit navigation", async () => {
      // Get the room state
      const state: DungeonState = room.state;
      const currentRoom = state.getCurrentRoom();
      
      if (currentRoom && currentRoom.exitX.length > 0) {
        const exitX = currentRoom.exitX[0];
        const exitY = currentRoom.exitY[0];
        
        // Find a diagonally adjacent position to the exit
        const diagonalPositions = [
          { x: exitX - 1, y: exitY - 1 }, // Northwest
          { x: exitX + 1, y: exitY - 1 }, // Northeast
          { x: exitX - 1, y: exitY + 1 }, // Southwest
          { x: exitX + 1, y: exitY + 1 }  // Southeast
        ];
        
        let validDiagonalFound = false;
        let diagonalX = -1;
        let diagonalY = -1;
        
        for (const pos of diagonalPositions) {
          if (currentRoom.isValidPosition(pos.x, pos.y)) {
            const square = currentRoom.getSquare(pos.x, pos.y);
            if (square && !square.wall) {
              diagonalX = pos.x;
              diagonalY = pos.y;
              validDiagonalFound = true;
              break;
            }
          }
        }
        
        if (validDiagonalFound) {
          // Cross the diagonally adjacent square
          await client1.send("crossSquare", { x: diagonalX, y: diagonalY });
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // Set up response listener
          let responseReceived = false;
          let responseData: any = null;
          
          client1.onMessage("crossSquareResult", (data: any) => {
            responseReceived = true;
            responseData = data;
          });
          
          // Try to cross the exit - this should fail because diagonal adjacency is not sufficient
          await client1.send("crossSquare", { x: exitX, y: exitY });
          
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Should fail
          assert.strictEqual(responseReceived, true, "Should receive response");
          assert.strictEqual(responseData?.success, false, "Diagonal adjacency should not be sufficient");
          assert.ok(responseData?.error?.includes("no crossed squares orthogonally adjacent"), 
                   "Should mention orthogonal adjacency requirement");
        }
      }
    });
  });

  describe("NavigationValidator unit tests within integration context", () => {
    it("should correctly identify orthogonally adjacent crossed squares", () => {
      const validator = new NavigationValidator();
      const room = new Room(8, 8);
      
      // Create a test scenario with crossed squares
      const centerX = 4;
      const centerY = 4;
      
      // Cross some squares around the center
      const northSquare = room.getSquare(centerX, centerY - 1);
      const eastSquare = room.getSquare(centerX + 1, centerY);
      const southSquare = room.getSquare(centerX, centerY + 1);
      const westSquare = room.getSquare(centerX - 1, centerY);
      
      if (northSquare) northSquare.checked = true;
      if (eastSquare) eastSquare.checked = true;
      // Leave south and west uncrossed
      
      // Test finding adjacent crossed squares
      const adjacentCrossed = validator.findAdjacentCrossedSquares(room, centerX, centerY);
      
      assert.strictEqual(adjacentCrossed.length, 2, "Should find exactly 2 adjacent crossed squares");
      assert.ok(adjacentCrossed.includes(northSquare!), "Should include north square");
      assert.ok(adjacentCrossed.includes(eastSquare!), "Should include east square");
    });

    it("should correctly validate orthogonal adjacency", () => {
      const validator = new NavigationValidator();
      
      // Test orthogonal adjacency
      assert.strictEqual(validator.isOrthogonallyAdjacent(0, 0, 0, 1), true, "North should be adjacent");
      assert.strictEqual(validator.isOrthogonallyAdjacent(0, 0, 1, 0), true, "East should be adjacent");
      assert.strictEqual(validator.isOrthogonallyAdjacent(1, 1, 1, 0), true, "South should be adjacent");
      assert.strictEqual(validator.isOrthogonallyAdjacent(1, 1, 0, 1), true, "West should be adjacent");
      
      // Test diagonal adjacency (should be false)
      assert.strictEqual(validator.isOrthogonallyAdjacent(0, 0, 1, 1), false, "Diagonal should not be adjacent");
      assert.strictEqual(validator.isOrthogonallyAdjacent(1, 1, 0, 0), false, "Diagonal should not be adjacent");
      
      // Test non-adjacent
      assert.strictEqual(validator.isOrthogonallyAdjacent(0, 0, 0, 2), false, "Distance 2 should not be adjacent");
      assert.strictEqual(validator.isOrthogonallyAdjacent(0, 0, 2, 0), false, "Distance 2 should not be adjacent");
    });
  });
});