"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStarterDeck = exports.createCardFromDefinition = exports.getCardDefinition = exports.CARD_DEFINITIONS = exports.STARTER_DECK_SIZE = exports.COMBAT_CARD_ID = exports.HEROIC_MOVE_AND_FIGHT_CARD_ID = void 0;
const Card_1 = require("../schema/Card");
exports.HEROIC_MOVE_AND_FIGHT_CARD_ID = "heroic_move_two_and_fight_two";
exports.COMBAT_CARD_ID = "combat_fight_three_diagonal_or_move_three";
exports.STARTER_DECK_SIZE = 10;
exports.CARD_DEFINITIONS = [
    {
        id: "cross_connected_squares",
        name: "Connected Cross",
        description: "Cross off up to 3 connected squares",
        color: "clear",
        defenseSymbol: "empty",
        selection: {
            target: "room",
            mode: "squares",
            minSelections: 1,
            maxSelections: 3,
            connected: true,
            requireRoomStartAdjacency: true
        }
    },
    {
        id: "cross_any_two_room_or_monster",
        name: "Any Two",
        description: "Cross off up to 2 squares on a single room or monster",
        color: "clear",
        defenseSymbol: "block",
        selection: {
            target: "room_or_monster",
            mode: "squares",
            minSelections: 1,
            maxSelections: 2,
            connected: false,
            // This card allows starting anywhere in a room (no entrance/cross-adjacent requirement).
            requireRoomStartAdjacency: false,
            requireMonsterStartAdjacency: false
        }
    },
    {
        id: "cross_two_connected_each_monster",
        name: "Every Monster",
        description: "Cross off 2 connected squares on every monster",
        color: "clear",
        defenseSymbol: "counter",
        selection: {
            target: "monster_each",
            mode: "squares",
            minSelections: 2,
            maxSelections: 2,
            connected: true,
            requireMonsterStartAdjacency: true
        }
    },
    {
        id: "cross_row_room",
        name: "Horizontal Sweep",
        description: "Cross off all horizontal squares on a single room",
        color: "clear",
        defenseSymbol: "empty",
        selection: {
            target: "room",
            mode: "row",
            minSelections: 1,
            connected: false,
            requireRoomStartAdjacency: true
        }
    },
    {
        id: "cross_two_horizontal_then_two_horizontal",
        name: "Heroic Double Sweep",
        description: "Cross off 2 horizontal squares, then 2 more horizontal squares",
        color: "clear",
        defenseSymbol: "counter",
        selection: {
            target: "room_or_monster",
            mode: "horizontal_pair_twice",
            minSelections: 4,
            maxSelections: 4,
            connected: false,
            requireRoomStartAdjacency: false
        }
    },
    {
        id: exports.HEROIC_MOVE_AND_FIGHT_CARD_ID,
        name: "Heroic Move and Fight",
        description: "Move 2 and fight 2",
        color: "clear",
        defenseSymbol: "counter",
        selection: {
            target: "room_or_monster",
            mode: "squares",
            minSelections: 4,
            maxSelections: 4,
            connected: true,
            requireRoomStartAdjacency: false,
            requireMonsterStartAdjacency: false
        }
    },
    {
        id: exports.COMBAT_CARD_ID,
        name: "Combat",
        description: "Fight 3 diagonal or move 3",
        color: "red",
        defenseSymbol: "counter",
        selection: {
            target: "room_or_monster",
            mode: "squares",
            minSelections: 3,
            maxSelections: 3,
            connected: true,
            requireRoomStartAdjacency: false,
            requireMonsterStartAdjacency: false
        }
    },
    {
        id: "reposition",
        name: "Reposition",
        description: "Move 2 then draw another card",
        color: "clear",
        defenseSymbol: "empty",
        drawCardsOnResolve: 1,
        selection: {
            target: "room",
            mode: "squares",
            minSelections: 2,
            maxSelections: 2,
            connected: true,
            requireRoomStartAdjacency: true
        }
    }
];
const CARD_DEFINITIONS_BY_ID = new Map(exports.CARD_DEFINITIONS.map((card) => [card.id, card]));
function getCardDefinition(id) {
    return CARD_DEFINITIONS_BY_ID.get(id);
}
exports.getCardDefinition = getCardDefinition;
function createCardFromDefinition(definition, id) {
    const selection = definition.selection;
    return new Card_1.Card(id, definition.id, definition.description, selection.target, selection.mode, selection.minSelections ?? 1, selection.maxSelections ?? 0, selection.connected ?? false, selection.requireRoomStartAdjacency ?? false, selection.requireMonsterStartAdjacency ?? false, definition.defenseSymbol ?? "empty", definition.drawCardsOnResolve ?? 0, definition.color ?? "clear", definition.name);
}
exports.createCardFromDefinition = createCardFromDefinition;
function createStarterDeck() {
    const cards = [];
    for (let cardIndex = 1; cardIndex <= exports.STARTER_DECK_SIZE; cardIndex++) {
        const definitionIndex = Math.floor(Math.random() * exports.CARD_DEFINITIONS.length);
        const definition = exports.CARD_DEFINITIONS[definitionIndex];
        cards.push(createCardFromDefinition(definition, `card_${cardIndex}`));
    }
    // Shuffle the cards using Fisher-Yates algorithm
    for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
}
exports.createStarterDeck = createStarterDeck;
