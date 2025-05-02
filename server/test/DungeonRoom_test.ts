import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";

// import your "app.config.ts" file here.
import appConfig from "../src/app.config";
import { DungeonState } from "../src/rooms/schema/DungeonState";
import { Room } from "../src/rooms/schema/Room";

describe("Dungeon Room", () => {
  let colyseus: ColyseusTestServer;

  before(async () => colyseus = await boot(appConfig));
  after(async () => colyseus.shutdown());

  beforeEach(async () => await colyseus.cleanup());

  it("should initialize with 10 rooms", async () => {
    // Create a room
    const room = await colyseus.createRoom<DungeonState>("dungeon", {});
    
    // Connect a client
    const client = await colyseus.connectTo(room);
    
    // Wait for state sync
    await room.waitForNextPatch();
    
    // Check that 10 rooms were created
    assert.strictEqual(room.state.rooms.length, 10);
    
    // Check that the current room index is 0
    assert.strictEqual(room.state.currentRoomIndex, 0);
    
    // Check that each room has a valid width and height
    for (let i = 0; i < room.state.rooms.length; i++) {
      const dungeonRoom = room.state.rooms[i];
      assert.ok(dungeonRoom.width >= 6 && dungeonRoom.width <= 10);
      assert.ok(dungeonRoom.height >= 6 && dungeonRoom.height <= 10);
      
      // Check that the room has the correct number of squares
      assert.strictEqual(dungeonRoom.squares.length, dungeonRoom.width * dungeonRoom.height);
    }
  });
  
  it("should allow crossing squares that are not walls", async () => {
    // Create a room
    const room = await colyseus.createRoom<DungeonState>("dungeon", {});
    
    // Connect a client
    const client = await colyseus.connectTo(room, { name: "TestPlayer" });
    
    // Wait for state sync
    await room.waitForNextPatch();
    
    // Get the current room
    const currentRoom = room.state.getCurrentRoom() as Room;
    assert.ok(currentRoom);
    
    // Find a non-wall square
    let nonWallX = -1;
    let nonWallY = -1;
    
    for (let y = 0; y < currentRoom.height; y++) {
      for (let x = 0; x < currentRoom.width; x++) {
        const square = currentRoom.getSquare(x, y);
        if (square && !square.wall) {
          nonWallX = x;
          nonWallY = y;
          break;
        }
      }
      if (nonWallX !== -1) break;
    }
    
    assert.notStrictEqual(nonWallX, -1, "Could not find a non-wall square");
    
    // Cross the square
    client.send("crossSquare", { x: nonWallX, y: nonWallY });
    
    // Wait for state sync
    await room.waitForNextPatch();
    
    // Check that the square is now crossed
    const square = currentRoom.getSquare(nonWallX, nonWallY);
    assert.strictEqual(square?.checked, true);
  });
  
  it("should not allow crossing squares that are walls", async () => {
    // Create a room
    const room = await colyseus.createRoom<DungeonState>("dungeon", {});
    
    // Connect a client
    const client = await colyseus.connectTo(room, { name: "TestPlayer" });
    
    // Wait for state sync
    await room.waitForNextPatch();
    
    // Get the current room
    const currentRoom = room.state.getCurrentRoom() as Room;
    assert.ok(currentRoom);
    
    // Find a wall square (border squares are always walls)
    const wallX = 0;
    const wallY = 0;
    
    // Verify it's a wall
    const wallSquare = currentRoom.getSquare(wallX, wallY);
    assert.strictEqual(wallSquare?.wall, true);
    
    // Try to cross the wall
    client.send("crossSquare", { x: wallX, y: wallY });
    
    // Wait for state sync
    await room.waitForNextPatch();
    
    // Check that the square is still not crossed
    const square = currentRoom.getSquare(wallX, wallY);
    assert.strictEqual(square?.checked, false);
  });
});
