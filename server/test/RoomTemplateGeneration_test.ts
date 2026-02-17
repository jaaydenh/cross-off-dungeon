import assert from "assert";
import { DungeonState } from "../src/rooms/schema/DungeonState";
import { ROOM_SHAPE_TEMPLATES } from "../src/rooms/data/roomShapeTemplates";

describe("Room Template Generation", () => {
  const originalRoomGenerationMode = process.env.ROOM_GENERATION_MODE;
  const originalRandom = Math.random;

  afterEach(() => {
    process.env.ROOM_GENERATION_MODE = originalRoomGenerationMode;
    Math.random = originalRandom;
  });

  it("should generate room dimensions and walls from template data when mode is template", () => {
    process.env.ROOM_GENERATION_MODE = "template";
    Math.random = () => 0; // deterministically pick the first template

    const state = new DungeonState();
    const room = state.createNewRoom();
    const template = ROOM_SHAPE_TEMPLATES[0];

    assert.strictEqual(room.width, template.width);
    assert.strictEqual(room.height, template.height);

    for (let y = 0; y < template.height; y++) {
      for (let x = 0; x < template.width; x++) {
        const expectedWall = template.rows[y][x] === "#";
        assert.strictEqual(room.getSquare(x, y)?.wall, expectedWall, `Mismatch at ${x},${y}`);
      }
    }
  });

  it("should keep template walls while still preparing entrance and exits", () => {
    process.env.ROOM_GENERATION_MODE = "template";
    Math.random = () => 0; // deterministic template selection

    const state = new DungeonState();
    const room = state.createNewRoom("north");

    assert.strictEqual(room.entranceDirection, "north");
    assert.ok(room.entranceX >= 0 && room.entranceX < room.width);
    assert.ok(room.entranceY >= 0 && room.entranceY < room.height);
    assert.strictEqual(room.getSquare(room.entranceX, room.entranceY)?.wall, false);
    assert.strictEqual(room.getSquare(room.entranceX, room.entranceY)?.entrance, true);
    assert.strictEqual(room.getSquare(room.entranceX, room.entranceY)?.checked, true);

    for (let i = 0; i < room.exitX.length; i++) {
      const exitX = room.exitX[i];
      const exitY = room.exitY[i];
      assert.strictEqual(room.getSquare(exitX, exitY)?.wall, false, `Exit ${i} should never be a wall`);
      assert.strictEqual(room.getSquare(exitX, exitY)?.exit, true, `Exit ${i} should be marked as exit`);
    }
  });

  it("should generate random room dimensions in hybrid mode when random branch is selected", () => {
    process.env.ROOM_GENERATION_MODE = "hybrid";
    const randomSequence = [0.9, 0, 0, 0]; // hybrid pick random branch, then width=6, height=4, 0 random walls
    let randomIndex = 0;
    Math.random = () => {
      const value = randomSequence[randomIndex] ?? 0;
      randomIndex++;
      return value;
    };

    const state = new DungeonState();
    const room = state.createNewRoom();

    assert.strictEqual(room.width, 6);
    assert.strictEqual(room.height, 4);
    assert.strictEqual(room.squares.length, 24);
  });
});
