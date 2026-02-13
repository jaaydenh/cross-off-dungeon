import assert from "assert";
import { describe, it } from "mocha";
import { DungeonState } from "../src/rooms/schema/DungeonState";
import { Card } from "../src/rooms/schema/Card";
import { MonsterFactory } from "../src/rooms/MonsterFactory";

const HEROIC_MOVE_AND_FIGHT_CARD_TYPE = "heroic_move_two_and_fight_two";
const TEST_SESSION_ID = "heroic_test_player";

const makeHeroicMoveAndFightCard = (id: string) =>
  new Card(
    id,
    HEROIC_MOVE_AND_FIGHT_CARD_TYPE,
    "Move 2 and fight 2",
    "room_or_monster",
    "squares",
    4,
    4,
    true,
    false,
    false,
    "counter"
  );

type Coord = { x: number; y: number };

const isOrthAdjacent = (a: Coord, b: Coord): boolean =>
  (Math.abs(a.x - b.x) === 1 && a.y === b.y) || (Math.abs(a.y - b.y) === 1 && a.x === b.x);

const findOrthAdjacentRoomPair = (room: any): [Coord, Coord] | null => {
  for (let y = 0; y < room.height; y++) {
    for (let x = 0; x < room.width; x++) {
      const base = room.getSquare(x, y);
      if (!base || base.wall || base.checked) continue;

      const candidates: Coord[] = [
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 }
      ];

      for (const candidate of candidates) {
        const next = room.getSquare(candidate.x, candidate.y);
        if (!next || next.wall || next.checked) continue;
        return [{ x, y }, candidate];
      }
    }
  }

  return null;
};

const findNonOrthRoomSquare = (room: any, origin: Coord): Coord | null => {
  for (let y = 0; y < room.height; y++) {
    for (let x = 0; x < room.width; x++) {
      const square = room.getSquare(x, y);
      if (!square || square.wall || square.checked) continue;

      const candidate = { x, y };
      if (candidate.x === origin.x && candidate.y === origin.y) continue;
      if (!isOrthAdjacent(origin, candidate)) {
        return candidate;
      }
    }
  }

  return null;
};

const createStateWithActiveHeroicCard = (): {
  state: DungeonState;
  player: any;
  activeCardId: string;
} => {
  const state = new DungeonState();
  state.initializeBoard();
  state.createPlayer(TEST_SESSION_ID, "HeroicPlayer");

  const player = state.players.get(TEST_SESSION_ID)!;
  player.deck.clear();
  player.drawnCards.clear();
  player.discardPile.clear();

  const activeCardId = "heroic_card";
  const card = makeHeroicMoveAndFightCard(activeCardId);
  card.isActive = true;
  player.drawnCards.push(card);
  state.activeCardPlayers.set(TEST_SESSION_ID, activeCardId);

  return { state, player, activeCardId };
};

describe("Heroic Move and Fight Card", () => {
  it("should allow selecting 2 room squares and 2 monster squares in one card action", () => {
    const { state, player } = createStateWithActiveHeroicCard();

    const ownedMonster = MonsterFactory.createGoblin("heroic_test_monster");
    ownedMonster.playerOwnerId = TEST_SESSION_ID;
    ownedMonster.connectedToRoomIndex = -1;
    state.activeMonsters.push(ownedMonster);

    const currentRoom = state.getCurrentRoom()!;
    const roomPair = findOrthAdjacentRoomPair(currentRoom);
    assert(roomPair, "Expected at least one orthogonally adjacent room pair");

    const firstRoomPick = state.crossSquare(
      { sessionId: TEST_SESSION_ID } as any,
      { roomIndex: 0, x: roomPair[0].x, y: roomPair[0].y }
    );
    assert.strictEqual(firstRoomPick.success, true);

    const secondRoomPick = state.crossSquare(
      { sessionId: TEST_SESSION_ID } as any,
      { roomIndex: 0, x: roomPair[1].x, y: roomPair[1].y }
    );
    assert.strictEqual(secondRoomPick.success, true);

    const firstMonsterPick = state.crossMonsterSquare(TEST_SESSION_ID, ownedMonster.id, 0, 0);
    assert.strictEqual(firstMonsterPick.success, true);

    const secondMonsterPick = state.crossMonsterSquare(TEST_SESSION_ID, ownedMonster.id, 1, 0);
    assert.strictEqual(secondMonsterPick.success, true);

    const confirmResult = state.confirmCardAction(TEST_SESSION_ID);
    assert.strictEqual(confirmResult.success, true);
    assert.strictEqual(confirmResult.completed, true);

    assert.strictEqual(currentRoom.getSquare(roomPair[0].x, roomPair[0].y)?.checked, true);
    assert.strictEqual(currentRoom.getSquare(roomPair[1].x, roomPair[1].y)?.checked, true);
    assert.strictEqual(ownedMonster.getSquare(0, 0)?.checked, true);
    assert.strictEqual(ownedMonster.getSquare(1, 0)?.checked, true);
    assert.strictEqual(player.drawnCards.length, 0);
    assert.strictEqual(player.discardPile.length, 1);
    assert.strictEqual(player.discardPile[0].type, HEROIC_MOVE_AND_FIGHT_CARD_TYPE);
  });

  it("should require at least 1 fight square when a monster is available", () => {
    const { state } = createStateWithActiveHeroicCard();

    const ownedMonster = MonsterFactory.createGoblin("heroic_test_monster");
    ownedMonster.playerOwnerId = TEST_SESSION_ID;
    ownedMonster.connectedToRoomIndex = -1;
    state.activeMonsters.push(ownedMonster);

    const currentRoom = state.getCurrentRoom()!;
    const roomPair = findOrthAdjacentRoomPair(currentRoom);
    assert(roomPair, "Expected at least one orthogonally adjacent room pair");

    state.crossSquare(
      { sessionId: TEST_SESSION_ID } as any,
      { roomIndex: 0, x: roomPair[0].x, y: roomPair[0].y }
    );
    state.crossSquare(
      { sessionId: TEST_SESSION_ID } as any,
      { roomIndex: 0, x: roomPair[1].x, y: roomPair[1].y }
    );

    const confirmResult = state.confirmCardAction(TEST_SESSION_ID);
    assert.strictEqual(confirmResult.success, false);
    assert(confirmResult.error?.includes("at least 1 monster square"));
  });

  it("should allow confirming move-only when there is no monster to fight", () => {
    const { state, player } = createStateWithActiveHeroicCard();

    const currentRoom = state.getCurrentRoom()!;
    const roomPair = findOrthAdjacentRoomPair(currentRoom);
    assert(roomPair, "Expected at least one orthogonally adjacent room pair");

    const firstRoomPick = state.crossSquare(
      { sessionId: TEST_SESSION_ID } as any,
      { roomIndex: 0, x: roomPair[0].x, y: roomPair[0].y }
    );
    assert.strictEqual(firstRoomPick.success, true);

    const secondRoomPick = state.crossSquare(
      { sessionId: TEST_SESSION_ID } as any,
      { roomIndex: 0, x: roomPair[1].x, y: roomPair[1].y }
    );
    assert.strictEqual(secondRoomPick.success, true);

    const confirmResult = state.confirmCardAction(TEST_SESSION_ID);
    assert.strictEqual(confirmResult.success, true);
    assert.strictEqual(confirmResult.completed, true);

    assert.strictEqual(currentRoom.getSquare(roomPair[0].x, roomPair[0].y)?.checked, true);
    assert.strictEqual(currentRoom.getSquare(roomPair[1].x, roomPair[1].y)?.checked, true);
    assert.strictEqual(player.drawnCards.length, 0);
    assert.strictEqual(player.discardPile.length, 1);
  });

  it("should allow confirming with only 1 fight square", () => {
    const { state, player } = createStateWithActiveHeroicCard();

    const ownedMonster = MonsterFactory.createGoblin("heroic_test_monster");
    ownedMonster.playerOwnerId = TEST_SESSION_ID;
    ownedMonster.connectedToRoomIndex = -1;
    state.activeMonsters.push(ownedMonster);

    const currentRoom = state.getCurrentRoom()!;
    const roomPair = findOrthAdjacentRoomPair(currentRoom);
    assert(roomPair, "Expected at least one orthogonally adjacent room pair");

    const firstRoomPick = state.crossSquare(
      { sessionId: TEST_SESSION_ID } as any,
      { roomIndex: 0, x: roomPair[0].x, y: roomPair[0].y }
    );
    assert.strictEqual(firstRoomPick.success, true);

    const secondRoomPick = state.crossSquare(
      { sessionId: TEST_SESSION_ID } as any,
      { roomIndex: 0, x: roomPair[1].x, y: roomPair[1].y }
    );
    assert.strictEqual(secondRoomPick.success, true);

    const firstMonsterPick = state.crossMonsterSquare(TEST_SESSION_ID, ownedMonster.id, 0, 0);
    assert.strictEqual(firstMonsterPick.success, true);

    const confirmResult = state.confirmCardAction(TEST_SESSION_ID);
    assert.strictEqual(confirmResult.success, true);
    assert.strictEqual(confirmResult.completed, true);

    assert.strictEqual(ownedMonster.getSquare(0, 0)?.checked, true);
    assert.strictEqual(player.drawnCards.length, 0);
    assert.strictEqual(player.discardPile.length, 1);
  });

  it("should enforce orthogonal adjacency for both move and fight selections", () => {
    const { state } = createStateWithActiveHeroicCard();

    const ownedMonster = MonsterFactory.createGoblin("heroic_test_monster");
    ownedMonster.playerOwnerId = TEST_SESSION_ID;
    ownedMonster.connectedToRoomIndex = -1;
    state.activeMonsters.push(ownedMonster);

    const currentRoom = state.getCurrentRoom()!;
    const roomPair = findOrthAdjacentRoomPair(currentRoom);
    assert(roomPair, "Expected at least one orthogonally adjacent room pair");

    const firstRoomPick = state.crossSquare(
      { sessionId: TEST_SESSION_ID } as any,
      { roomIndex: 0, x: roomPair[0].x, y: roomPair[0].y }
    );
    assert.strictEqual(firstRoomPick.success, true);

    const nonAdjacentRoomSquare = findNonOrthRoomSquare(currentRoom, roomPair[0]);
    assert(nonAdjacentRoomSquare, "Expected a non-orthogonally adjacent room square");

    const invalidRoomPick = state.crossSquare(
      { sessionId: TEST_SESSION_ID } as any,
      { roomIndex: 0, x: nonAdjacentRoomSquare.x, y: nonAdjacentRoomSquare.y }
    );
    assert.strictEqual(invalidRoomPick.success, false);
    assert.strictEqual(invalidRoomPick.invalidSquare, true);
    assert(invalidRoomPick.error?.includes("orthogonally connected"));

    const firstMonsterPick = state.crossMonsterSquare(TEST_SESSION_ID, ownedMonster.id, 0, 0);
    assert.strictEqual(firstMonsterPick.success, true);

    const diagonalMonsterPick = state.crossMonsterSquare(TEST_SESSION_ID, ownedMonster.id, 1, 1);
    assert.strictEqual(diagonalMonsterPick.success, false);
    assert.strictEqual(diagonalMonsterPick.invalidSquare, true);
    assert(diagonalMonsterPick.error?.includes("orthogonally connected"));
  });
});
