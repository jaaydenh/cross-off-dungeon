import assert from "assert";
import { describe, it } from "mocha";
import { DungeonState } from "../src/rooms/schema/DungeonState";

describe("Monster Attack Phase", () => {
  const createSinglePlayerState = () => {
    const state = new DungeonState();
    state.initializeBoard();
    state.createPlayer("player_1", "Player1");
    state.initializeTurnState();
    return state;
  };

  const completeSinglePlayerTurn = (state: DungeonState, sessionId: string) => {
    const started = state.updatePlayerTurnStatus(sessionId, "playing_turn");
    assert.strictEqual(started, true);

    const completed = state.updatePlayerTurnStatus(sessionId, "turn_complete");
    assert.strictEqual(completed, true);
  };

  const getCheckedSquares = (monster: any): number =>
    monster.squares.filter((square: any) => square.filled && square.checked).length;

  it("should initialize monsters with attack rating 1", () => {
    const state = createSinglePlayerState();
    assert(state.activeMonsters.length > 0);
    assert.strictEqual(state.activeMonsters[0].attackRating, 1);
  });

  it("should discard the defense card when symbol is empty", () => {
    const state = createSinglePlayerState();
    const player = state.players.get("player_1")!;
    const monster = state.activeMonsters[0];

    const claim = state.claimMonster("player_1", monster.id);
    assert.strictEqual(claim.success, true);

    player.deck[0].defenseSymbol = "empty";
    const deckBefore = player.deck.length;
    const discardBefore = player.discardPile.length;
    const checkedBefore = getCheckedSquares(monster);

    completeSinglePlayerTurn(state, "player_1");

    const attackPhase = state.consumePendingMonsterAttackPhaseResult();
    assert(attackPhase);
    assert.strictEqual(attackPhase.totalAttacks, 1);
    assert.strictEqual(attackPhase.attacks[0].outcome, "discarded");
    assert.strictEqual(attackPhase.attacks[0].card?.defenseSymbol, "empty");

    assert.strictEqual(player.deck.length, deckBefore - 1);
    assert.strictEqual(player.discardPile.length, discardBefore + 1);
    assert.strictEqual(getCheckedSquares(monster), checkedBefore);
  });

  it("should return the defense card to deck when symbol is block", () => {
    const state = createSinglePlayerState();
    const player = state.players.get("player_1")!;
    const monster = state.activeMonsters[0];

    const claim = state.claimMonster("player_1", monster.id);
    assert.strictEqual(claim.success, true);

    player.deck[0].defenseSymbol = "block";
    const deckBefore = player.deck.length;
    const discardBefore = player.discardPile.length;

    completeSinglePlayerTurn(state, "player_1");

    const attackPhase = state.consumePendingMonsterAttackPhaseResult();
    assert(attackPhase);
    assert.strictEqual(attackPhase.totalAttacks, 1);
    assert.strictEqual(attackPhase.attacks[0].outcome, "returned_to_deck");
    assert.strictEqual(attackPhase.attacks[0].card?.defenseSymbol, "block");

    assert.strictEqual(player.deck.length, deckBefore);
    assert.strictEqual(player.discardPile.length, discardBefore);
  });

  it("should counter-attack one random monster square and return card when symbol is counter", () => {
    const state = createSinglePlayerState();
    const player = state.players.get("player_1")!;
    const monster = state.activeMonsters[0];

    const claim = state.claimMonster("player_1", monster.id);
    assert.strictEqual(claim.success, true);

    player.deck[0].defenseSymbol = "counter";
    const deckBefore = player.deck.length;
    const checkedBefore = getCheckedSquares(monster);

    completeSinglePlayerTurn(state, "player_1");

    const attackPhase = state.consumePendingMonsterAttackPhaseResult();
    assert(attackPhase);
    assert.strictEqual(attackPhase.totalAttacks, 1);
    assert.strictEqual(attackPhase.attacks[0].outcome, "counter_attack");
    assert.strictEqual(attackPhase.attacks[0].card?.defenseSymbol, "counter");

    assert.strictEqual(player.deck.length, deckBefore);
    assert.strictEqual(getCheckedSquares(monster), checkedBefore + 1);
  });
});
