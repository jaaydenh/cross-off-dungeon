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
  
  it("should initialize squares with walls on the border", () => {
    const width = 5;
    const height = 5;
    const room = new Room(width, height);
    
    // Check border squares are walls
    for (let x = 0; x < width; x++) {
      // Top row
      assert.strictEqual(room.getSquare(x, 0)?.wall, true);
      // Bottom row
      assert.strictEqual(room.getSquare(x, height - 1)?.wall, true);
    }
    
    for (let y = 0; y < height; y++) {
      // Left column
      assert.strictEqual(room.getSquare(0, y)?.wall, true);
      // Right column
      assert.strictEqual(room.getSquare(width - 1, y)?.wall, true);
    }
    
    // Check inner squares are not walls
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
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
    
    // Border squares should not be walkable (they're walls)
    assert.strictEqual(room.isWalkable(0, 0), false);
    assert.strictEqual(room.isWalkable(4, 4), false);
    
    // Inner squares should be walkable
    assert.strictEqual(room.isWalkable(2, 2), true);
    
    // Make an inner square a wall
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
});

