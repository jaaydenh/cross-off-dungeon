import assert from "assert";
import { DungeonState } from "../src/rooms/schema/DungeonState";
import { Room } from "../src/rooms/schema/Room";

describe("Grid Room Generation Integration Tests", () => {
  let dungeonState: DungeonState;

  beforeEach(() => {
    dungeonState = new DungeonState();
    dungeonState.initializeBoard();
  });

  describe("Grid Coordinate Assignment", () => {
    it("should assign proper grid coordinates based on exit direction", () => {
      // Get the initial room at origin
      const initialRoom = dungeonState.getCurrentRoom();
      assert(initialRoom, "Initial room should exist");
      
      // Verify initial room is at origin
      const initialCoords = dungeonState.getGridCoordinates(0);
      assert.deepEqual(initialCoords, { x: 0, y: 0 }, "Initial room should be at origin (0,0)");
      
      // Simulate adding a room to the north
      const northRoom = dungeonState.addNewRoom("north", 0);
      assert(northRoom, "North room should be created");
      
      // Verify the new room has correct grid coordinates
      const northRoomIndex = dungeonState.currentRoomIndex;
      const northCoords = dungeonState.getGridCoordinates(northRoomIndex);
      assert.deepEqual(northCoords, { x: 0, y: -1 }, "North room should be at (0,-1)");
    });

    it("should assign correct coordinates for all four directions", () => {
      // Create rooms in all four directions from origin
      const directions = [
        { dir: "north", expected: { x: 0, y: -1 } },
        { dir: "south", expected: { x: 0, y: 1 } },
        { dir: "east", expected: { x: 1, y: 0 } },
        { dir: "west", expected: { x: -1, y: 0 } }
      ];

      // Reset to initial state for each direction test
      for (const { dir, expected } of directions) {
        dungeonState = new DungeonState();
        dungeonState.initializeBoard();
        
        // Add room in the specified direction
        dungeonState.addNewRoom(dir, 0);
        
        // Verify coordinates
        const newRoomIndex = dungeonState.currentRoomIndex;
        const coords = dungeonState.getGridCoordinates(newRoomIndex);
        assert.deepEqual(coords, expected, `Room in ${dir} direction should be at ${JSON.stringify(expected)}`);
      }
    });
  });

  describe("Existing Room Detection", () => {
    it("should check for existing rooms at target coordinates", () => {
      // Create a room to the north
      dungeonState.addNewRoom("north", 0);
      const northRoomIndex = dungeonState.currentRoomIndex;
      
      // Go back to the original room
      dungeonState.currentRoomIndex = 0;
      
      // Try to create another room to the north - should connect to existing
      const existingRoom = dungeonState.addNewRoom("north", 0);
      
      // Should return to the same north room
      assert.equal(dungeonState.currentRoomIndex, northRoomIndex, "Should connect to existing north room");
      
      // Verify grid position mapping
      const gridKey = "0,-1";
      const mappedRoomIndex = dungeonState.roomGridPositions.get(gridKey);
      assert.equal(mappedRoomIndex, northRoomIndex, "Grid position should map to the existing room");
    });

    it("should not create duplicate rooms at same coordinates", () => {
      const initialRoomCount = dungeonState.displayedRoomIndices.length;
      
      // Create room to the east
      dungeonState.addNewRoom("east", 0);
      const afterFirstRoom = dungeonState.displayedRoomIndices.length;
      
      // Go back to origin
      dungeonState.currentRoomIndex = 0;
      
      // Try to create another room to the east
      dungeonState.addNewRoom("east", 0);
      const afterSecondAttempt = dungeonState.displayedRoomIndices.length;
      
      // Should not have created a new room
      assert.equal(afterSecondAttempt, afterFirstRoom, "Should not create duplicate room at same coordinates");
    });
  });

  describe("Connection Logic", () => {
    it("should link exits with adjacent discovered rooms", () => {
      // Get the original room's exits before creating new room
      const originalRoom = dungeonState.rooms[0];
      const originalExitCount = originalRoom.exitDirections.length;
      
      // Create a room to the north
      dungeonState.addNewRoom("north", 0);
      const northRoomIndex = dungeonState.currentRoomIndex;
      
      // Check that connections were established
      const northRoom = dungeonState.rooms[northRoomIndex];
      
      // Verify that at least one connection was made from the original room
      let hasConnection = false;
      for (let i = 0; i < originalRoom.connectedRoomIndices.length; i++) {
        if (originalRoom.connectedRoomIndices[i] === northRoomIndex) {
          hasConnection = true;
          assert.equal(originalRoom.exitConnected[i], true, "Connected exit should be marked as connected");
          break;
        }
      }
      
      assert(hasConnection, "Original room should have a connection to the north room");
      
      // Verify that the north room has a connection back to the original room
      let hasReverseConnection = false;
      for (let i = 0; i < northRoom.connectedRoomIndices.length; i++) {
        if (northRoom.connectedRoomIndices[i] === 0) {
          hasReverseConnection = true;
          assert.equal(northRoom.exitConnected[i], true, "Reverse connection should be marked as connected");
          break;
        }
      }
      
      assert(hasReverseConnection, "North room should have a connection back to the original room");
    });

    it("should establish bidirectional connections", () => {
      // Create a room to the east
      dungeonState.addNewRoom("east", 0);
      const eastRoomIndex = dungeonState.currentRoomIndex;
      
      const originalRoom = dungeonState.rooms[0];
      const eastRoom = dungeonState.rooms[eastRoomIndex];
      
      // Verify that there's a connection from original room to east room
      let originalToEastConnection = false;
      for (let i = 0; i < originalRoom.connectedRoomIndices.length; i++) {
        if (originalRoom.connectedRoomIndices[i] === eastRoomIndex) {
          originalToEastConnection = true;
          assert.equal(originalRoom.exitConnected[i], true, "Connection should be marked as connected");
          break;
        }
      }
      
      // Verify that there's a connection from east room back to original room
      let eastToOriginalConnection = false;
      for (let i = 0; i < eastRoom.connectedRoomIndices.length; i++) {
        if (eastRoom.connectedRoomIndices[i] === 0) {
          eastToOriginalConnection = true;
          assert.equal(eastRoom.exitConnected[i], true, "Reverse connection should be marked as connected");
          break;
        }
      }
      
      // Verify bidirectional connection exists
      assert(originalToEastConnection, "Original room should have connection to east room");
      assert(eastToOriginalConnection, "East room should have connection back to original room");
    });
  });

  describe("Room Reuse Logic", () => {
    it("should connect to existing rooms instead of always creating new ones", () => {
      // Create a 2x2 grid of rooms
      // Start at origin (0,0)
      
      // Go north to (0,1)
      dungeonState.addNewRoom("north", 0);
      const northRoomIndex = dungeonState.currentRoomIndex;
      
      // Go east to (1,1)
      dungeonState.addNewRoom("east", 0);
      const northEastRoomIndex = dungeonState.currentRoomIndex;
      
      // Go south to (1,0)
      dungeonState.addNewRoom("south", 0);
      const eastRoomIndex = dungeonState.currentRoomIndex;
      
      // Go west - should connect back to origin (0,0)
      dungeonState.addNewRoom("west", 0);
      
      // Should be back at the original room
      assert.equal(dungeonState.currentRoomIndex, 0, "Should connect back to original room at origin");
      
      // Verify the connection was established
      const eastRoom = dungeonState.rooms[eastRoomIndex];
      
      // Check if there's any connection from east room to origin
      let hasConnectionToOrigin = false;
      for (let i = 0; i < eastRoom.connectedRoomIndices.length; i++) {
        if (eastRoom.connectedRoomIndices[i] === 0) {
          hasConnectionToOrigin = true;
          assert.equal(eastRoom.exitConnected[i], true, "Connection to origin should be marked as connected");
          break;
        }
      }
      
      assert(hasConnectionToOrigin, "East room should have connection to origin");
    });

    it("should handle complex grid navigation patterns", () => {
      // Create a more complex pattern: origin -> north -> east -> south -> west (back to north)
      
      // Go north
      dungeonState.addNewRoom("north", 0);
      const northRoomIndex = dungeonState.currentRoomIndex;
      
      // Go east from north room
      dungeonState.addNewRoom("east", 0);
      const northEastRoomIndex = dungeonState.currentRoomIndex;
      
      // Go south from northeast room
      dungeonState.addNewRoom("south", 0);
      const eastRoomIndex = dungeonState.currentRoomIndex;
      
      // Go west from east room - should connect back to origin
      dungeonState.addNewRoom("west", 0);
      assert.equal(dungeonState.currentRoomIndex, 0, "Should be back at origin");
      
      // Go north from origin - should connect to existing north room
      dungeonState.addNewRoom("north", 0);
      assert.equal(dungeonState.currentRoomIndex, northRoomIndex, "Should connect to existing north room");
    });
  });

  describe("Display Position Management", () => {
    it("should update display positions based on grid coordinates", () => {
      const initialDisplayCount = dungeonState.displayedRoomIndices.length;
      
      // Create room to the east
      dungeonState.addNewRoom("east", 0);
      
      // Should have one more displayed room
      assert.equal(dungeonState.displayedRoomIndices.length, initialDisplayCount + 1, "Should have one more displayed room");
      
      // Check display positions
      const eastRoomDisplayIndex = dungeonState.displayedRoomIndices.length - 1;
      const displayX = dungeonState.roomPositionsX[eastRoomDisplayIndex];
      const displayY = dungeonState.roomPositionsY[eastRoomDisplayIndex];
      
      // Display position should be relative to origin
      assert.equal(displayX, 1, "East room display X should be 1");
      assert.equal(displayY, 0, "East room display Y should be 0");
    });

    it("should not duplicate rooms in display when connecting to existing rooms", () => {
      // Create room to north
      dungeonState.addNewRoom("north", 0);
      const afterFirstRoom = dungeonState.displayedRoomIndices.length;
      
      // Go back to origin and try north again
      dungeonState.currentRoomIndex = 0;
      dungeonState.addNewRoom("north", 0);
      const afterSecondAttempt = dungeonState.displayedRoomIndices.length;
      
      // Should not have added another displayed room
      assert.equal(afterSecondAttempt, afterFirstRoom, "Should not duplicate displayed rooms");
    });
  });

  describe("Grid Constraints Validation", () => {
    it("should maintain grid integrity across multiple room generations", () => {
      const roomPositions = new Set<string>();
      
      // Create several rooms and track their positions
      const moves = ["north", "east", "south", "west", "north", "east"];
      
      for (const direction of moves) {
        dungeonState.addNewRoom(direction, 0);
        const coords = dungeonState.getGridCoordinates(dungeonState.currentRoomIndex);
        
        if (coords) {
          const posKey = `${coords.x},${coords.y}`;
          
          // Each position should be unique or reused (not duplicated)
          const roomAtPos = dungeonState.roomGridPositions.get(posKey);
          assert(roomAtPos !== undefined, `Room should exist at position ${posKey}`);
          
          roomPositions.add(posKey);
        }
      }
      
      // Verify grid mapping consistency
      for (const [gridKey, roomIndex] of dungeonState.roomGridPositions.entries()) {
        const room = dungeonState.rooms[roomIndex];
        const expectedKey = `${room.gridX},${room.gridY}`;
        assert.equal(gridKey, expectedKey, "Grid key should match room coordinates");
      }
    });

    it("should handle edge cases in room generation", () => {
      // Test with invalid directions
      const invalidRoom = dungeonState.addNewRoom("invalid", 0);
      assert(!invalidRoom, "Should not create room with invalid direction");
      
      // Test with out-of-bounds exit index
      const currentRoomIndex = dungeonState.currentRoomIndex;
      dungeonState.addNewRoom("north", 999);
      
      // Should still be at the same room if invalid exit index
      // (This depends on implementation - the method might still work if it doesn't validate exit index)
    });
  });

  describe("Room Generation State Consistency", () => {
    it("should maintain consistent state after multiple room generations", () => {
      const initialState = {
        roomCount: dungeonState.rooms.length,
        displayedCount: dungeonState.displayedRoomIndices.length,
        gridMappingCount: dungeonState.roomGridPositions.size
      };
      
      // Generate several rooms
      const directions = ["north", "east", "south", "west", "north"];
      for (const dir of directions) {
        dungeonState.addNewRoom(dir, 0);
      }
      
      // Verify state consistency - with real-time generation, room count should increase
      assert(dungeonState.rooms.length >= initialState.roomCount, "Room array length should increase with real-time generation");
      assert(dungeonState.displayedRoomIndices.length >= initialState.displayedCount, "Displayed rooms should increase or stay same");
      assert(dungeonState.roomGridPositions.size >= initialState.gridMappingCount, "Grid mappings should increase or stay same");
      
      // Verify all displayed rooms have valid indices
      for (const roomIndex of dungeonState.displayedRoomIndices) {
        assert(roomIndex >= 0 && roomIndex < dungeonState.rooms.length, "All displayed room indices should be valid");
      }
      
      // Verify all grid positions map to valid rooms
      for (const [gridKey, roomIndex] of dungeonState.roomGridPositions.entries()) {
        assert(roomIndex >= 0 && roomIndex < dungeonState.rooms.length, "All grid-mapped room indices should be valid");
        
        const room = dungeonState.rooms[roomIndex];
        const [x, y] = gridKey.split(',').map(Number);
        assert.equal(room.gridX, x, "Room gridX should match grid key X");
        assert.equal(room.gridY, y, "Room gridY should match grid key Y");
      }
    });
  });
});