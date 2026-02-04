"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonsterCard = void 0;
const schema_1 = require("@colyseus/schema");
const MonsterSquare_1 = require("./MonsterSquare");
class MonsterCard extends schema_1.Schema {
    constructor(id, name, width, height) {
        super();
        this.squares = new schema_1.ArraySchema();
        this.playerOwnerId = ""; // SessionId of player who owns this monster, empty if unowned
        this.connectedToRoomIndex = -1; // Index of room this monster is connected to (-1 if in player area)
        this.id = id;
        this.name = name;
        this.width = width;
        this.height = height;
        this.squares = new schema_1.ArraySchema();
        this.playerOwnerId = "";
        this.connectedToRoomIndex = -1;
        // Initialize empty grid
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                this.squares.push(new MonsterSquare_1.MonsterSquare(x, y, false));
            }
        }
    }
    /**
     * Set a square as part of the monster pattern
     */
    setSquareFilled(x, y, filled = true) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            const index = y * this.width + x;
            if (index >= 0 && index < this.squares.length) {
                this.squares[index].filled = filled;
            }
        }
    }
    /**
     * Get a square at the specified coordinates
     */
    getSquare(x, y) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            const index = y * this.width + x;
            if (index >= 0 && index < this.squares.length) {
                return this.squares[index];
            }
        }
        return null;
    }
    /**
     * Check if the monster is completely crossed off
     */
    isCompleted() {
        for (let i = 0; i < this.squares.length; i++) {
            const square = this.squares[i];
            if (square.filled && !square.checked) {
                return false;
            }
        }
        return true;
    }
    /**
     * Get the total number of filled squares
     */
    getTotalSquares() {
        return this.squares.filter(square => square.filled).length;
    }
    /**
     * Get the number of crossed squares
     */
    getCrossedSquares() {
        return this.squares.filter(square => square.filled && square.checked).length;
    }
}
exports.MonsterCard = MonsterCard;
__decorate([
    (0, schema_1.type)("string")
], MonsterCard.prototype, "id", void 0);
__decorate([
    (0, schema_1.type)("string")
], MonsterCard.prototype, "name", void 0);
__decorate([
    (0, schema_1.type)("number")
], MonsterCard.prototype, "width", void 0);
__decorate([
    (0, schema_1.type)("number")
], MonsterCard.prototype, "height", void 0);
__decorate([
    (0, schema_1.type)([MonsterSquare_1.MonsterSquare])
], MonsterCard.prototype, "squares", void 0);
__decorate([
    (0, schema_1.type)("string")
], MonsterCard.prototype, "playerOwnerId", void 0);
__decorate([
    (0, schema_1.type)("number")
], MonsterCard.prototype, "connectedToRoomIndex", void 0);
