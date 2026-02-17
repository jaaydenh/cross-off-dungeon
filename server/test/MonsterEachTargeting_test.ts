import assert from "assert";
import { describe, it } from "mocha";
import { DungeonState } from "../src/rooms/schema/DungeonState";
import { Card } from "../src/rooms/schema/Card";
import { MonsterFactory } from "../src/rooms/MonsterFactory";

const PLAYER_A = "monster_each_player_a";
const PLAYER_B = "monster_each_player_b";

const makeMonsterEachCard = (id: string) =>
  new Card(
    id,
    "cross_two_connected_each_monster",
    "Cross off up to 2 connected squares on every monster",
    "monster_each",
    "squares",
    1,
    2,
    true,
    false,
    true
  );

const makeAnyTwoCard = (id: string) =>
  new Card(
    id,
    "cross_any_two_room_or_monster",
    "Cross off up to 2 squares on a single room or monster",
    "room_or_monster",
    "squares",
    1,
    2,
    false,
    false,
    false
  );

type Coord = { x: number; y: number };

const findOrthAdjacentMonsterPair = (monster: any): [Coord, Coord] | null => {
  for (let y = 0; y < monster.height; y++) {
    for (let x = 0; x < monster.width; x++) {
      const left = monster.getSquare(x, y);
      const right = monster.getSquare(x + 1, y);
      if (
        left &&
        right &&
        left.filled &&
        right.filled &&
        !left.checked &&
        !right.checked
      ) {
        return [{ x, y }, { x: x + 1, y }];
      }

      const up = monster.getSquare(x, y);
      const down = monster.getSquare(x, y + 1);
      if (
        up &&
        down &&
        up.filled &&
        down.filled &&
        !up.checked &&
        !down.checked
      ) {
        return [{ x, y }, { x, y: y + 1 }];
      }
    }
  }

  return null;
};

const findAvailableMonsterSquare = (monster: any): Coord | null => {
  for (let y = 0; y < monster.height; y++) {
    for (let x = 0; x < monster.width; x++) {
      const square = monster.getSquare(x, y);
      if (square && square.filled && !square.checked) {
        return { x, y };
      }
    }
  }

  return null;
};

const createStateWithPlayers = (): DungeonState => {
  const state = new DungeonState();
  state.initializeBoard();
  state.createPlayer(PLAYER_A, "PlayerA");
  state.createPlayer(PLAYER_B, "PlayerB");
  return state;
};

describe("Monster Each Targeting", () => {
  it("allows confirming with one square selected per eligible monster", () => {
    const state = createStateWithPlayers();
    const playerA = state.players.get(PLAYER_A)!;

    const card = makeMonsterEachCard("monster_each_card_single_each");
    card.isActive = true;
    playerA.drawnCards.push(card);
    state.activeCardPlayers.set(PLAYER_A, card.id);

    const firstMonster = MonsterFactory.createGoblin("target_monster_a");
    firstMonster.playerOwnerId = PLAYER_B;
    firstMonster.connectedToRoomIndex = -1;

    const secondMonster = MonsterFactory.createBat("target_monster_b");
    secondMonster.playerOwnerId = PLAYER_B;
    secondMonster.connectedToRoomIndex = -1;

    state.activeMonsters.push(firstMonster);
    state.activeMonsters.push(secondMonster);

    const firstPick = findAvailableMonsterSquare(firstMonster);
    const secondPick = findAvailableMonsterSquare(secondMonster);
    assert(firstPick, "Expected an available square on first monster");
    assert(secondPick, "Expected an available square on second monster");

    const firstResult = state.crossMonsterSquare(PLAYER_A, firstMonster.id, firstPick.x, firstPick.y);
    assert.strictEqual(firstResult.success, true);

    const secondResult = state.crossMonsterSquare(PLAYER_A, secondMonster.id, secondPick.x, secondPick.y);
    assert.strictEqual(secondResult.success, true);

    const confirmResult = state.confirmCardAction(PLAYER_A);
    assert.strictEqual(confirmResult.success, true);
    assert.strictEqual(confirmResult.completed, true);
    assert.strictEqual(firstMonster.getSquare(firstPick.x, firstPick.y)?.checked, true);
    assert.strictEqual(secondMonster.getSquare(secondPick.x, secondPick.y)?.checked, true);
  });

  it("still requires at least one selection on each eligible monster", () => {
    const state = createStateWithPlayers();
    const playerA = state.players.get(PLAYER_A)!;

    const card = makeMonsterEachCard("monster_each_card_missing_monster");
    card.isActive = true;
    playerA.drawnCards.push(card);
    state.activeCardPlayers.set(PLAYER_A, card.id);

    const firstMonster = MonsterFactory.createGoblin("required_monster_a");
    firstMonster.playerOwnerId = PLAYER_B;
    firstMonster.connectedToRoomIndex = -1;

    const secondMonster = MonsterFactory.createBat("required_monster_b");
    secondMonster.playerOwnerId = PLAYER_B;
    secondMonster.connectedToRoomIndex = -1;

    state.activeMonsters.push(firstMonster);
    state.activeMonsters.push(secondMonster);

    const pick = findAvailableMonsterSquare(firstMonster);
    assert(pick, "Expected an available square on first monster");

    const pickResult = state.crossMonsterSquare(PLAYER_A, firstMonster.id, pick.x, pick.y);
    assert.strictEqual(pickResult.success, true);

    const confirmResult = state.confirmCardAction(PLAYER_A);
    assert.strictEqual(confirmResult.success, false);
    assert(confirmResult.error?.includes("Must select"));
  });

  it("allows monster_each cards to target monsters owned by other players", () => {
    const state = createStateWithPlayers();
    const playerA = state.players.get(PLAYER_A)!;

    const card = makeMonsterEachCard("monster_each_card");
    card.isActive = true;
    playerA.drawnCards.push(card);
    state.activeCardPlayers.set(PLAYER_A, card.id);

    const monster = MonsterFactory.createGoblin("target_monster");
    monster.playerOwnerId = PLAYER_B;
    monster.connectedToRoomIndex = -1;
    state.activeMonsters.push(monster);

    const pair = findOrthAdjacentMonsterPair(monster);
    assert(pair, "Expected an adjacent pair on the target monster");

    const firstPick = state.crossMonsterSquare(PLAYER_A, monster.id, pair[0].x, pair[0].y);
    assert.strictEqual(firstPick.success, true);

    const secondPick = state.crossMonsterSquare(PLAYER_A, monster.id, pair[1].x, pair[1].y);
    assert.strictEqual(secondPick.success, true);

    const confirmResult = state.confirmCardAction(PLAYER_A);
    assert.strictEqual(confirmResult.success, true);
    assert.strictEqual(confirmResult.completed, true);
    assert.strictEqual(monster.getSquare(pair[0].x, pair[0].y)?.checked, true);
    assert.strictEqual(monster.getSquare(pair[1].x, pair[1].y)?.checked, true);
  });

  it("keeps ownership restriction for non-monster_each cards", () => {
    const state = createStateWithPlayers();
    const playerA = state.players.get(PLAYER_A)!;

    const card = makeAnyTwoCard("any_two_card");
    card.isActive = true;
    playerA.drawnCards.push(card);
    state.activeCardPlayers.set(PLAYER_A, card.id);

    const monster = MonsterFactory.createGoblin("restricted_target_monster");
    monster.playerOwnerId = PLAYER_B;
    monster.connectedToRoomIndex = -1;
    state.activeMonsters.push(monster);

    const pair = findOrthAdjacentMonsterPair(monster);
    assert(pair, "Expected an adjacent pair on the target monster");

    const result = state.crossMonsterSquare(PLAYER_A, monster.id, pair[0].x, pair[0].y);
    assert.strictEqual(result.success, false);
    assert(result.error?.includes("cannot target"));
  });
});
