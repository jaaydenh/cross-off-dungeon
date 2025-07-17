import assert from "assert";
import { GridManager } from "../src/rooms/GridManager";
import { Room } from "../src/rooms/schema/Room";

describe("GridManager", () => {
  let gridManager: GridManager;

  beforeEach(() => {
    gridManager = new GridManager();
  });

  describe("getRoomAt and setRoomAt", () => {
    it("should return null for empty coordinates", () => {
      assert.strictEqual(gridManager.getRoomAt(0, 0), null);
      assert.strictEqual(gridManager.getRoomAt(5, 10), null);
      assert.strictEqual(gridManager.getRoomAt(-1, -1), null);
    });

    it("should set and get room at coordinates", () => {
      gridManager.setRoomAt(0, 0, 1);
      assert.strictEqual(gridManager.getRoomAt(0, 0), 1);

      gridManager.setRoomAt(5, 10, 42);
      assert.strictEqual(gridManager.getRoomAt(5, 10), 42);
    });

    it("should handle negative coordinates", () => {
      gridManager.setRoomAt(-5, -3, 99);
      assert.strictEqual(gridManager.getRoomAt(-5, -3), 99);
    });

    it("should overwrite existing room at same coordinates", () => {
      gridManager.setRoomAt(1, 1, 10);
      gridManager.setRoomAt(1, 1, 20);
      assert.strictEqual(gridManager.getRoomAt(1, 1), 20);
    });
  });

  describe("getAdjacentRoom", () => {
    beforeEach(() => {
      // Set up a cross pattern of rooms
      //     [1]
      // [2] [0] [3]
      //     [4]
      gridManager.setRoomAt(0, 0, 0); // Center
      gridManager.setRoomAt(0, -1, 1); // North (negative Y is up)
      gridManager.setRoomAt(-1, 0, 2); // West
      gridManager.setRoomAt(1, 0, 3); // East
      gridManager.setRoomAt(0, 1, 4); // South (positive Y is down)
    });

    it("should get adjacent room to the north", () => {
      assert.strictEqual(gridManager.getAdjacentRoom(0, 0, "north"), 1);
    });

    it("should get adjacent room to the south", () => {
      assert.strictEqual(gridManager.getAdjacentRoom(0, 0, "south"), 4);
    });

    it("should get adjacent room to the east", () => {
      assert.strictEqual(gridManager.getAdjacentRoom(0, 0, "east"), 3);
    });

    it("should get adjacent room to the west", () => {
      assert.strictEqual(gridManager.getAdjacentRoom(0, 0, "west"), 2);
    });

    it("should return null for non-existent adjacent room", () => {
      assert.strictEqual(gridManager.getAdjacentRoom(10, 10, "north"), null);
      assert.strictEqual(gridManager.getAdjacentRoom(0, 0, "north"), 1); // exists
      assert.strictEqual(gridManager.getAdjacentRoom(0, -1, "north"), null); // doesn't exist (north of north room)
    });

    it("should handle invalid directions", () => {
      assert.strictEqual(gridManager.getAdjacentRoom(0, 0, "invalid"), null);
      assert.strictEqual(gridManager.getAdjacentRoom(0, 0, ""), null);
      assert.strictEqual(gridManager.getAdjacentRoom(0, 0, "northeast"), null);
    });

    it("should be case insensitive for directions", () => {
      assert.strictEqual(gridManager.getAdjacentRoom(0, 0, "NORTH"), 1);
      assert.strictEqual(gridManager.getAdjacentRoom(0, 0, "North"), 1);
      assert.strictEqual(gridManager.getAdjacentRoom(0, 0, "nOrTh"), 1);
    });
  });

  describe("validateConnection", () => {
    let room1: Room;
    let room2: Room;

    beforeEach(() => {
      room1 = new Room(8, 8);
      room2 = new Room(8, 8);
    });

    it("should validate connection when room1 has exit north and room2 has entrance south", () => {
      // Set up room1 with north exit
      room1.exitDirections.push("north");
      room1.exitX.push(4);
      room1.exitY.push(0);

      // Set up room2 with south entrance
      room2.entranceDirection = "south";
      room2.entranceX = 4;
      room2.entranceY = 7;

      assert.strictEqual(gridManager.validateConnection(room1, room2, "north"), true);
    });

    it("should validate connection when room1 has exit east and room2 has entrance west", () => {
      // Set up room1 with east exit
      room1.exitDirections.push("east");
      room1.exitX.push(7);
      room1.exitY.push(4);

      // Set up room2 with west entrance
      room2.entranceDirection = "west";
      room2.entranceX = 0;
      room2.entranceY = 4;

      assert.strictEqual(gridManager.validateConnection(room1, room2, "east"), true);
    });

    it("should validate connection when room1 has exit south and room2 has entrance north", () => {
      // Set up room1 with south exit
      room1.exitDirections.push("south");
      room1.exitX.push(4);
      room1.exitY.push(7);

      // Set up room2 with north entrance
      room2.entranceDirection = "north";
      room2.entranceX = 4;
      room2.entranceY = 0;

      assert.strictEqual(gridManager.validateConnection(room1, room2, "south"), true);
    });

    it("should validate connection when room1 has exit west and room2 has entrance east", () => {
      // Set up room1 with west exit
      room1.exitDirections.push("west");
      room1.exitX.push(0);
      room1.exitY.push(4);

      // Set up room2 with east entrance
      room2.entranceDirection = "east";
      room2.entranceX = 7;
      room2.entranceY = 4;

      assert.strictEqual(gridManager.validateConnection(room1, room2, "west"), true);
    });

    it("should reject connection when room1 has no exit in specified direction", () => {
      // Room1 has no exits
      // Room2 has correct entrance
      room2.entranceDirection = "south";

      assert.strictEqual(gridManager.validateConnection(room1, room2, "north"), false);
    });

    it("should reject connection when room2 has wrong entrance direction", () => {
      // Room1 has north exit
      room1.exitDirections.push("north");
      room1.exitX.push(4);
      room1.exitY.push(0);

      // Room2 has wrong entrance direction (should be south for north exit)
      room2.entranceDirection = "north";

      assert.strictEqual(gridManager.validateConnection(room1, room2, "north"), false);
    });

    it("should reject connection when room2 has no entrance", () => {
      // Room1 has north exit
      room1.exitDirections.push("north");
      room1.exitX.push(4);
      room1.exitY.push(0);

      // Room2 has no entrance (default is "none")
      room2.entranceDirection = "none";

      assert.strictEqual(gridManager.validateConnection(room1, room2, "north"), false);
    });

    it("should handle multiple exits in room1", () => {
      // Room1 has multiple exits including north
      room1.exitDirections.push("north");
      room1.exitX.push(4);
      room1.exitY.push(0);
      room1.exitDirections.push("east");
      room1.exitX.push(7);
      room1.exitY.push(4);

      // Room2 has south entrance
      room2.entranceDirection = "south";

      assert.strictEqual(gridManager.validateConnection(room1, room2, "north"), true);
      assert.strictEqual(gridManager.validateConnection(room1, room2, "east"), false); // room2 doesn't have west entrance
    });
  });

  describe("utility methods", () => {
    beforeEach(() => {
      gridManager.setRoomAt(0, 0, 1);
      gridManager.setRoomAt(1, 1, 2);
      gridManager.setRoomAt(-1, -1, 3);
    });

    describe("getAllRoomPositions", () => {
      it("should return all room positions", () => {
        const positions = gridManager.getAllRoomPositions();
        assert.strictEqual(positions.length, 3);

        // Sort by roomIndex for consistent testing
        positions.sort((a, b) => a.roomIndex - b.roomIndex);

        assert.deepStrictEqual(positions[0], { x: 0, y: 0, roomIndex: 1 });
        assert.deepStrictEqual(positions[1], { x: 1, y: 1, roomIndex: 2 });
        assert.deepStrictEqual(positions[2], { x: -1, y: -1, roomIndex: 3 });
      });

      it("should return empty array for empty grid", () => {
        const emptyGrid = new GridManager();
        assert.deepStrictEqual(emptyGrid.getAllRoomPositions(), []);
      });
    });

    describe("removeRoomAt", () => {
      it("should remove existing room", () => {
        assert.strictEqual(gridManager.removeRoomAt(0, 0), true);
        assert.strictEqual(gridManager.getRoomAt(0, 0), null);
      });

      it("should return false for non-existent room", () => {
        assert.strictEqual(gridManager.removeRoomAt(10, 10), false);
      });

      it("should not affect other rooms", () => {
        gridManager.removeRoomAt(0, 0);
        assert.strictEqual(gridManager.getRoomAt(1, 1), 2);
        assert.strictEqual(gridManager.getRoomAt(-1, -1), 3);
      });
    });

    describe("getRoomCount", () => {
      it("should return correct count", () => {
        assert.strictEqual(gridManager.getRoomCount(), 3);
      });

      it("should return 0 for empty grid", () => {
        const emptyGrid = new GridManager();
        assert.strictEqual(emptyGrid.getRoomCount(), 0);
      });

      it("should update count after adding/removing rooms", () => {
        gridManager.setRoomAt(5, 5, 4);
        assert.strictEqual(gridManager.getRoomCount(), 4);

        gridManager.removeRoomAt(0, 0);
        assert.strictEqual(gridManager.getRoomCount(), 3);
      });
    });

    describe("isEmpty", () => {
      it("should return false for non-empty grid", () => {
        assert.strictEqual(gridManager.isEmpty(), false);
      });

      it("should return true for empty grid", () => {
        const emptyGrid = new GridManager();
        assert.strictEqual(emptyGrid.isEmpty(), true);
      });

      it("should return true after clearing grid", () => {
        gridManager.clear();
        assert.strictEqual(gridManager.isEmpty(), true);
      });
    });

    describe("clear", () => {
      it("should remove all rooms", () => {
        gridManager.clear();
        assert.strictEqual(gridManager.getRoomCount(), 0);
        assert.strictEqual(gridManager.getRoomAt(0, 0), null);
        assert.strictEqual(gridManager.getRoomAt(1, 1), null);
        assert.strictEqual(gridManager.getRoomAt(-1, -1), null);
      });
    });
  });

  describe("edge cases", () => {
    it("should handle very large coordinates", () => {
      const largeX = 1000000;
      const largeY = -1000000;
      gridManager.setRoomAt(largeX, largeY, 999);
      assert.strictEqual(gridManager.getRoomAt(largeX, largeY), 999);
    });

    it("should handle zero coordinates distinctly from positive coordinates", () => {
      gridManager.setRoomAt(0, 0, 1);
      gridManager.setRoomAt(0, 1, 2);
      gridManager.setRoomAt(1, 0, 3);

      assert.strictEqual(gridManager.getRoomAt(0, 0), 1);
      assert.strictEqual(gridManager.getRoomAt(0, 1), 2);
      assert.strictEqual(gridManager.getRoomAt(1, 0), 3);
    });

    it("should handle room index 0", () => {
      gridManager.setRoomAt(5, 5, 0);
      assert.strictEqual(gridManager.getRoomAt(5, 5), 0);
    });
  });
});