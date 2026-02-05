"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStarterDeck = exports.createCardFromDefinition = exports.getCardDefinition = exports.CARD_DEFINITIONS = void 0;
const Card_1 = require("../schema/Card");
exports.CARD_DEFINITIONS = [
    {
        id: "cross_connected_squares",
        name: "Connected Cross",
        description: "Cross off up to 3 connected squares",
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
        description: "Cross off any 2 squares on a single room or monster",
        selection: {
            target: "room_or_monster",
            mode: "squares",
            minSelections: 2,
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
        selection: {
            target: "room",
            mode: "row",
            minSelections: 1,
            connected: false,
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
    return new Card_1.Card(id, definition.id, definition.description, selection.target, selection.mode, selection.minSelections ?? 1, selection.maxSelections ?? 0, selection.connected ?? false, selection.requireRoomStartAdjacency ?? false, selection.requireMonsterStartAdjacency ?? false);
}
exports.createCardFromDefinition = createCardFromDefinition;
function createStarterDeck() {
    const cards = [];
    let cardIndex = 1;
    for (const definition of exports.CARD_DEFINITIONS) {
        for (let i = 0; i < 2; i++) {
            cards.push(createCardFromDefinition(definition, `card_${cardIndex}`));
            cardIndex += 1;
        }
    }
    // Shuffle the cards using Fisher-Yates algorithm
    for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
}
exports.createStarterDeck = createStarterDeck;
