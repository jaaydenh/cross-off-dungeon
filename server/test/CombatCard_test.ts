import assert from "assert";
import { describe, it } from "mocha";
import { DungeonState } from "../src/rooms/schema/DungeonState";
import { Card } from "../src/rooms/schema/Card";
import { MonsterFactory } from "../src/rooms/MonsterFactory";

const COMBAT_CARD_TYPE = "combat_fight_three_diagonal_or_move_three";
const TEST_SESSION_ID = "combat_test_player";

const makeCombatCard = (id: string) =>
  new Card(
    id,
    COMBAT_CARD_TYPE,
    "Fight 3 diagonal or move 3",
    "room_or_monster",
    "squares",
    3,
    3,
    true,
    false,
    false,
    "empty",
    0,
    "red"
  );

type Coord = { x: number; y: number };

const createStateWithActiveCombatCard = (): {
  state: DungeonState;
  player: any;
  activeCardId: string;
} => {
  const state = new DungeonState();
  state.initializeBoard();
  state.createPlayer(TEST_SESSION_ID, "CombatPlayer");

  const player = state.players.get(TEST_SESSION_ID)!;
  player.deck.clear();
  player.drawnCards.clear();
  player.discardPile.clear();

  const activeCardId = "combat_card";
  const card = makeCombatCard(activeCardId);
  card.isActive = true;
  player.drawnCards.push(card);
  state.activeCardPlayers.set(TEST_SESSION_ID, activeCardId);

  return { state, player, activeCardId };
};

const findOrthPathInRoom = (room: any, length: number): Coord[] | null => {
  const isOrthAdjacent = (a: Coord, b: Coord): boolean =>
    (Math.abs(a.x - b.x) === 1 && a.y === b.y) || (Math.abs(a.y - b.y) === 1 && a.x === b.x);

  const validSquares: Coord[] = [];
  for (let y = 0; y < room.height; y++) {
    for (let x = 0; x < room.width; x++) {
      const square = room.getSquare(x, y);
      if (square && !square.wall && !square.checked) {
        validSquares.push({ x, y });
      }
    }
  }

  const dfs = (path: Coord[]): Coord[] | null => {
    if (path.length >= length) return path;
    const last = path[path.length - 1];

    for (const candidate of validSquares) {
      if (path.some((p) => p.x === candidate.x && p.y === candidate.y)) continue;
      if (!isOrthAdjacent(last, candidate)) continue;

      const result = dfs([...path, candidate]);
      if (result) return result;
    }
    return null;
  };

  for (const start of validSquares) {
    const result = dfs([start]);
    if (result) return result;
  }

  return null;
};

describe("Combat Card", () => {
  it("should allow moving 3 orthogonally connected squares in a room", () => {
    const { state, player } = createStateWithActiveCombatCard();
    const room = state.getCurrentRoom()!;
    const movePath = findOrthPathInRoom(room, 3);
    assert(movePath, "Expected a 3-square orthogonal path in the room");

    for (const square of movePath) {
      const result = state.crossSquare(
        { sessionId: TEST_SESSION_ID } as any,
        { roomIndex: 0, x: square.x, y: square.y }
      );
      assert.strictEqual(result.success, true);
    }

    const confirmResult = state.confirmCardAction(TEST_SESSION_ID);
    assert.strictEqual(confirmResult.success, true);
    assert.strictEqual(confirmResult.completed, true);

    for (const square of movePath) {
      assert.strictEqual(room.getSquare(square.x, square.y)?.checked, true);
    }
    assert.strictEqual(player.drawnCards.length, 0);
    assert.strictEqual(player.discardPile.length, 1);
    assert.strictEqual(player.discardPile[0].type, COMBAT_CARD_TYPE);
    assert.strictEqual(player.discardPile[0].color, "red");
  });

  it("should allow fighting 3 diagonally connected monster squares", () => {
    const { state } = createStateWithActiveCombatCard();

    const ownedMonster = MonsterFactory.createGoblin("combat_test_monster");
    ownedMonster.playerOwnerId = TEST_SESSION_ID;
    ownedMonster.connectedToRoomIndex = -1;
    state.activeMonsters.push(ownedMonster);

    const diagonalPath: Coord[] = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 0 }
    ];

    for (const square of diagonalPath) {
      const result = state.crossMonsterSquare(TEST_SESSION_ID, ownedMonster.id, square.x, square.y);
      assert.strictEqual(result.success, true);
    }

    const confirmResult = state.confirmCardAction(TEST_SESSION_ID);
    assert.strictEqual(confirmResult.success, true);
    assert.strictEqual(confirmResult.completed, true);

    for (const square of diagonalPath) {
      assert.strictEqual(ownedMonster.getSquare(square.x, square.y)?.checked, true);
    }
  });

  it("should reject orthogonally connected monster selections for Combat", () => {
    const { state } = createStateWithActiveCombatCard();

    const ownedMonster = MonsterFactory.createGoblin("combat_test_monster");
    ownedMonster.playerOwnerId = TEST_SESSION_ID;
    ownedMonster.connectedToRoomIndex = -1;
    state.activeMonsters.push(ownedMonster);

    const firstPick = state.crossMonsterSquare(TEST_SESSION_ID, ownedMonster.id, 0, 0);
    assert.strictEqual(firstPick.success, true);

    const invalidOrthogonalPick = state.crossMonsterSquare(TEST_SESSION_ID, ownedMonster.id, 1, 0);
    assert.strictEqual(invalidOrthogonalPick.success, false);
    assert.strictEqual(invalidOrthogonalPick.invalidSquare, true);
    assert(invalidOrthogonalPick.error?.includes("diagonally connected"));
  });

  it("should not allow mixing move and fight selections for Combat", () => {
    const { state } = createStateWithActiveCombatCard();

    const ownedMonster = MonsterFactory.createGoblin("combat_test_monster");
    ownedMonster.playerOwnerId = TEST_SESSION_ID;
    ownedMonster.connectedToRoomIndex = -1;
    state.activeMonsters.push(ownedMonster);

    const room = state.getCurrentRoom()!;
    const movePath = findOrthPathInRoom(room, 1);
    assert(movePath, "Expected at least one room square");

    const roomPick = state.crossSquare(
      { sessionId: TEST_SESSION_ID } as any,
      { roomIndex: 0, x: movePath[0].x, y: movePath[0].y }
    );
    assert.strictEqual(roomPick.success, true);

    const monsterPick = state.crossMonsterSquare(TEST_SESSION_ID, ownedMonster.id, 0, 0);
    assert.strictEqual(monsterPick.success, false);
    assert.strictEqual(monsterPick.invalidSquare, true);
    assert(monsterPick.error?.includes("Cannot mix monster and room selections"));
  });
});
