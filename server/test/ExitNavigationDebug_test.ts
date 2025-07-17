import { ColyseusTestServer, boot } from "@colyseus/testing";
import { Dungeon } from "../src/rooms/Dungeon";
import { DungeonState } from "../src/rooms/schema/DungeonState";
import assert from "assert";

describe("Exit Navigation Debug Tests", () => {
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

  describe("Debug specific exit navigation scenarios", () => {
    let room: any;
    let client1: any;

    beforeEach(async () => {
      room = await colyseus.createRoom("dungeon", {});
      client1 = await colyseus.connectTo(room, { name: "TestPlayer1" });
    });

    afterEach(async () => {
      await room.disconnect();
    });

    it("should debug north exit navigation with adjacent crossed square", async () => {
      const state: DungeonState = room.state;
      const currentRoom = state.getCurrentRoom();
      
      if (currentRoom && currentRoom.exitX.length > 0) {
        // Find a north exit
        let northExitIndex = -1;
        let northExitX = -1;
        let northExitY = -1;
        
        for (let i = 0; i < currentRoom.exitDirections.length; i++) {
          if (currentRoom.exitDirections[i] === "north") {
            northExitIndex = i;
            northExitX = currentRoom.exitX[i];
            northExitY = currentRoom.exitY[i];
            break;
          }
        }
        
        if (northExitIndex !== -1) {
          console.log(`Found north exit at (${northExitX}, ${northExitY})`);
          
          // Cross the square directly south of the north exit
          const adjacentX = northExitX;
          const adjacentY = northExitY + 1;
          
          console.log(`Crossing adjacent square at (${adjacentX}, ${adjacentY})`);
          
          // Verify the square exists and is not a wall
          const adjacentSquare = currentRoom.getSquare(adjacentX, adjacentY);
          console.log(`Adjacent square exists: ${!!adjacentSquare}, is wall: ${adjacentSquare?.wall}`);
          
          if (adjacentSquare && !adjacentSquare.wall) {
            // Cross the adjacent square
            await client1.send("crossSquare", { x: adjacentX, y: adjacentY });
            await new Promise(resolve => setTimeout(resolve, 10));
            
            // Verify it was crossed
            console.log(`Adjacent square crossed: ${adjacentSquare.checked}`);
            
            // Set up response listener
            let responseReceived = false;
            let responseData: any = null;
            
            client1.onMessage("crossSquareResult", (data: any) => {
              responseReceived = true;
              responseData = data;
            });
            
            // Now try to cross the north exit
            console.log(`Attempting to cross north exit at (${northExitX}, ${northExitY})`);
            await client1.send("crossSquare", { x: northExitX, y: northExitY });
            await new Promise(resolve => setTimeout(resolve, 50));
            
            console.log(`Response received: ${responseReceived}`);
            console.log(`Response data:`, responseData);
            
            // This should succeed
            assert.strictEqual(responseReceived, true, "Should receive response");
            assert.strictEqual(responseData?.success, true, "Exit navigation should succeed");
          } else {
            console.log("Adjacent square is not valid for crossing");
          }
        } else {
          console.log("No north exit found in current room");
        }
      }
    });

    it("should debug why exit navigation fails with detailed logging", async () => {
      const state: DungeonState = room.state;
      const currentRoom = state.getCurrentRoom();
      
      if (currentRoom && currentRoom.exitX.length > 0) {
        // Get the first exit
        const exitX = currentRoom.exitX[0];
        const exitY = currentRoom.exitY[0];
        const exitDirection = currentRoom.exitDirections[0];
        
        console.log(`Testing exit at (${exitX}, ${exitY}) direction: ${exitDirection}`);
        console.log(`Room dimensions: ${currentRoom.width}x${currentRoom.height}`);
        
        // Check all adjacent squares
        const directions = [
          { dx: 0, dy: -1, name: "North" },
          { dx: 1, dy: 0, name: "East" },
          { dx: 0, dy: 1, name: "South" },
          { dx: -1, dy: 0, name: "West" }
        ];
        
        for (const direction of directions) {
          const adjX = exitX + direction.dx;
          const adjY = exitY + direction.dy;
          
          if (currentRoom.isValidPosition(adjX, adjY)) {
            const square = currentRoom.getSquare(adjX, adjY);
            console.log(`  ${direction.name} (${adjX}, ${adjY}): exists=${!!square}, wall=${square?.wall}, checked=${square?.checked}`);
          } else {
            console.log(`  ${direction.name} (${adjX}, ${adjY}): OUT OF BOUNDS`);
          }
        }
        
        // Try to cross the exit without any adjacent crossed squares
        let responseReceived = false;
        let responseData: any = null;
        
        client1.onMessage("crossSquareResult", (data: any) => {
          responseReceived = true;
          responseData = data;
        });
        
        await client1.send("crossSquare", { x: exitX, y: exitY });
        await new Promise(resolve => setTimeout(resolve, 50));
        
        console.log(`Exit navigation result:`, responseData);
        
        // Should fail due to no adjacent crossed squares
        assert.strictEqual(responseReceived, true, "Should receive response");
        assert.strictEqual(responseData?.success, false, "Should fail without adjacent crossed squares");
      }
    });

    it("should reproduce the bug: exit navigation fails even with adjacent crossed square", async () => {
      const state: DungeonState = room.state;
      const currentRoom = state.getCurrentRoom();
      
      if (currentRoom && currentRoom.exitX.length > 0) {
        // Get the first exit
        const exitX = currentRoom.exitX[0];
        const exitY = currentRoom.exitY[0];
        const exitDirection = currentRoom.exitDirections[0];
        
        console.log(`\n=== REPRODUCING BUG ===`);
        console.log(`Exit at (${exitX}, ${exitY}) direction: ${exitDirection}`);
        
        // Find a valid adjacent square to cross
        const directions = [
          { dx: 0, dy: -1, name: "North" },
          { dx: 1, dy: 0, name: "East" },
          { dx: 0, dy: 1, name: "South" },
          { dx: -1, dy: 0, name: "West" }
        ];
        
        let adjacentSquareToCross = null;
        
        for (const direction of directions) {
          const adjX = exitX + direction.dx;
          const adjY = exitY + direction.dy;
          
          if (currentRoom.isValidPosition(adjX, adjY)) {
            const square = currentRoom.getSquare(adjX, adjY);
            if (square && !square.wall && !square.exit && !square.entrance) {
              adjacentSquareToCross = { x: adjX, y: adjY, direction: direction.name };
              break;
            }
          }
        }
        
        if (adjacentSquareToCross) {
          console.log(`Crossing adjacent square at (${adjacentSquareToCross.x}, ${adjacentSquareToCross.y}) - ${adjacentSquareToCross.direction} of exit`);
          
          // Cross the adjacent square
          await client1.send("crossSquare", { x: adjacentSquareToCross.x, y: adjacentSquareToCross.y });
          await new Promise(resolve => setTimeout(resolve, 10));
          
          // Verify it was crossed
          const crossedSquare = currentRoom.getSquare(adjacentSquareToCross.x, adjacentSquareToCross.y);
          console.log(`Adjacent square crossed: ${crossedSquare?.checked}`);
          
          // Set up response listener for exit navigation
          let responseReceived = false;
          let responseData: any = null;
          
          client1.onMessage("crossSquareResult", (data: any) => {
            responseReceived = true;
            responseData = data;
          });
          
          // Now try to cross the exit - this should succeed
          console.log(`Attempting exit navigation at (${exitX}, ${exitY})`);
          await client1.send("crossSquare", { x: exitX, y: exitY });
          await new Promise(resolve => setTimeout(resolve, 50));
          
          console.log(`Exit navigation result:`, responseData);
          
          // This should succeed since we have an adjacent crossed square
          assert.strictEqual(responseReceived, true, "Should receive response");
          
          if (responseData?.success === false) {
            console.log(`\n!!! BUG REPRODUCED !!!`);
            console.log(`Exit navigation failed despite having adjacent crossed square`);
            console.log(`Error: ${responseData.error}`);
            
            // Let's check the state again
            console.log(`\nPost-failure state check:`);
            for (const direction of directions) {
              const adjX = exitX + direction.dx;
              const adjY = exitY + direction.dy;
              
              if (currentRoom.isValidPosition(adjX, adjY)) {
                const square = currentRoom.getSquare(adjX, adjY);
                console.log(`  ${direction.name} (${adjX}, ${adjY}): checked=${square?.checked}`);
              }
            }
          }
          
          // For now, let's not assert success to see if we can reproduce the bug
          // assert.strictEqual(responseData?.success, true, "Exit navigation should succeed with adjacent crossed square");
        } else {
          console.log("No valid adjacent square found to cross");
        }
      }
    });
  });
});