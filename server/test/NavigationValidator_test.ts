import assert from "assert";
import { NavigationValidator } from "../src/rooms/NavigationValidator";
import { Room } from "../src/rooms/schema/Room";
import { DungeonSquare } from "../src/rooms/schema/DungeonSquare";

describe("NavigationValidator", () => {
  let validator: NavigationValidator;
  let room: Room;

  beforeEach(() => {
    validator = new NavigationValidator();
    room = new Room(6, 6); // Create a 6x6 room for testing
  });

  describe("isOrthogonallyAdjacent", () => {
    it("should return true for coordinates that are orthogonally adjacent", () => {
      // Test all four orthogonal directions
      assert.strictEqual(validator.isOrthogonallyAdjacent(2, 2, 2, 1), true); // North
      assert.strictEqual(validator.isOrthogonallyAdjacent(2, 2, 3, 2), true); // East
      assert.strictEqual(validator.isOrthogonallyAdjacent(2, 2, 2, 3), true); // South
      assert.strictEqual(validator.isOrthogonallyAdjacent(2, 2, 1, 2), true); // West
    });

    it("should return false for coordinates that are diagonally adjacent", () => {
      // Test all four diagonal directions
      assert.strictEqual(validator.isOrthogonallyAdjacent(2, 2, 1, 1), false); // Northwest
      assert.strictEqual(validator.isOrthogonallyAdjacent(2, 2, 3, 1), false); // Northeast
      assert.strictEqual(validator.isOrthogonallyAdjacent(2, 2, 3, 3), false); // Southeast
      assert.strictEqual(validator.isOrthogonallyAdjacent(2, 2, 1, 3), false); // Southwest
    });

    it("should return false for coordinates that are the same", () => {
      assert.strictEqual(validator.isOrthogonallyAdjacent(2, 2, 2, 2), false);
    });

    it("should return false for coordinates that are too far apart", () => {
      assert.strictEqual(validator.isOrthogonallyAdjacent(2, 2, 2, 4), false); // 2 units away vertically
      assert.strictEqual(validator.isOrthogonallyAdjacent(2, 2, 4, 2), false); // 2 units away horizontally
      assert.strictEqual(validator.isOrthogonallyAdjacent(2, 2, 5, 5), false); // Far away diagonally
    });
  });

  describe("findAdjacentCrossedSquares", () => {
    it("should find crossed squares orthogonally adjacent to given coordinates", () => {
      // Set up a room with some crossed squares
      const centerX = 3, centerY = 3;
      
      // Cross squares in all four orthogonal directions
      const northSquare = room.getSquare(centerX, centerY - 1);
      const eastSquare = room.getSquare(centerX + 1, centerY);
      const southSquare = room.getSquare(centerX, centerY + 1);
      const westSquare = room.getSquare(centerX - 1, centerY);
      
      if (northSquare) northSquare.checked = true;
      if (eastSquare) eastSquare.checked = true;
      if (southSquare) southSquare.checked = true;
      if (westSquare) westSquare.checked = true;

      const adjacentCrossed = validator.findAdjacentCrossedSquares(room, centerX, centerY);
      
      assert.strictEqual(adjacentCrossed.length, 4);
      assert.strictEqual(adjacentCrossed.includes(northSquare!), true);
      assert.strictEqual(adjacentCrossed.includes(eastSquare!), true);
      assert.strictEqual(adjacentCrossed.includes(southSquare!), true);
      assert.strictEqual(adjacentCrossed.includes(westSquare!), true);
    });

    it("should not find uncrossed squares even if they are adjacent", () => {
      const centerX = 3, centerY = 3;
      
      // Set up adjacent squares but don't cross them
      const northSquare = room.getSquare(centerX, centerY - 1);
      const eastSquare = room.getSquare(centerX + 1, centerY);
      
      if (northSquare) northSquare.checked = false;
      if (eastSquare) eastSquare.checked = false;

      const adjacentCrossed = validator.findAdjacentCrossedSquares(room, centerX, centerY);
      
      assert.strictEqual(adjacentCrossed.length, 0);
    });

    it("should handle edge coordinates without crashing", () => {
      // Test corner coordinates
      let adjacentCrossed = validator.findAdjacentCrossedSquares(room, 0, 0);
      assert.strictEqual(adjacentCrossed.length, 0);

      // Test edge coordinates
      adjacentCrossed = validator.findAdjacentCrossedSquares(room, 0, 3);
      assert.strictEqual(adjacentCrossed.length, 0);

      // Test coordinates outside room bounds
      adjacentCrossed = validator.findAdjacentCrossedSquares(room, -1, -1);
      assert.strictEqual(adjacentCrossed.length, 0);

      adjacentCrossed = validator.findAdjacentCrossedSquares(room, 10, 10);
      assert.strictEqual(adjacentCrossed.length, 0);
    });

    it("should find partial adjacent crossed squares", () => {
      const centerX = 3, centerY = 3;
      
      // Cross only some adjacent squares
      const northSquare = room.getSquare(centerX, centerY - 1);
      const southSquare = room.getSquare(centerX, centerY + 1);
      
      if (northSquare) northSquare.checked = true;
      if (southSquare) southSquare.checked = true;

      const adjacentCrossed = validator.findAdjacentCrossedSquares(room, centerX, centerY);
      
      assert.strictEqual(adjacentCrossed.length, 2);
      assert.strictEqual(adjacentCrossed.includes(northSquare!), true);
      assert.strictEqual(adjacentCrossed.includes(southSquare!), true);
    });
  });

  describe("canNavigateToExit", () => {
    beforeEach(() => {
      // Create a room with exits for testing
      room.createExit("north");
      room.createExit("east");
    });

    it("should allow navigation when there are crossed squares adjacent to exit", () => {
      // Get the first exit (north)
      const exitX = room.exitX[0];
      const exitY = room.exitY[0];
      
      // Cross a square adjacent to the exit
      const adjacentSquare = room.getSquare(exitX, exitY + 1); // South of the north exit
      if (adjacentSquare) {
        adjacentSquare.checked = true;
      }

      const canNavigate = validator.canNavigateToExit(room, 0);
      assert.strictEqual(canNavigate, true);
    });

    it("should prevent navigation when there are no crossed squares adjacent to exit", () => {
      // Don't cross any squares adjacent to the exit
      const canNavigate = validator.canNavigateToExit(room, 0);
      assert.strictEqual(canNavigate, false);
    });

    it("should handle invalid exit indices", () => {
      // Test negative index
      let canNavigate = validator.canNavigateToExit(room, -1);
      assert.strictEqual(canNavigate, false);

      // Test index beyond available exits
      canNavigate = validator.canNavigateToExit(room, 10);
      assert.strictEqual(canNavigate, false);
    });

    it("should work with multiple exits independently", () => {
      // Get exit coordinates
      const northExitX = room.exitX[0];
      const northExitY = room.exitY[0];
      const eastExitX = room.exitX[1];
      const eastExitY = room.exitY[1];
      
      // Cross a square adjacent to only the north exit
      const northAdjacentSquare = room.getSquare(northExitX, northExitY + 1);
      if (northAdjacentSquare) {
        northAdjacentSquare.checked = true;
      }

      // North exit should be navigable
      assert.strictEqual(validator.canNavigateToExit(room, 0), true);
      
      // East exit should not be navigable
      assert.strictEqual(validator.canNavigateToExit(room, 1), false);
    });

    it("should work with exits on different walls", () => {
      // Create a room with exits on all walls
      const testRoom = new Room(8, 8);
      testRoom.createExit("north");
      testRoom.createExit("east");
      testRoom.createExit("south");
      testRoom.createExit("west");

      // Cross squares adjacent to each exit
      for (let i = 0; i < testRoom.exitX.length; i++) {
        const exitX = testRoom.exitX[i];
        const exitY = testRoom.exitY[i];
        const direction = testRoom.exitDirections[i];
        
        // Find an adjacent square based on exit direction
        let adjacentX = exitX;
        let adjacentY = exitY;
        
        switch (direction) {
          case "north":
            adjacentY = exitY + 1; // South of north exit
            break;
          case "east":
            adjacentX = exitX - 1; // West of east exit
            break;
          case "south":
            adjacentY = exitY - 1; // North of south exit
            break;
          case "west":
            adjacentX = exitX + 1; // East of west exit
            break;
        }
        
        const adjacentSquare = testRoom.getSquare(adjacentX, adjacentY);
        if (adjacentSquare) {
          adjacentSquare.checked = true;
        }
        
        // This exit should now be navigable
        assert.strictEqual(validator.canNavigateToExit(testRoom, i), true);
      }
    });

    it("should require orthogonal adjacency, not diagonal", () => {
      const exitX = room.exitX[0];
      const exitY = room.exitY[0];
      
      // Cross squares diagonally adjacent to the exit
      const diagonalSquares = [
        room.getSquare(exitX - 1, exitY - 1), // Northwest
        room.getSquare(exitX + 1, exitY - 1), // Northeast
        room.getSquare(exitX + 1, exitY + 1), // Southeast
        room.getSquare(exitX - 1, exitY + 1)  // Southwest
      ];
      
      diagonalSquares.forEach(square => {
        if (square) square.checked = true;
      });

      // Should not be navigable because diagonal adjacency doesn't count
      const canNavigate = validator.canNavigateToExit(room, 0);
      assert.strictEqual(canNavigate, false);
    });
  });

  describe("integration scenarios", () => {
    it("should handle complex room layouts with multiple crossed squares", () => {
      // Create a larger room for complex testing
      const complexRoom = new Room(10, 10);
      complexRoom.createExit("north");
      complexRoom.createExit("south");
      
      const northExitX = complexRoom.exitX[0];
      const northExitY = complexRoom.exitY[0];
      const southExitX = complexRoom.exitX[1];
      const southExitY = complexRoom.exitY[1];
      
      // Create a pattern of crossed squares
      for (let x = 2; x < 8; x++) {
        for (let y = 2; y < 8; y++) {
          const square = complexRoom.getSquare(x, y);
          if (square) {
            square.checked = (x + y) % 2 === 0; // Checkerboard pattern
          }
        }
      }
      
      // Cross specific squares adjacent to exits
      const northAdjacent = complexRoom.getSquare(northExitX, northExitY + 1);
      const southAdjacent = complexRoom.getSquare(southExitX, southExitY - 1);
      
      if (northAdjacent) northAdjacent.checked = true;
      if (southAdjacent) southAdjacent.checked = true;
      
      // Both exits should be navigable
      assert.strictEqual(validator.canNavigateToExit(complexRoom, 0), true);
      assert.strictEqual(validator.canNavigateToExit(complexRoom, 1), true);
    });

    it("should handle rooms with walls blocking potential adjacent squares", () => {
      const wallRoom = new Room(6, 6);
      wallRoom.createExit("east");
      
      const exitX = wallRoom.exitX[0];
      const exitY = wallRoom.exitY[0];
      
      // Set up walls around the exit area
      const potentialAdjacent = wallRoom.getSquare(exitX - 1, exitY);
      if (potentialAdjacent) {
        potentialAdjacent.wall = true;
        potentialAdjacent.checked = true; // Cross it, but it's a wall
      }
      
      // Should not be navigable because the adjacent square is a wall
      // (though in practice, walls shouldn't be crossable)
      const canNavigate = validator.canNavigateToExit(wallRoom, 0);
      
      // The validator should still find the crossed square regardless of wall status
      // The wall logic would be handled elsewhere in the game logic
      assert.strictEqual(canNavigate, true);
    });
  });
});