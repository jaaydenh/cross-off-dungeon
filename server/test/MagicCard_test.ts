import assert from "assert";
import { describe, it } from "mocha";
import { DungeonState } from "../src/rooms/schema/DungeonState";
import { Card } from "../src/rooms/schema/Card";
import { MonsterCard } from "../src/rooms/schema/MonsterCard";

const MAGIC_CARD_TYPE = "magic";
const TEST_SESSION_ID = "magic_test_player";

const makeMagicCard = (id: string) =>
  new Card(
    id,
    MAGIC_CARD_TYPE,
    "On a single room or monster card, cross off up to 3 squares that are not orthogonally adjacent.",
    "room_or_monster",
    "squares",
    1,
    3,
    false,
    false,
    false,
    "counter",
    0,
    "blue",
    "Magic"
  );

const createStateWithActiveMagicCard = (): {
  state: DungeonState;
  player: any;
  activeCardId: string;
} => {
  const state = new DungeonState();
  state.initializeBoard();
  state.createPlayer(TEST_SESSION_ID, "MagicPlayer");

  const player = state.players.get(TEST_SESSION_ID)!;
  player.deck.clear();
  player.drawnCards.clear();
  player.discardPile.clear();

  const activeCardId = "magic_card";
  const card = makeMagicCard(activeCardId);
  card.isActive = true;
  player.drawnCards.push(card);
  state.activeCardPlayers.set(TEST_SESSION_ID, activeCardId);

  return { state, player, activeCardId };
};

const resetRoomSquares = (room: any): void => {
  for (const square of room.squares) {
    square.wall = false;
    square.checked = false;
  }
};

const createOwnedMonster = (ownerId: string): MonsterCard => {
  const monster = new MonsterCard("magic_test_monster", "Magic Test Monster", 4, 4, 1);
  for (let y = 0; y < monster.height; y++) {
    for (let x = 0; x < monster.width; x++) {
      monster.setSquareFilled(x, y, true);
      const square = monster.getSquare(x, y);
      if (square) {
        square.checked = false;
      }
    }
  }

  monster.playerOwnerId = ownerId;
  monster.connectedToRoomIndex = -1;
  return monster;
};

describe("Magic Card", () => {
  it("should allow selecting up to 3 non-adjacent room squares and resolve on confirm", () => {
    const { state, player } = createStateWithActiveMagicCard();
    const room = state.getCurrentRoom()!;
    resetRoomSquares(room);
    const selectOne = state.crossSquare(
      { sessionId: TEST_SESSION_ID } as any,
      { roomIndex: 0, x: 0, y: 0 }
    );
    assert.strictEqual(selectOne.success, true);
    assert.strictEqual(selectOne.completed, false);

    const selectTwo = state.crossSquare(
      { sessionId: TEST_SESSION_ID } as any,
      { roomIndex: 0, x: 2, y: 0 }
    );
    assert.strictEqual(selectTwo.success, true);
    assert.strictEqual(selectTwo.completed, false);

    const selectThree = state.crossSquare(
      { sessionId: TEST_SESSION_ID } as any,
      { roomIndex: 0, x: 0, y: 2 }
    );
    assert.strictEqual(selectThree.success, true);
    assert.strictEqual(selectThree.completed, false);

    assert.strictEqual(room.getSquare(0, 0)?.checked, false);
    assert.strictEqual(room.getSquare(2, 0)?.checked, false);
    assert.strictEqual(room.getSquare(0, 2)?.checked, false);

    const confirmResult = state.confirmCardAction(TEST_SESSION_ID);
    assert.strictEqual(confirmResult.success, true);
    assert.strictEqual(confirmResult.completed, true);

    assert.strictEqual(room.getSquare(0, 0)?.checked, true);
    assert.strictEqual(room.getSquare(2, 0)?.checked, true);
    assert.strictEqual(room.getSquare(0, 2)?.checked, true);

    assert.strictEqual(player.drawnCards.length, 0);
    assert.strictEqual(player.discardPile.length, 1);
    assert.strictEqual(player.discardPile[0].type, MAGIC_CARD_TYPE);
  });

  it("should reject orthogonally adjacent room square selections", () => {
    const { state } = createStateWithActiveMagicCard();
    const room = state.getCurrentRoom()!;
    resetRoomSquares(room);

    const first = state.crossSquare(
      { sessionId: TEST_SESSION_ID } as any,
      { roomIndex: 0, x: 0, y: 0 }
    );
    assert.strictEqual(first.success, true);

    const adjacent = state.crossSquare(
      { sessionId: TEST_SESSION_ID } as any,
      { roomIndex: 0, x: 1, y: 0 }
    );
    assert.strictEqual(adjacent.success, false);
    assert.strictEqual(adjacent.invalidSquare, true);
    assert(adjacent.error?.includes("not be orthogonally adjacent"));
  });

  it("should allow selecting non-adjacent monster squares on a single monster and resolve on confirm", () => {
    const { state, player } = createStateWithActiveMagicCard();
    const monster = createOwnedMonster(TEST_SESSION_ID);
    state.activeMonsters.push(monster);

    const one = state.crossMonsterSquare(TEST_SESSION_ID, monster.id, 0, 0);
    assert.strictEqual(one.success, true);

    const two = state.crossMonsterSquare(TEST_SESSION_ID, monster.id, 2, 0);
    assert.strictEqual(two.success, true);

    const three = state.crossMonsterSquare(TEST_SESSION_ID, monster.id, 0, 2);
    assert.strictEqual(three.success, true);

    assert.strictEqual(monster.getSquare(0, 0)?.checked, false);
    assert.strictEqual(monster.getSquare(2, 0)?.checked, false);
    assert.strictEqual(monster.getSquare(0, 2)?.checked, false);

    const confirm = state.confirmCardAction(TEST_SESSION_ID);
    assert.strictEqual(confirm.success, true);
    assert.strictEqual(confirm.completed, true);

    assert.strictEqual(monster.getSquare(0, 0)?.checked, true);
    assert.strictEqual(monster.getSquare(2, 0)?.checked, true);
    assert.strictEqual(monster.getSquare(0, 2)?.checked, true);
    assert.strictEqual(player.drawnCards.length, 0);
    assert.strictEqual(player.discardPile.length, 1);
  });

  it("should reject orthogonally adjacent monster square selections", () => {
    const { state } = createStateWithActiveMagicCard();
    const monster = createOwnedMonster(TEST_SESSION_ID);
    state.activeMonsters.push(monster);

    const first = state.crossMonsterSquare(TEST_SESSION_ID, monster.id, 0, 0);
    assert.strictEqual(first.success, true);

    const adjacent = state.crossMonsterSquare(TEST_SESSION_ID, monster.id, 1, 0);
    assert.strictEqual(adjacent.success, false);
    assert.strictEqual(adjacent.invalidSquare, true);
    assert(adjacent.error?.includes("not be orthogonally adjacent"));
  });

  it("should allow confirming Magic after selecting a single square", () => {
    const { state, player } = createStateWithActiveMagicCard();
    const room = state.getCurrentRoom()!;
    resetRoomSquares(room);

    const selectOne = state.crossSquare(
      { sessionId: TEST_SESSION_ID } as any,
      { roomIndex: 0, x: 0, y: 0 }
    );
    assert.strictEqual(selectOne.success, true);

    const confirmResult = state.confirmCardAction(TEST_SESSION_ID);
    assert.strictEqual(confirmResult.success, true);
    assert.strictEqual(confirmResult.completed, true);
    assert.strictEqual(room.getSquare(0, 0)?.checked, true);
    assert.strictEqual(player.drawnCards.length, 0);
    assert.strictEqual(player.discardPile.length, 1);
  });
});
