"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Room = void 0;
const schema_1 = require("@colyseus/schema");
const DungeonSquare_1 = require("./DungeonSquare");
class Room extends schema_1.Schema {
    constructor(width = 8, height = 8) {
        super();
        this.squares = new schema_1.ArraySchema();
        this.entranceDirection = "none"; // Direction from which player entered
        this.entranceX = -1;
        this.entranceY = -1;
        this.exitDirections = new schema_1.ArraySchema(); // Directions where exits are placed
        this.exitX = new schema_1.ArraySchema();
        this.exitY = new schema_1.ArraySchema();
        // Grid coordinate properties
        this.gridX = 0;
        this.gridY = 0;
        // Connection tracking properties
        this.connectedRoomIndices = new schema_1.ArraySchema(); // Which rooms connect to each exit
        this.exitConnected = new schema_1.ArraySchema(); // Whether each exit connects to discovered room
        this.width = width;
        this.height = height;
        this.initializeSquares();
    }
    initializeSquares() {
        // Clear existing squares
        this.squares.clear();
        // Create squares based on width and height
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const square = new DungeonSquare_1.DungeonSquare();
                // No border walls - all squares start as walkable
                square.wall = false;
                this.squares.push(square);
            }
        }
    }
    // Generate random exits for the room
    generateExits(previousDirection = "none") {
        // Clear existing exits from coordinate arrays
        this.exitDirections.clear();
        this.exitX.clear();
        this.exitY.clear();
        this.connectedRoomIndices.clear();
        this.exitConnected.clear();
        // Clear exit flags from all squares to prevent mismatches when reusing rooms
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const square = this.getSquare(x, y);
                if (square) {
                    square.exit = false;
                    // Also clear entrance flag to prevent conflicts
                    square.entrance = false;
                }
            }
        }
        // Determine how many exits to create (1-4)
        // Probability distribution: 1 exit: 20%, 2 exits: 50%, 3 exits: 20%, 4 exits: 10%
        const exitProbability = Math.random();
        let numExits;
        if (exitProbability < 0.2) {
            numExits = 1;
        }
        else if (exitProbability < 0.7) {
            numExits = 2;
        }
        else if (exitProbability < 0.9) {
            numExits = 3;
        }
        else {
            numExits = 4;
        }
        // Possible directions: "north", "east", "south", "west"
        const directions = ["north", "east", "south", "west"];
        // If we have a previous direction, we need to create an entrance in the opposite direction
        if (previousDirection !== "none") {
            // Set entrance direction
            this.entranceDirection = previousDirection;
            // Create entrance at the appropriate edge
            this.createEntrance(previousDirection);
            // Remove the entrance direction from possible exit directions
            const entranceIndex = directions.indexOf(previousDirection);
            if (entranceIndex !== -1) {
                directions.splice(entranceIndex, 1);
            }
        }
        // Shuffle the remaining directions
        for (let i = directions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [directions[i], directions[j]] = [directions[j], directions[i]];
        }
        // Create exits (up to numExits)
        const actualNumExits = Math.min(numExits, directions.length);
        for (let i = 0; i < actualNumExits; i++) {
            this.createExit(directions[i]);
        }
    }
    // Create an entrance at the appropriate edge based on the direction
    createEntrance(direction) {
        let x, y;
        switch (direction) {
            case "north":
                // Entrance at the north edge (top)
                x = Math.floor(this.width / 2);
                y = 0;
                break;
            case "east":
                // Entrance at the east edge (right)
                x = this.width - 1;
                y = Math.floor(this.height / 2);
                break;
            case "south":
                // Entrance at the south edge (bottom)
                x = Math.floor(this.width / 2);
                y = this.height - 1;
                break;
            case "west":
                // Entrance at the west edge (left)
                x = 0;
                y = Math.floor(this.height / 2);
                break;
            default:
                // Random position if no direction specified
                x = Math.floor(Math.random() * (this.width - 2)) + 1;
                y = Math.floor(Math.random() * (this.height - 2)) + 1;
        }
        // Set the entrance coordinates
        this.entranceX = x;
        this.entranceY = y;
        // Mark the square as an entrance and not a wall
        const square = this.getSquare(x, y);
        if (square) {
            square.wall = false;
            square.entrance = true;
        }
        // Ensure orthogonally adjacent squares are not walls
        this.clearAdjacentWalls(x, y);
    }
    // Create an exit at the appropriate edge based on the direction
    createExit(direction) {
        let x, y;
        switch (direction) {
            case "north":
                // Exit at the north edge (top)
                x = Math.floor(this.width / 2);
                y = 0;
                break;
            case "east":
                // Exit at the east edge (right)
                x = this.width - 1;
                y = Math.floor(this.height / 2);
                break;
            case "south":
                // Exit at the south edge (bottom)
                x = Math.floor(this.width / 2);
                y = this.height - 1;
                break;
            case "west":
                // Exit at the west edge (left)
                x = 0;
                y = Math.floor(this.height / 2);
                break;
            default:
                return; // Invalid direction
        }
        // Add the exit direction and coordinates
        this.exitDirections.push(direction);
        this.exitX.push(x);
        this.exitY.push(y);
        // Initialize connection tracking for this exit
        this.connectedRoomIndices.push(-1); // -1 indicates no connected room
        this.exitConnected.push(false); // Initially not connected
        // Mark the square as an exit and not a wall
        const square = this.getSquare(x, y);
        if (square) {
            square.wall = false;
            square.exit = true;
        }
        // Ensure orthogonally adjacent squares are not walls
        this.clearAdjacentWalls(x, y);
    }
    // Clear walls from squares orthogonally adjacent to a point
    clearAdjacentWalls(x, y) {
        // For entrances/exits on the edge, only clear walls in the direction pointing into the room
        const isNorthEdge = (y === 0);
        const isEastEdge = (x === this.width - 1);
        const isSouthEdge = (y === this.height - 1);
        const isWestEdge = (x === 0);
        // If on north edge, only clear the square to the south
        if (isNorthEdge) {
            const southSquare = this.getSquare(x, y + 1);
            if (southSquare)
                southSquare.wall = false;
            return;
        }
        // If on east edge, only clear the square to the west
        if (isEastEdge) {
            const westSquare = this.getSquare(x - 1, y);
            if (westSquare)
                westSquare.wall = false;
            return;
        }
        // If on south edge, only clear the square to the north
        if (isSouthEdge) {
            const northSquare = this.getSquare(x, y - 1);
            if (northSquare)
                northSquare.wall = false;
            return;
        }
        // If on west edge, only clear the square to the east
        if (isWestEdge) {
            const eastSquare = this.getSquare(x + 1, y);
            if (eastSquare)
                eastSquare.wall = false;
            return;
        }
        // For non-edge squares, clear all adjacent walls
        const northSquare = this.getSquare(x, y - 1);
        if (northSquare)
            northSquare.wall = false;
        const eastSquare = this.getSquare(x + 1, y);
        if (eastSquare)
            eastSquare.wall = false;
        const southSquare = this.getSquare(x, y + 1);
        if (southSquare)
            southSquare.wall = false;
        const westSquare = this.getSquare(x - 1, y);
        if (westSquare)
            westSquare.wall = false;
    }
    // Get the opposite direction
    getOppositeDirection(direction) {
        switch (direction) {
            case "north": return "south";
            case "east": return "west";
            case "south": return "north";
            case "west": return "east";
            default: return "none";
        }
    }
    // Get square at specific coordinates
    getSquare(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return undefined;
        }
        return this.squares[y * this.width + x];
    }
    // Set square at specific coordinates
    setSquare(x, y, square) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return false;
        }
        this.squares[y * this.width + x] = square;
        return true;
    }
    // Check if coordinates are valid
    isValidPosition(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }
    // Check if a square is walkable (not a wall)
    isWalkable(x, y) {
        const square = this.getSquare(x, y);
        return square ? !square.wall : false;
    }
}
exports.Room = Room;
__decorate([
    (0, schema_1.type)("number")
], Room.prototype, "width", void 0);
__decorate([
    (0, schema_1.type)("number")
], Room.prototype, "height", void 0);
__decorate([
    (0, schema_1.type)([DungeonSquare_1.DungeonSquare])
], Room.prototype, "squares", void 0);
__decorate([
    (0, schema_1.type)("string")
], Room.prototype, "entranceDirection", void 0);
__decorate([
    (0, schema_1.type)("number")
], Room.prototype, "entranceX", void 0);
__decorate([
    (0, schema_1.type)("number")
], Room.prototype, "entranceY", void 0);
__decorate([
    (0, schema_1.type)(["string"])
], Room.prototype, "exitDirections", void 0);
__decorate([
    (0, schema_1.type)(["number"])
], Room.prototype, "exitX", void 0);
__decorate([
    (0, schema_1.type)(["number"])
], Room.prototype, "exitY", void 0);
__decorate([
    (0, schema_1.type)("number")
], Room.prototype, "gridX", void 0);
__decorate([
    (0, schema_1.type)("number")
], Room.prototype, "gridY", void 0);
__decorate([
    (0, schema_1.type)(["number"])
], Room.prototype, "connectedRoomIndices", void 0);
__decorate([
    (0, schema_1.type)(["boolean"])
], Room.prototype, "exitConnected", void 0);
