import assert from "assert";
import { describe, it } from "mocha";
import { DungeonState } from "../src/rooms/schema/DungeonState";
import { Card } from "../src/rooms/schema/Card";
import { MonsterFactory } from "../src/rooms/MonsterFactory";

const SWIPE_CARD_TYPE = "swipe_fight_l_overlay";
const TEST_SESSION_ID = "swipe_test_player";

const makeSwipeCard = (id: string) =>
  new Card(
    id,
    SWIPE_CARD_TYPE,
    "Fight",
    "monster",
    "monster_swipe_l",
    1,
    1,
    false,
    false,
    false,
    "empty",
    0,
    "red",
    "Swipe"
  );

const createStateWithActiveSwipeCard = (): {
  state: DungeonState;
  player: any;
  activeCardId: string;
} => {
  const state = new DungeonState();
  state.initializeBoard();
  state.createPlayer(TEST_SESSION_ID, "SwipePlayer");

  const player = state.players.get(TEST_SESSION_ID)!;
  player.deck.clear();
  player.drawnCards.clear();
  player.discardPile.clear();

  const activeCardId = "swipe_card";
  const card = makeSwipeCard(activeCardId);
  card.isActive = true;
  player.drawnCards.push(card);
  state.activeCardPlayers.set(TEST_SESSION_ID, activeCardId);

  return { state, player, activeCardId };
};

describe("Swipe Card", () => {
  it("should require the 3 dark red squares to be valid", () => {
    const { state } = createStateWithActiveSwipeCard();

    const ownedMonster = MonsterFactory.createGoblin("swipe_test_monster");
    ownedMonster.playerOwnerId = TEST_SESSION_ID;
    ownedMonster.connectedToRoomIndex = -1;
    state.activeMonsters.push(ownedMonster);

    // For goblin, (0,2) required by this anchor is empty, so this is invalid.
    const result = state.crossMonsterSquare(TEST_SESSION_ID, ownedMonster.id, 0, 1);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.invalidSquare, true);
    assert(result.error?.includes("requires all 3 dark red squares"));
  });

  it("should cross all required squares and any valid optional squares", () => {
    const { state, player } = createStateWithActiveSwipeCard();

    const ownedMonster = MonsterFactory.createGoblin("swipe_test_monster");
    ownedMonster.playerOwnerId = TEST_SESSION_ID;
    ownedMonster.connectedToRoomIndex = -1;
    state.activeMonsters.push(ownedMonster);

    // Anchor at (0,0):
    // required: (0,0) (1,0) (0,1) => all valid
    // optional: (2,0) valid, (0,2) empty
    const result = state.crossMonsterSquare(TEST_SESSION_ID, ownedMonster.id, 0, 0);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.completed, true);
    assert(result.message?.includes("Swipe crossed 4"));

    assert.strictEqual(ownedMonster.getSquare(0, 0)?.checked, true);
    assert.strictEqual(ownedMonster.getSquare(1, 0)?.checked, true);
    assert.strictEqual(ownedMonster.getSquare(0, 1)?.checked, true);
    assert.strictEqual(ownedMonster.getSquare(2, 0)?.checked, true);
    // Optional square that is empty should remain untouched.
    assert.strictEqual(ownedMonster.getSquare(0, 2)?.filled, false);
    assert.strictEqual(ownedMonster.getSquare(0, 2)?.checked, false);

    assert.strictEqual(player.drawnCards.length, 0);
    assert.strictEqual(player.discardPile.length, 1);
    assert.strictEqual(player.discardPile[0].type, SWIPE_CARD_TYPE);
  });

  it("should fail when a required square is already crossed", () => {
    const { state, player } = createStateWithActiveSwipeCard();

    const ownedMonster = MonsterFactory.createGoblin("swipe_test_monster");
    ownedMonster.playerOwnerId = TEST_SESSION_ID;
    ownedMonster.connectedToRoomIndex = -1;
    state.activeMonsters.push(ownedMonster);

    ownedMonster.getSquare(1, 0)!.checked = true;

    const result = state.crossMonsterSquare(TEST_SESSION_ID, ownedMonster.id, 0, 0);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.invalidSquare, true);
    assert(result.error?.includes("requires all 3 dark red squares"));

    // Card remains active when action fails.
    assert.strictEqual(player.drawnCards.length, 1);
    assert.strictEqual(player.discardPile.length, 0);
    assert.strictEqual(player.drawnCards[0].isActive, true);
  });
});
