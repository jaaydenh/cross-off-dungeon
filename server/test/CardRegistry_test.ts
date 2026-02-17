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

  it("should configure Every Monster as up to 2 connected squares with a minimum of 1 per monster", () => {
    const definition = CARD_DEFINITIONS.find((card) => card.id === "cross_two_connected_each_monster");
    assert(definition, "Every Monster card definition should exist");

    assert.strictEqual(definition.name, "Every Monster");
    assert.strictEqual(definition.description, "Cross off up to 2 connected squares on every monster");
    assert.strictEqual(definition.selection.target, "monster_each");
    assert.strictEqual(definition.selection.mode, "squares");
    assert.strictEqual(definition.selection.minSelections, 1);
    assert.strictEqual(definition.selection.maxSelections, 2);
    assert.strictEqual(definition.selection.connected, true);
  });

  it("should create Every Monster cards with minSelections = 1 and maxSelections = 2", () => {
    const definition = CARD_DEFINITIONS.find((card) => card.id === "cross_two_connected_each_monster");
    assert(definition, "Every Monster card definition should exist");

    const created = createCardFromDefinition(definition, "test_every_monster");

    assert.strictEqual(created.type, "cross_two_connected_each_monster");
    assert.strictEqual(created.minSelections, 1);
    assert.strictEqual(created.maxSelections, 2);
    assert.strictEqual(created.description, "Cross off up to 2 connected squares on every monster");
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

  it("should configure Quick Step as a green room-only single move with dodge and a bonus draw", () => {
    const definition = CARD_DEFINITIONS.find((card) => card.id === "quick_step");
    assert(definition, "Quick Step card definition should exist");

    assert.strictEqual(definition.name, "Quick Step");
    assert.strictEqual(definition.description, "Move 1 then draw another card");
    assert.strictEqual(definition.color, "green");
    assert.strictEqual(definition.defenseSymbol, "dodge");
    assert.strictEqual(definition.drawCardsOnResolve, 1);
    assert.strictEqual(definition.selection.target, "room");
    assert.strictEqual(definition.selection.mode, "squares");
    assert.strictEqual(definition.selection.minSelections, 1);
    assert.strictEqual(definition.selection.maxSelections, 1);
    assert.strictEqual(definition.selection.connected, true);
    assert.strictEqual(definition.selection.requireRoomStartAdjacency, true);
  });

  it("should create Quick Step cards with dodge defense symbol and one bonus draw", () => {
    const definition = CARD_DEFINITIONS.find((card) => card.id === "quick_step");
    assert(definition, "Quick Step card definition should exist");

    const created = createCardFromDefinition(definition, "test_quick_step");

    assert.strictEqual(created.type, "quick_step");
    assert.strictEqual(created.name, "Quick Step");
    assert.strictEqual(created.color, "green");
    assert.strictEqual(created.defenseSymbol, "dodge");
    assert.strictEqual(created.selectionTarget, "room");
    assert.strictEqual(created.selectionMode, "squares");
    assert.strictEqual(created.minSelections, 1);
    assert.strictEqual(created.maxSelections, 1);
    assert.strictEqual(created.requiresConnected, true);
    assert.strictEqual(created.requiresRoomStartAdjacency, true);
    assert.strictEqual(created.drawCardsOnResolve, 1);
  });

  it("should configure Explore as a green room-only orthogonally connected move 5 with dodge", () => {
    const definition = CARD_DEFINITIONS.find((card) => card.id === "explore");
    assert(definition, "Explore card definition should exist");

    assert.strictEqual(definition.name, "Explore");
    assert.strictEqual(definition.description, "Move 5 (orthogonally connected)");
    assert.strictEqual(definition.color, "green");
    assert.strictEqual(definition.defenseSymbol, "dodge");
    assert.strictEqual(definition.selection.target, "room");
    assert.strictEqual(definition.selection.mode, "squares");
    assert.strictEqual(definition.selection.minSelections, 5);
    assert.strictEqual(definition.selection.maxSelections, 5);
    assert.strictEqual(definition.selection.connected, true);
    assert.strictEqual(definition.selection.requireRoomStartAdjacency, true);
  });

  it("should create Explore cards with dodge defense symbol and five connected room selections", () => {
    const definition = CARD_DEFINITIONS.find((card) => card.id === "explore");
    assert(definition, "Explore card definition should exist");

    const created = createCardFromDefinition(definition, "test_explore");

    assert.strictEqual(created.type, "explore");
    assert.strictEqual(created.name, "Explore");
    assert.strictEqual(created.color, "green");
    assert.strictEqual(created.defenseSymbol, "dodge");
    assert.strictEqual(created.selectionTarget, "room");
    assert.strictEqual(created.selectionMode, "squares");
    assert.strictEqual(created.minSelections, 5);
    assert.strictEqual(created.maxSelections, 5);
    assert.strictEqual(created.requiresConnected, true);
    assert.strictEqual(created.requiresRoomStartAdjacency, true);
    assert.strictEqual(created.drawCardsOnResolve, 0);
  });

  it("should configure Inspiration as a green room/monster single-square card with dodge", () => {
    const definition = CARD_DEFINITIONS.find((card) => card.id === "inspiration");
    assert(definition, "Inspiration card definition should exist");

    assert.strictEqual(definition.name, "Inspiration");
    assert.strictEqual(
      definition.description,
      "Pick a player. They can use their active card an extra time. Then cross off a single square on any card."
    );
    assert.strictEqual(definition.color, "green");
    assert.strictEqual(definition.defenseSymbol, "dodge");
    assert.strictEqual(definition.selection.target, "room_or_monster");
    assert.strictEqual(definition.selection.mode, "squares");
    assert.strictEqual(definition.selection.minSelections, 1);
    assert.strictEqual(definition.selection.maxSelections, 1);
    assert.strictEqual(definition.selection.connected, false);
  });

  it("should create Inspiration cards with dodge and single-square room/monster targeting", () => {
    const definition = CARD_DEFINITIONS.find((card) => card.id === "inspiration");
    assert(definition, "Inspiration card definition should exist");

    const created = createCardFromDefinition(definition, "test_inspiration");

    assert.strictEqual(created.type, "inspiration");
    assert.strictEqual(created.name, "Inspiration");
    assert.strictEqual(created.color, "green");
    assert.strictEqual(created.defenseSymbol, "dodge");
    assert.strictEqual(created.selectionTarget, "room_or_monster");
    assert.strictEqual(created.selectionMode, "squares");
    assert.strictEqual(created.minSelections, 1);
    assert.strictEqual(created.maxSelections, 1);
    assert.strictEqual(created.requiresConnected, false);
  });

  it("should configure Magic as a blue room/monster card with non-adjacent up-to-3 selection and counter", () => {
    const definition = CARD_DEFINITIONS.find((card) => card.id === "magic");
    assert(definition, "Magic card definition should exist");

    assert.strictEqual(definition.name, "Magic");
    assert.strictEqual(
      definition.description,
      "On a single room or monster card, cross off up to 3 squares that are not orthogonally adjacent."
    );
    assert.strictEqual(definition.color, "blue");
    assert.strictEqual(definition.defenseSymbol, "counter");
    assert.strictEqual(definition.selection.target, "room_or_monster");
    assert.strictEqual(definition.selection.mode, "squares");
    assert.strictEqual(definition.selection.minSelections, 1);
    assert.strictEqual(definition.selection.maxSelections, 3);
    assert.strictEqual(definition.selection.connected, false);
  });

  it("should create Magic cards with blue color, counter, and up-to-3 square mode", () => {
    const definition = CARD_DEFINITIONS.find((card) => card.id === "magic");
    assert(definition, "Magic card definition should exist");

    const created = createCardFromDefinition(definition, "test_magic");

    assert.strictEqual(created.type, "magic");
    assert.strictEqual(created.name, "Magic");
    assert.strictEqual(created.color, "blue");
    assert.strictEqual(created.defenseSymbol, "counter");
    assert.strictEqual(created.selectionTarget, "room_or_monster");
    assert.strictEqual(created.selectionMode, "squares");
    assert.strictEqual(created.minSelections, 1);
    assert.strictEqual(created.maxSelections, 3);
    assert.strictEqual(created.requiresConnected, false);
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

  it("should configure Cunning as a green staged card across different targets", () => {
    const definition = CARD_DEFINITIONS.find((card) => card.id === "cunning");
    assert(definition, "Cunning card definition should exist");

    assert.strictEqual(definition.name, "Cunning");
    assert.strictEqual(definition.color, "green");
    assert.strictEqual(definition.defenseSymbol, "empty");
    assert.strictEqual(definition.selection.target, "room_or_monster");
    assert.strictEqual(definition.selection.mode, "cunning_three_step_different_cards");
    assert.strictEqual(definition.selection.minSelections, 6);
    assert.strictEqual(definition.selection.maxSelections, 6);
    assert.strictEqual(definition.selection.connected, false);
  });

  it("should create Cunning cards with green color and staged mode", () => {
    const definition = CARD_DEFINITIONS.find((card) => card.id === "cunning");
    assert(definition, "Cunning card definition should exist");

    const created = createCardFromDefinition(definition, "test_cunning");

    assert.strictEqual(created.type, "cunning");
    assert.strictEqual(created.name, "Cunning");
    assert.strictEqual(created.color, "green");
    assert.strictEqual(created.defenseSymbol, "empty");
    assert.strictEqual(created.selectionTarget, "room_or_monster");
    assert.strictEqual(created.selectionMode, "cunning_three_step_different_cards");
    assert.strictEqual(created.minSelections, 6);
    assert.strictEqual(created.maxSelections, 6);
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

  it("should configure Spread Out as a green room-only centered 3x3 card", () => {
    const definition = CARD_DEFINITIONS.find((card) => card.id === "spread_out_room_overlay");
    assert(definition, "Spread Out card definition should exist");

    assert.strictEqual(definition.name, "Spread Out");
    assert.strictEqual(
      definition.description,
      "Choose any square in a room. Cross off that square. You may cross off any adjacent squares."
    );
    assert.strictEqual(definition.color, "green");
    assert.strictEqual(definition.defenseSymbol, "empty");
    assert.strictEqual(definition.selection.target, "room");
    assert.strictEqual(definition.selection.mode, "centered_room_3x3");
    assert.strictEqual(definition.selection.minSelections, 1);
    assert.strictEqual(definition.selection.maxSelections, 9);
  });

  it("should create Spread Out cards with green color and room-only centered mode", () => {
    const definition = CARD_DEFINITIONS.find((card) => card.id === "spread_out_room_overlay");
    assert(definition, "Spread Out card definition should exist");

    const created = createCardFromDefinition(definition, "test_spread_out");

    assert.strictEqual(created.type, "spread_out_room_overlay");
    assert.strictEqual(created.name, "Spread Out");
    assert.strictEqual(created.color, "green");
    assert.strictEqual(created.defenseSymbol, "empty");
    assert.strictEqual(created.selectionTarget, "room");
    assert.strictEqual(created.selectionMode, "centered_room_3x3");
    assert.strictEqual(created.minSelections, 1);
    assert.strictEqual(created.maxSelections, 9);
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
