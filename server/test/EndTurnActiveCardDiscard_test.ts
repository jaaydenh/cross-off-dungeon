import assert from "assert";
import { describe, it } from "mocha";
import { DungeonState } from "../src/rooms/schema/DungeonState";
import { Card } from "../src/rooms/schema/Card";
import { MonsterFactory } from "../src/rooms/MonsterFactory";

const TEST_SESSION_ID = "end_turn_test_player";

const makeCombatCard = (id: string) =>
  new Card(
    id,
    "combat_fight_three_diagonal_or_move_three",
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

const createStateWithActiveCombatCard = (withOwnedMonster: boolean): {
  state: DungeonState;
  player: any;
  cardId: string;
} => {
  const state = new DungeonState();
  state.initializeBoard();
  state.createPlayer(TEST_SESSION_ID, "EndTurnPlayer");

  const player = state.players.get(TEST_SESSION_ID)!;
  player.deck.clear();
  player.drawnCards.clear();
  player.discardPile.clear();
  player.turnStatus = "playing_turn";
  player.hasDrawnCard = true;

  const cardId = "active_combat_card";
  const card = makeCombatCard(cardId);
  card.isActive = true;
  player.drawnCards.push(card);
  state.activeCardPlayers.set(TEST_SESSION_ID, cardId);

  if (withOwnedMonster) {
    const ownedMonster = MonsterFactory.createGoblin("end_turn_owned_monster");
    ownedMonster.playerOwnerId = TEST_SESSION_ID;
    ownedMonster.connectedToRoomIndex = -1;
    state.activeMonsters.push(ownedMonster);
  }

  return { state, player, cardId };
};

describe("End Turn Active Card Handling", () => {
  it("should discard the active card when it has no legal targets", () => {
    const { state, player, cardId } = createStateWithActiveCombatCard(false);

    const result = state.preparePlayerForEndTurn(TEST_SESSION_ID);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.discardedActiveCard, true);

    assert.strictEqual(player.drawnCards.length, 0);
    assert.strictEqual(player.discardPile.length, 1);
    assert.strictEqual(player.discardPile[0].id, cardId);
    assert.strictEqual(player.discardPile[0].isActive, false);
    assert.strictEqual(state.activeCardPlayers.has(TEST_SESSION_ID), false);
  });

  it("should keep requiring confirm/cancel when the active card is playable", () => {
    const { state, player, cardId } = createStateWithActiveCombatCard(true);

    const result = state.preparePlayerForEndTurn(TEST_SESSION_ID);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, "Cannot end turn while a card is active. Confirm or cancel it first.");

    assert.strictEqual(player.drawnCards.length, 1);
    assert.strictEqual(player.drawnCards[0].id, cardId);
    assert.strictEqual(player.drawnCards[0].isActive, true);
    assert.strictEqual(player.discardPile.length, 0);
    assert.strictEqual(state.activeCardPlayers.get(TEST_SESSION_ID), cardId);
  });
});
