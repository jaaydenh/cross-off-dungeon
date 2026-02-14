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
    "Fight",
    "monster",
    "centered_monster_3x3",
    1,
    1,
    false,
    false,
    false,
    "counter",
    0,
    "red",
    "Combat"
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

const getBlastTargets = (monster: any, centerX: number, centerY: number): Coord[] => {
  const coords: Coord[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = centerX + dx;
      const y = centerY + dy;
      const square = monster.getSquare(x, y);
      if (square && square.filled && !square.checked) {
        coords.push({ x, y });
      }
    }
  }
  return coords;
};

const markAllFilledChecked = (monster: any): void => {
  for (const square of monster.squares) {
    if (square.filled) {
      square.checked = true;
    }
  }
};

describe("Combat Card", () => {
  it("should cross all valid filled squares in a centered 3x3 area and complete immediately", () => {
    const { state, player } = createStateWithActiveCombatCard();

    const ownedMonster = MonsterFactory.createGoblin("combat_test_monster");
    ownedMonster.playerOwnerId = TEST_SESSION_ID;
    ownedMonster.connectedToRoomIndex = -1;
    state.activeMonsters.push(ownedMonster);

    const expectedTargets = getBlastTargets(ownedMonster, 1, 1);
    assert.strictEqual(expectedTargets.length, 7);

    const result = state.crossMonsterSquare(TEST_SESSION_ID, ownedMonster.id, 1, 1);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.completed, true);
    assert(result.message?.includes("Combat crossed 7"));

    for (const target of expectedTargets) {
      assert.strictEqual(ownedMonster.getSquare(target.x, target.y)?.checked, true);
    }
    assert.strictEqual(player.drawnCards.length, 0);
    assert.strictEqual(player.discardPile.length, 1);
    assert.strictEqual(player.discardPile[0].type, COMBAT_CARD_TYPE);
  });

  it("should allow partial overlays at edges and cross only in-bounds valid squares", () => {
    const { state, player } = createStateWithActiveCombatCard();

    const ownedMonster = MonsterFactory.createGoblin("combat_test_monster");
    ownedMonster.playerOwnerId = TEST_SESSION_ID;
    ownedMonster.connectedToRoomIndex = -1;
    state.activeMonsters.push(ownedMonster);

    const expectedTargets = getBlastTargets(ownedMonster, 0, 0);
    assert.strictEqual(expectedTargets.length, 4);

    const result = state.crossMonsterSquare(TEST_SESSION_ID, ownedMonster.id, 0, 0);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.completed, true);

    for (const target of expectedTargets) {
      assert.strictEqual(ownedMonster.getSquare(target.x, target.y)?.checked, true);
    }

    // Outside the 3x3 center-at-(0,0) blast area.
    assert.strictEqual(ownedMonster.getSquare(2, 0)?.checked, false);
    assert.strictEqual(player.discardPile.length, 1);
  });

  it("should ignore invalid squares in the 3x3 area when at least one valid square is present", () => {
    const { state } = createStateWithActiveCombatCard();

    const ownedMonster = MonsterFactory.createGoblin("combat_test_monster");
    ownedMonster.playerOwnerId = TEST_SESSION_ID;
    ownedMonster.connectedToRoomIndex = -1;
    state.activeMonsters.push(ownedMonster);

    // Pre-check one filled square to ensure checked squares are ignored.
    ownedMonster.getSquare(1, 1)!.checked = true;

    const expectedTargets = getBlastTargets(ownedMonster, 1, 2);
    assert.strictEqual(expectedTargets.length, 6);

    const result = state.crossMonsterSquare(TEST_SESSION_ID, ownedMonster.id, 1, 2);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.completed, true);

    for (const target of expectedTargets) {
      assert.strictEqual(ownedMonster.getSquare(target.x, target.y)?.checked, true);
    }

    // Empty square in area remains empty and not crossed.
    assert.strictEqual(ownedMonster.getSquare(0, 2)?.filled, false);
    assert.strictEqual(ownedMonster.getSquare(0, 2)?.checked, false);
  });

  it("should fail if no valid squares are available in the 3x3 area", () => {
    const { state, player } = createStateWithActiveCombatCard();

    const ownedMonster = MonsterFactory.createGoblin("combat_test_monster");
    ownedMonster.playerOwnerId = TEST_SESSION_ID;
    ownedMonster.connectedToRoomIndex = -1;
    state.activeMonsters.push(ownedMonster);
    markAllFilledChecked(ownedMonster);

    const result = state.crossMonsterSquare(TEST_SESSION_ID, ownedMonster.id, 1, 1);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.invalidSquare, true);
    assert(result.error?.includes("No valid monster squares"));

    // Card should remain active/available when nothing was crossed.
    assert.strictEqual(player.drawnCards.length, 1);
    assert.strictEqual(player.discardPile.length, 0);
    assert.strictEqual(player.drawnCards[0].isActive, true);
  });
});
