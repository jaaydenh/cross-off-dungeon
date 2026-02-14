import assert from "assert";
import { describe, it } from "mocha";
import { CARD_DEFINITIONS, createCardFromDefinition } from "../src/rooms/cards/CardRegistry";

describe("Card Registry", () => {
  it("should configure Any Two as up to 2 squares with a minimum of 1", () => {
    const definition = CARD_DEFINITIONS.find((card) => card.id === "cross_any_two_room_or_monster");
    assert(definition, "Any Two card definition should exist");

    assert.strictEqual(definition.description, "Cross off up to 2 squares on a single room or monster");
    assert.strictEqual(definition.selection.target, "room_or_monster");
    assert.strictEqual(definition.selection.mode, "squares");
    assert.strictEqual(definition.selection.minSelections, 1);
    assert.strictEqual(definition.selection.maxSelections, 2);
  });

  it("should create Any Two cards with minSelections = 1 and maxSelections = 2", () => {
    const definition = CARD_DEFINITIONS.find((card) => card.id === "cross_any_two_room_or_monster");
    assert(definition, "Any Two card definition should exist");

    const created = createCardFromDefinition(definition, "test_any_two");

    assert.strictEqual(created.type, "cross_any_two_room_or_monster");
    assert.strictEqual(created.minSelections, 1);
    assert.strictEqual(created.maxSelections, 2);
    assert.strictEqual(created.description, "Cross off up to 2 squares on a single room or monster");
  });

  it("should configure Reposition as a room-only adjacent move with a bonus draw", () => {
    const definition = CARD_DEFINITIONS.find((card) => card.id === "reposition");
    assert(definition, "Reposition card definition should exist");

    assert.strictEqual(definition.name, "Reposition");
    assert.strictEqual(definition.selection.target, "room");
    assert.strictEqual(definition.selection.mode, "squares");
    assert.strictEqual(definition.selection.minSelections, 2);
    assert.strictEqual(definition.selection.maxSelections, 2);
    assert.strictEqual(definition.selection.connected, true);
    assert.strictEqual(definition.selection.requireRoomStartAdjacency, true);
    assert.strictEqual(definition.drawCardsOnResolve, 1);
  });

  it("should create Reposition cards with drawCardsOnResolve = 1", () => {
    const definition = CARD_DEFINITIONS.find((card) => card.id === "reposition");
    assert(definition, "Reposition card definition should exist");

    const created = createCardFromDefinition(definition, "test_reposition");

    assert.strictEqual(created.type, "reposition");
    assert.strictEqual(created.minSelections, 2);
    assert.strictEqual(created.maxSelections, 2);
    assert.strictEqual(created.requiresConnected, true);
    assert.strictEqual(created.selectionTarget, "room");
    assert.strictEqual(created.drawCardsOnResolve, 1);
  });

  it("should configure Heroic Move and Fight as a counter card that requires 2 room + 2 monster squares", () => {
    const definition = CARD_DEFINITIONS.find((card) => card.id === "heroic_move_two_and_fight_two");
    assert(definition, "Heroic Move and Fight card definition should exist");

    assert.strictEqual(definition.name, "Heroic Move and Fight");
    assert.strictEqual(definition.description, "Move 2 and fight 2");
    assert.strictEqual(definition.color, "clear");
    assert.strictEqual(definition.defenseSymbol, "counter");
    assert.strictEqual(definition.selection.target, "room_or_monster");
    assert.strictEqual(definition.selection.mode, "squares");
    assert.strictEqual(definition.selection.minSelections, 4);
    assert.strictEqual(definition.selection.maxSelections, 4);
    assert.strictEqual(definition.selection.connected, true);
  });

  it("should create Heroic Move and Fight cards with counter defense symbol", () => {
    const definition = CARD_DEFINITIONS.find((card) => card.id === "heroic_move_two_and_fight_two");
    assert(definition, "Heroic Move and Fight card definition should exist");

    const created = createCardFromDefinition(definition, "test_heroic_move_and_fight");

    assert.strictEqual(created.type, "heroic_move_two_and_fight_two");
    assert.strictEqual(created.color, "clear");
    assert.strictEqual(created.defenseSymbol, "counter");
    assert.strictEqual(created.minSelections, 4);
    assert.strictEqual(created.maxSelections, 4);
    assert.strictEqual(created.requiresConnected, true);
    assert.strictEqual(created.selectionTarget, "room_or_monster");
  });

  it("should configure Combat as a red monster-only 3x3 centered blast card", () => {
    const definition = CARD_DEFINITIONS.find((card) => card.id === "combat_fight_three_diagonal_or_move_three");
    assert(definition, "Combat card definition should exist");

    assert.strictEqual(definition.name, "Combat");
    assert.strictEqual(definition.description, "Fight");
    assert.strictEqual(definition.color, "red");
    assert.strictEqual(definition.defenseSymbol, "counter");
    assert.strictEqual(definition.selection.target, "monster");
    assert.strictEqual(definition.selection.mode, "centered_monster_3x3");
    assert.strictEqual(definition.selection.minSelections, 1);
    assert.strictEqual(definition.selection.maxSelections, 1);
    assert.strictEqual(definition.selection.connected, false);
  });

  it("should create Combat cards with red color and monster-only centered mode", () => {
    const definition = CARD_DEFINITIONS.find((card) => card.id === "combat_fight_three_diagonal_or_move_three");
    assert(definition, "Combat card definition should exist");

    const created = createCardFromDefinition(definition, "test_combat");

    assert.strictEqual(created.type, "combat_fight_three_diagonal_or_move_three");
    assert.strictEqual(created.color, "red");
    assert.strictEqual(created.defenseSymbol, "counter");
    assert.strictEqual(created.minSelections, 1);
    assert.strictEqual(created.maxSelections, 1);
    assert.strictEqual(created.requiresConnected, false);
    assert.strictEqual(created.selectionTarget, "monster");
    assert.strictEqual(created.selectionMode, "centered_monster_3x3");
  });

  it("should configure Swipe as a red monster-only overlay card", () => {
    const definition = CARD_DEFINITIONS.find((card) => card.id === "swipe_fight_l_overlay");
    assert(definition, "Swipe card definition should exist");

    assert.strictEqual(definition.name, "Swipe");
    assert.strictEqual(definition.description, "Fight");
    assert.strictEqual(definition.color, "red");
    assert.strictEqual(definition.defenseSymbol, "empty");
    assert.strictEqual(definition.selection.target, "monster");
    assert.strictEqual(definition.selection.mode, "monster_swipe_l");
    assert.strictEqual(definition.selection.minSelections, 1);
    assert.strictEqual(definition.selection.maxSelections, 1);
    assert.strictEqual(definition.selection.connected, false);
  });

  it("should create Swipe cards with monster-only overlay mode", () => {
    const definition = CARD_DEFINITIONS.find((card) => card.id === "swipe_fight_l_overlay");
    assert(definition, "Swipe card definition should exist");

    const created = createCardFromDefinition(definition, "test_swipe");

    assert.strictEqual(created.type, "swipe_fight_l_overlay");
    assert.strictEqual(created.name, "Swipe");
    assert.strictEqual(created.color, "red");
    assert.strictEqual(created.defenseSymbol, "empty");
    assert.strictEqual(created.selectionTarget, "monster");
    assert.strictEqual(created.selectionMode, "monster_swipe_l");
    assert.strictEqual(created.minSelections, 1);
    assert.strictEqual(created.maxSelections, 1);
    assert.strictEqual(created.requiresConnected, false);
  });
});
