import assert from "assert";
import { describe, it } from "mocha";
import { DungeonState } from "../src/rooms/schema/DungeonState";
import { Card } from "../src/rooms/schema/Card";
import { MonsterFactory } from "../src/rooms/MonsterFactory";

const CUNNING_CARD_TYPE = "cunning";
const TEST_SESSION_ID = "cunning_test_player";

const makeCunningCard = (id: string) =>
  new Card(
    id,
    CUNNING_CARD_TYPE,
    "Cross 1 square, then 2 horizontal squares, then 3 horizontal squares. Each step must target a different room or monster.",
    "room_or_monster",
    "cunning_three_step_different_cards",
    6,
    6,
    false,
    false,
    false,
    "empty",
    0,
    "green",
    "Cunning"
  );

const createStateWithActiveCunningCard = (): {
  state: DungeonState;
  player: any;
} => {
  const state = new DungeonState();
  state.initializeBoard();
  state.createPlayer(TEST_SESSION_ID, "CunningPlayer");

  const player = state.players.get(TEST_SESSION_ID)!;
  player.deck.clear();
  player.drawnCards.clear();
  player.discardPile.clear();

  const card = makeCunningCard("cunning_card");
  card.isActive = true;
  player.drawnCards.push(card);
  state.activeCardPlayers.set(TEST_SESSION_ID, card.id);

  const room = state.getCurrentRoom()!;
  for (let y = 0; y < room.height; y++) {
    for (let x = 0; x < room.width; x++) {
      const square = room.getSquare(x, y);
      if (!square) continue;
      square.wall = false;
      square.checked = false;
    }
  }

  return { state, player };
};

describe("Cunning Card", () => {
  it("should complete after the first step when only one target card is in play", () => {
    const { state, player } = createStateWithActiveCunningCard();
    const room = state.getCurrentRoom()!;

    const firstStep = state.crossSquare(
      { sessionId: TEST_SESSION_ID } as any,
      { roomIndex: 0, x: 0, y: 0 }
    );
    assert.strictEqual(firstStep.success, true);
    assert.strictEqual(firstStep.completed, true);
    assert.strictEqual(firstStep.message, "First step crossed. Cunning completed.");

    assert.strictEqual(room.getSquare(0, 0)?.checked, true);
    assert.strictEqual(player.drawnCards.length, 0);
    assert.strictEqual(player.discardPile.length, 1);
    assert.strictEqual(player.discardPile[0].type, CUNNING_CARD_TYPE);
  });

  it("should complete after the second step when exactly two target cards are in play", () => {
    const { state, player } = createStateWithActiveCunningCard();
    const room = state.getCurrentRoom()!;

    const monster = MonsterFactory.createGoblin("cunning_monster_two_cards");
    monster.playerOwnerId = TEST_SESSION_ID;
    monster.connectedToRoomIndex = -1;
    state.activeMonsters.push(monster);

    const firstStep = state.crossSquare(
      { sessionId: TEST_SESSION_ID } as any,
      { roomIndex: 0, x: 0, y: 0 }
    );
    assert.strictEqual(firstStep.success, true);
    assert.strictEqual(firstStep.completed, false);

    const secondStep = state.crossMonsterSquare(TEST_SESSION_ID, monster.id, 0, 0);
    assert.strictEqual(secondStep.success, true);
    assert.strictEqual(secondStep.completed, true);
    assert.strictEqual(secondStep.message, "Second step crossed. Cunning completed.");

    assert.strictEqual(room.getSquare(0, 0)?.checked, true);
    assert.strictEqual(monster.getSquare(0, 0)?.checked, true);
    assert.strictEqual(monster.getSquare(1, 0)?.checked, true);
    assert.strictEqual(player.drawnCards.length, 0);
    assert.strictEqual(player.discardPile.length, 1);
    assert.strictEqual(player.discardPile[0].type, CUNNING_CARD_TYPE);
  });

  it("should complete the 1-2-3 sequence across different room/monster cards", () => {
    const { state, player } = createStateWithActiveCunningCard();
    const room = state.getCurrentRoom()!;

    const firstMonster = MonsterFactory.createGoblin("cunning_monster_one");
    firstMonster.playerOwnerId = TEST_SESSION_ID;
    firstMonster.connectedToRoomIndex = -1;
    state.activeMonsters.push(firstMonster);

    const secondMonster = MonsterFactory.createGoblin("cunning_monster_two");
    secondMonster.playerOwnerId = TEST_SESSION_ID;
    secondMonster.connectedToRoomIndex = -1;
    state.activeMonsters.push(secondMonster);

    const firstStep = state.crossSquare(
      { sessionId: TEST_SESSION_ID } as any,
      { roomIndex: 0, x: 0, y: 0 }
    );
    assert.strictEqual(firstStep.success, true);
    assert.strictEqual(firstStep.completed, false);

    const secondStep = state.crossMonsterSquare(TEST_SESSION_ID, firstMonster.id, 0, 0);
    assert.strictEqual(secondStep.success, true);
    assert.strictEqual(secondStep.completed, false);

    const thirdStep = state.crossMonsterSquare(TEST_SESSION_ID, secondMonster.id, 0, 0);
    assert.strictEqual(thirdStep.success, true);
    assert.strictEqual(thirdStep.completed, true);

    assert.strictEqual(room.getSquare(0, 0)?.checked, true);
    assert.strictEqual(firstMonster.getSquare(0, 0)?.checked, true);
    assert.strictEqual(firstMonster.getSquare(1, 0)?.checked, true);
    assert.strictEqual(secondMonster.getSquare(0, 0)?.checked, true);
    assert.strictEqual(secondMonster.getSquare(1, 0)?.checked, true);
    assert.strictEqual(secondMonster.getSquare(2, 0)?.checked, true);

    assert.strictEqual(player.drawnCards.length, 0);
    assert.strictEqual(player.discardPile.length, 1);
    assert.strictEqual(player.discardPile[0].type, CUNNING_CARD_TYPE);
  });

  it("should reject the second step on the same card as step one", () => {
    const { state } = createStateWithActiveCunningCard();
    const monster = MonsterFactory.createGoblin("cunning_monster_for_same_room_check");
    monster.playerOwnerId = TEST_SESSION_ID;
    monster.connectedToRoomIndex = -1;
    state.activeMonsters.push(monster);

    const firstStep = state.crossSquare(
      { sessionId: TEST_SESSION_ID } as any,
      { roomIndex: 0, x: 0, y: 0 }
    );
    assert.strictEqual(firstStep.success, true);

    const invalidSecondStep = state.crossSquare(
      { sessionId: TEST_SESSION_ID } as any,
      { roomIndex: 0, x: 2, y: 0 }
    );
    assert.strictEqual(invalidSecondStep.success, false);
    assert.strictEqual(invalidSecondStep.invalidSquare, true);
    assert(invalidSecondStep.error?.includes("different room or monster card"));
  });

  it("should reject the third step on the same card as step two", () => {
    const { state } = createStateWithActiveCunningCard();

    const secondStepMonster = MonsterFactory.createGoblin("cunning_monster_reused");
    secondStepMonster.playerOwnerId = TEST_SESSION_ID;
    secondStepMonster.connectedToRoomIndex = -1;
    state.activeMonsters.push(secondStepMonster);

    const extraMonster = MonsterFactory.createGoblin("cunning_monster_extra");
    extraMonster.playerOwnerId = TEST_SESSION_ID;
    extraMonster.connectedToRoomIndex = -1;
    state.activeMonsters.push(extraMonster);

    const firstStep = state.crossSquare(
      { sessionId: TEST_SESSION_ID } as any,
      { roomIndex: 0, x: 0, y: 0 }
    );
    assert.strictEqual(firstStep.success, true);

    const secondStep = state.crossMonsterSquare(TEST_SESSION_ID, secondStepMonster.id, 0, 0);
    assert.strictEqual(secondStep.success, true);

    const invalidThirdStep = state.crossMonsterSquare(TEST_SESSION_ID, secondStepMonster.id, 0, 1);
    assert.strictEqual(invalidThirdStep.success, false);
    assert.strictEqual(invalidThirdStep.invalidSquare, true);
    assert(invalidThirdStep.error?.includes("different room or monster card"));
  });

  it("should not allow confirming Cunning because it resolves on clicks", () => {
    const { state } = createStateWithActiveCunningCard();

    const confirmResult = state.confirmCardAction(TEST_SESSION_ID);
    assert.strictEqual(confirmResult.success, false);
    assert(confirmResult.error?.includes("resolves directly"));
  });
});
