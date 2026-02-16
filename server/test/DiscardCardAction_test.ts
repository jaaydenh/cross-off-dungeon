import assert from "assert";
import { describe, it } from "mocha";
import { DungeonState } from "../src/rooms/schema/DungeonState";
import { Card } from "../src/rooms/schema/Card";

const TEST_SESSION_ID = "discard_card_test_player";

const makeConnectedRoomCard = (id: string) =>
  new Card(
    id,
    "cross_connected_squares",
    "Cross off up to 3 connected squares",
    "room",
    "squares",
    1,
    3,
    true,
    true,
    false
  );

const makeRepositionCard = (id: string) =>
  new Card(
    id,
    "reposition",
    "Move 2 then draw another card",
    "room",
    "squares",
    2,
    2,
    true,
    true,
    false,
    "empty",
    1
  );

const createStateWithPlayer = (): { state: DungeonState; player: any } => {
  const state = new DungeonState();
  state.initializeBoard();
  state.createPlayer(TEST_SESSION_ID, "DiscardTester");

  const player = state.players.get(TEST_SESSION_ID)!;
  player.deck.clear();
  player.drawnCards.clear();
  player.discardPile.clear();

  return { state, player };
};

describe("Discard Active Card Action", () => {
  it("should discard the active card and clear card selections", () => {
    const { state, player } = createStateWithPlayer();

    const card = makeConnectedRoomCard("discard_test_card");
    card.isActive = true;
    player.drawnCards.push(card);
    state.activeCardPlayers.set(TEST_SESSION_ID, card.id);

    const room = state.getCurrentRoom()!;
    const selectionResult = state.selectSquareForCard(
      TEST_SESSION_ID,
      0,
      room.entranceX,
      room.entranceY
    );
    assert.strictEqual(selectionResult.success, true);
    assert.strictEqual(state.getCardSelectionState(TEST_SESSION_ID).selectedCount, 1);

    const discardResult = state.discardCardAction(TEST_SESSION_ID);
    assert.strictEqual(discardResult.success, true);

    assert.strictEqual(player.drawnCards.length, 0);
    assert.strictEqual(player.discardPile.length, 1);
    assert.strictEqual(player.discardPile[0].id, card.id);
    assert.strictEqual(player.discardPile[0].isActive, false);
    assert.strictEqual(state.activeCardPlayers.has(TEST_SESSION_ID), false);

    const selectionState = state.getCardSelectionState(TEST_SESSION_ID);
    assert.strictEqual(selectionState.hasActiveCard, false);
    assert.strictEqual(selectionState.selectedCount, 0);
  });

  it("should fail when no active card exists", () => {
    const { state } = createStateWithPlayer();

    const result = state.discardCardAction(TEST_SESSION_ID);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, "No active card to discard");
  });

  it("should not grant on-resolve bonus draws when discarding", () => {
    const { state, player } = createStateWithPlayer();

    const activeCard = makeRepositionCard("active_reposition");
    activeCard.isActive = true;
    player.drawnCards.push(activeCard);
    state.activeCardPlayers.set(TEST_SESSION_ID, activeCard.id);

    const deckCard = makeConnectedRoomCard("deck_card");
    player.deck.push(deckCard);
    const deckSizeBefore = player.deck.length;

    const result = state.discardCardAction(TEST_SESSION_ID);
    assert.strictEqual(result.success, true);

    assert.strictEqual(player.deck.length, deckSizeBefore);
    assert.strictEqual(player.drawnCards.length, 0);
    assert.strictEqual(player.discardPile.length, 1);
    assert.strictEqual(player.discardPile[0].id, activeCard.id);
  });
});
