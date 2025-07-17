import assert from "assert";
import { Room } from "../src/rooms/schema/Room";
import { DungeonSquare } from "../src/rooms/schema/DungeonSquare";

describe("Room", () => {
  it("should create a room with the specified dimensions", () => {
    const width = 8;
    const height = 6;
    const room = new Room(width, height);
    
    assert.strictEqual(room.width, width);
    assert.strictEqual(room.height, height);
    assert.strictEqual(room.squares.length, width * height);
  });
  
  it("should initialize squares without border walls", () => {
    const width = 5;
    const height = 5;
    const room = new Room(width, height);
    
    // Check that all squares are initially not walls
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        assert.strictEqual(room.getSquare(x, y)?.wall, false);
      }
    }
  });
  
  it("should correctly get and set squares by coordinates", () => {
    const room = new Room(5, 5);
    const x = 2;
    const y = 2;
    
    // Get the square
    const square = room.getSquare(x, y);
    assert.notStrictEqual(square, undefined);
    
    if (square) {
      // Modify the square
      square.checked = true;
      square.treasure = true;
      
      // Get it again and verify changes
      const updatedSquare = room.getSquare(x, y);
      assert.strictEqual(updatedSquare?.checked, true);
      assert.strictEqual(updatedSquare?.treasure, true);
    }
    
    // Create a new square and set it
    const newSquare = new DungeonSquare();
    newSquare.monster = true;
    
    // Set the square
    const result = room.setSquare(x, y, newSquare);
    assert.strictEqual(result, true);
    
    // Verify the square was set
    const retrievedSquare = room.getSquare(x, y);
    assert.strictEqual(retrievedSquare?.monster, true);
    assert.strictEqual(retrievedSquare?.checked, false); // Should be reset
  });
  
  it("should validate coordinates correctly", () => {
    const room = new Room(5, 5);
    
    // Valid coordinates
    assert.strictEqual(room.isValidPosition(0, 0), true);
    assert.strictEqual(room.isValidPosition(4, 4), true);
    assert.strictEqual(room.isValidPosition(2, 3), true);
    
    // Invalid coordinates
    assert.strictEqual(room.isValidPosition(-1, 0), false);
    assert.strictEqual(room.isValidPosition(0, -1), false);
    assert.strictEqual(room.isValidPosition(5, 0), false);
    assert.strictEqual(room.isValidPosition(0, 5), false);
  });
  
  it("should correctly identify walkable squares", () => {
    const room = new Room(5, 5);
    
    // All squares should be walkable by default (no border walls)
    assert.strictEqual(room.isWalkable(0, 0), true);
    assert.strictEqual(room.isWalkable(4, 4), true);
    assert.strictEqual(room.isWalkable(2, 2), true);
    
    // Make a square a wall
    const square = room.getSquare(2, 2);
    if (square) {
      square.wall = true;
      
      // Now it should not be walkable
      assert.strictEqual(room.isWalkable(2, 2), false);
    }
    
    // Invalid coordinates should not be walkable
    assert.strictEqual(room.isWalkable(-1, 0), false);
    assert.strictEqual(room.isWalkable(5, 5), false);
  });

  describe("Grid Coordinate Properties", () => {
    it("should initialize with default grid coordinates", () => {
      const room = new Room(8, 8);
      
      assert.strictEqual(room.gridX, 0);
      assert.strictEqual(room.gridY, 0);
    });
    
    it("should allow setting and getting grid coordinates", () => {
      const room = new Room(8, 8);
      
      room.gridX = 5;
      room.gridY = -3;
      
      assert.strictEqual(room.gridX, 5);
      assert.strictEqual(room.gridY, -3);
    });
    
    it("should serialize grid coordinates properly", () => {
      const room = new Room(8, 8);
      room.gridX = 10;
      room.gridY = -5;
      
      // Encode the room state
      const encoded = room.encode();
      
      // Create a new room and decode
      const newRoom = new Room();
      newRoom.decode(encoded);
      
      assert.strictEqual(newRoom.gridX, 10);
      assert.strictEqual(newRoom.gridY, -5);
    });
  });

  describe("Connection Tracking Properties", () => {
    it("should initialize with empty connection arrays", () => {
      const room = new Room(8, 8);
      
      assert.strictEqual(room.connectedRoomIndices.length, 0);
      assert.strictEqual(room.exitConnected.length, 0);
    });
    
    it("should initialize connection arrays when exits are generated", () => {
      const room = new Room(8, 8);
      room.generateExits("none");
      
      const numExits = room.exitDirections.length;
      
      // Connection arrays should match the number of exits
      assert.strictEqual(room.connectedRoomIndices.length, numExits);
      assert.strictEqual(room.exitConnected.length, numExits);
      
      // All exits should initially be unconnected
      for (let i = 0; i < numExits; i++) {
        assert.strictEqual(room.connectedRoomIndices[i], -1);
        assert.strictEqual(room.exitConnected[i], false);
      }
    });
    
    it("should allow setting connection data for exits", () => {
      const room = new Room(8, 8);
      room.generateExits("none");
      
      if (room.exitDirections.length > 0) {
        // Set connection data for first exit
        room.connectedRoomIndices[0] = 5;
        room.exitConnected[0] = true;
        
        assert.strictEqual(room.connectedRoomIndices[0], 5);
        assert.strictEqual(room.exitConnected[0], true);
      }
    });
    
    it("should serialize connection arrays properly", () => {
      const room = new Room(8, 8);
      room.generateExits("none");
      
      if (room.exitDirections.length >= 2) {
        // Set some connection data
        room.connectedRoomIndices[0] = 3;
        room.exitConnected[0] = true;
        room.connectedRoomIndices[1] = 7;
        room.exitConnected[1] = false;
        
        // Encode the room state
        const encoded = room.encode();
        
        // Create a new room and decode
        const newRoom = new Room();
        newRoom.decode(encoded);
        
        assert.strictEqual(newRoom.connectedRoomIndices[0], 3);
        assert.strictEqual(newRoom.exitConnected[0], true);
        assert.strictEqual(newRoom.connectedRoomIndices[1], 7);
        assert.strictEqual(newRoom.exitConnected[1], false);
      }
    });
    
    it("should clear connection arrays when exits are regenerated", () => {
      const room = new Room(8, 8);
      room.generateExits("none");
      
      if (room.exitDirections.length > 0) {
        // Set some connection data
        room.connectedRoomIndices[0] = 5;
        room.exitConnected[0] = true;
      }
      
      // Regenerate exits
      room.generateExits("north");
      
      // Arrays should be cleared and reinitialized
      const numExits = room.exitDirections.length;
      assert.strictEqual(room.connectedRoomIndices.length, numExits);
      assert.strictEqual(room.exitConnected.length, numExits);
      
      // All exits should be unconnected again
      for (let i = 0; i < numExits; i++) {
        assert.strictEqual(room.connectedRoomIndices[i], -1);
        assert.strictEqual(room.exitConnected[i], false);
      }
    });
    
    it("should maintain connection array consistency with exit arrays", () => {
      const room = new Room(8, 8);
      
      // Test multiple generations to ensure consistency
      for (let i = 0; i < 5; i++) {
        const previousDirection = i === 0 ? "none" : ["north", "south", "east", "west"][i % 4];
        room.generateExits(previousDirection);
        
        const numExits = room.exitDirections.length;
        
        // All arrays should have the same length
        assert.strictEqual(room.exitX.length, numExits);
        assert.strictEqual(room.exitY.length, numExits);
        assert.strictEqual(room.connectedRoomIndices.length, numExits);
        assert.strictEqual(room.exitConnected.length, numExits);
        
        // All connection data should be initialized properly
        for (let j = 0; j < numExits; j++) {
          assert.strictEqual(room.connectedRoomIndices[j], -1);
          assert.strictEqual(room.exitConnected[j], false);
        }
      }
    });
  });
});

