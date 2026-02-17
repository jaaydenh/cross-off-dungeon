"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROOM_SHAPE_TEMPLATES = void 0;
const RAW_ROOM_SHAPE_TEMPLATES = [
    {
        id: "crypt_cross_7x5",
        width: 7,
        height: 5,
        rows: [
            "..###..",
            "..#.#..",
            ".......",
            "..#.#..",
            "..###.."
        ]
    },
    {
        id: "chapel_nave_8x6",
        width: 8,
        height: 6,
        rows: [
            "##....##",
            "#......#",
            "........",
            "...##...",
            "..####..",
            "...##..."
        ]
    },
    {
        id: "vault_ring_8x6",
        width: 8,
        height: 6,
        rows: [
            ".######.",
            "#......#",
            "#.####.#",
            "#.####.#",
            "#......#",
            ".######."
        ]
    },
    {
        id: "broken_keep_6x6",
        width: 6,
        height: 6,
        rows: [
            "......",
            ".##...",
            ".##...",
            "...##.",
            "...##.",
            "......"
        ]
    },
    {
        id: "catacomb_lanes_7x6",
        width: 7,
        height: 6,
        rows: [
            ".#...#.",
            ".#.#.#.",
            "...#...",
            ".#.#.#.",
            ".#...#.",
            "...#..."
        ]
    }
];
const isRoomTileGlyph = (char) => char === "." || char === "#";
const validateTemplate = (template) => {
    if (template.rows.length !== template.height) {
        throw new Error(`Invalid room template "${template.id}": height=${template.height} but has ${template.rows.length} row(s)`);
    }
    template.rows.forEach((row, rowIndex) => {
        if (row.length !== template.width) {
            throw new Error(`Invalid room template "${template.id}": width=${template.width} but row ${rowIndex} has ${row.length} column(s)`);
        }
        [...row].forEach((char) => {
            if (!isRoomTileGlyph(char)) {
                throw new Error(`Invalid room template "${template.id}": unsupported glyph "${char}", expected "." or "#"`);
            }
        });
    });
    return template;
};
exports.ROOM_SHAPE_TEMPLATES = RAW_ROOM_SHAPE_TEMPLATES.map(validateTemplate);
