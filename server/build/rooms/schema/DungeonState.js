"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DungeonState = void 0;
const schema_1 = require("@colyseus/schema");
const Player_1 = require("./Player");
const DungeonSquare_1 = require("./DungeonSquare");
const Room_1 = require("./Room");
const NavigationValidator_1 = require("../NavigationValidator");
const BOARD_WIDTH = 4;
class DungeonState extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.players = new schema_1.MapSchema();
        this.board = new schema_1.MapSchema();
        this.rooms = new schema_1.ArraySchema();
        this.currentRoomIndex = 0;
        this.displayedRoomIndices = new schema_1.ArraySchema(); // Indices of rooms currently displayed
        this.roomPositionsX = new schema_1.ArraySchema(); // X positions of displayed rooms
        this.roomPositionsY = new schema_1.ArraySchema(); // Y positions of displayed rooms
        // Grid management properties
        this.gridOriginX = 0; // Starting grid position X
        this.gridOriginY = 0; // Starting grid position Y
        this.roomGridPositions = new schema_1.MapSchema(); // "x,y" -> roomIndex
        // Navigation validator for exit adjacency checking
        this.navigationValidator = new NavigationValidator_1.NavigationValidator();
    }
    initializeBoard() {
        console.log('initializeBoard');
        for (let x = 0; x < 4; x++) {
            for (let y = 0; y < 4; y++) {
                this.board.set(`${x},${y}`, new DungeonSquare_1.DungeonSquare());
            }
        }
        // Create the initial starting room
        this.createInitialRoom();
        // Initialize the displayed rooms array with the first room
        this.displayedRoomIndices.push(0);
        this.roomPositionsX.push(0); // First room is at position (0,0)
        this.roomPositionsY.push(0);
        // Assign grid coordinates to the first room at the origin
        this.assignGridCoordinates(0, this.gridOriginX, this.gridOriginY);
    }
    /**
     * Create the initial starting room
     */
    createInitialRoom() {
        const room = this.createNewRoom();
        room.generateExits(); // No entrance direction for the starting room
        this.rooms.push(room);
        this.currentRoomIndex = 0;
    }
    /**
     * Create a new room with random dimensions and wall placement
     * @param entranceDirection Optional entrance direction for the room
     * @returns A new Room instance
     */
    createNewRoom(entranceDirection) {
        // Generate random dimensions
        const width = Math.floor(Math.random() * 3) + 6; // 6-8
        const height = Math.floor(Math.random() * 3) + 4; // 4-6
        const room = new Room_1.Room(width, height);
        // Add random inner walls
        this.addRandomWalls(room);
        // Generate exits with entrance direction if provided
        if (entranceDirection) {
            room.generateExits(entranceDirection);
        }
        return room;
    }
    /**
     * Add random walls to a room, avoiding entrance and exit areas
     * @param room The room to add walls to
     */
    addRandomWalls(room) {
        const numInnerWalls = Math.floor(Math.random() * (room.width * room.height / 10));
        for (let i = 0; i < numInnerWalls; i++) {
            const x = Math.floor(Math.random() * room.width);
            const y = Math.floor(Math.random() * room.height);
            // Skip if this would be adjacent to an entrance or exit
            if (this.isAdjacentToEntranceOrExit(room, x, y)) {
                continue;
            }
            const square = room.getSquare(x, y);
            if (square) {
                square.wall = true;
            }
        }
    }
    getCurrentRoom() {
        return this.rooms[this.currentRoomIndex];
    }
    // Add a new room when a player exits through an exit from any room
    addNewRoomFromExit(fromRoomIndex, exitDirection, exitIndex) {
        // Get the source room
        const sourceRoom = this.rooms[fromRoomIndex];
        if (!sourceRoom) {
            console.error("Source room not found:", fromRoomIndex);
            return;
        }
        // Get source room's grid coordinates
        const sourceCoords = this.getGridCoordinates(fromRoomIndex);
        if (!sourceCoords) {
            console.error("Source room has no grid coordinates assigned");
            return;
        }
        // Calculate target grid coordinates based on exit direction
        let targetX = sourceCoords.x;
        let targetY = sourceCoords.y;
        switch (exitDirection) {
            case "north":
                targetY = sourceCoords.y - 1; // North is negative Y (up on screen)
                break;
            case "south":
                targetY = sourceCoords.y + 1; // South is positive Y (down on screen)
                break;
            case "east":
                targetX = sourceCoords.x + 1; // East is positive X
                break;
            case "west":
                targetX = sourceCoords.x - 1; // West is negative X
                break;
            default:
                console.error("Invalid exit direction:", exitDirection);
                return;
        }
        // Check if a room already exists at target coordinates
        const gridKey = `${targetX},${targetY}`;
        const existingRoomIndex = this.roomGridPositions.get(gridKey);
        let targetRoomIndex;
        let targetRoom;
        if (existingRoomIndex !== undefined) {
            // Room already exists at target coordinates - connect to it
            targetRoomIndex = existingRoomIndex;
            targetRoom = this.rooms[targetRoomIndex];
            console.log(`Connecting to existing room ${targetRoomIndex} at grid (${targetX}, ${targetY})`);
            // Establish bidirectional connection
            this.establishConnection(fromRoomIndex, exitIndex, targetRoomIndex, exitDirection);
        }
        else {
            // No room exists - create a new room with real-time generation
            const entranceDirection = this.getOppositeDirection(exitDirection);
            const newRoom = this.createNewRoom(entranceDirection);
            // Add the new room to the rooms array
            targetRoomIndex = this.rooms.length;
            this.rooms.push(newRoom);
            targetRoom = newRoom;
            // Assign proper grid coordinates to the new room
            this.assignGridCoordinates(targetRoomIndex, targetX, targetY);
            console.log(`Created new room ${targetRoomIndex} at grid (${targetX}, ${targetY}) with entrance from ${entranceDirection}`);
            // Establish connection from source room to new room
            this.establishConnection(fromRoomIndex, exitIndex, targetRoomIndex, exitDirection);
        }
        // Add room to displayed rooms if not already displayed
        if (!this.displayedRoomIndices.includes(targetRoomIndex)) {
            this.displayedRoomIndices.push(targetRoomIndex);
            // Calculate display position based on grid coordinates
            // Convert grid coordinates to display positions
            const displayX = targetX - this.gridOriginX;
            const displayY = targetY - this.gridOriginY;
            this.roomPositionsX.push(displayX);
            this.roomPositionsY.push(displayY);
        }
        // Update the current room index to the target room
        this.currentRoomIndex = targetRoomIndex;
        return targetRoom;
    }
    // Add a new room when a player exits through an exit (legacy method for backward compatibility)
    addNewRoom(exitDirection, exitIndex) {
        return this.addNewRoomFromExit(this.currentRoomIndex, exitDirection, exitIndex);
    }
    createPlayer(id, name) {
        this.players.set(id, new Player_1.Player(name));
    }
    removePlayer(id) {
        this.players.delete(id);
    }
    crossSquare(client, data) {
        const player = this.players.get(client.sessionId);
        // If a specific room index was provided, use that room instead of the current room
        const roomIndex = data.roomIndex !== undefined ? data.roomIndex : this.currentRoomIndex;
        const room = this.rooms[roomIndex];
        if (!client.sessionId || !room) {
            return { success: false, error: "Invalid client or room" };
        }
        const { x, y } = data;
        // Check if the coordinates are valid for the specified room
        if (!room.isValidPosition(x, y)) {
            return { success: false, error: "Invalid coordinates" };
        }
        const square = room.getSquare(x, y);
        // Only allow crossing squares that are not walls
        if (!square || square.wall) {
            return { success: false, error: "Cannot cross wall squares" };
        }
        // Check if this is an exit square
        if (square.exit) {
            // Find which exit was clicked
            let exitIndex = -1;
            for (let i = 0; i < room.exitX.length; i++) {
                if (room.exitX[i] === x && room.exitY[i] === y) {
                    exitIndex = i;
                    break;
                }
            }
            if (exitIndex !== -1) {
                // Validate exit navigation using NavigationValidator
                const canNavigate = this.navigationValidator.canNavigateToExit(room, exitIndex);
                if (!canNavigate) {
                    return {
                        success: false,
                        error: "Cannot navigate through exit: no crossed squares orthogonally adjacent to exit"
                    };
                }
                // Navigation is valid - cross the square and process exit
                square.checked = true;
                console.log(player?.name, "crosses exit square", x, y, "in room", roomIndex);
                // Get the direction of the exit
                const exitDirection = room.exitDirections[exitIndex];
                // Add a new room in that direction (works for any room index now)
                this.addNewRoomFromExit(roomIndex, exitDirection, exitIndex);
                return { success: true, message: "Exit navigation successful" };
            }
        }
        // Regular square crossing (not an exit)
        square.checked = true;
        console.log(player?.name, "crosses square", x, y, "in room", roomIndex);
        return { success: true, message: "Square crossed successfully" };
    }
    // Helper method to check if coordinates are adjacent to entrance or exit
    isAdjacentToEntranceOrExit(room, x, y) {
        // Check if this is near an entrance
        if (room.entranceX !== -1 && room.entranceY !== -1) {
            if ((Math.abs(x - room.entranceX) <= 1 && y === room.entranceY) ||
                (Math.abs(y - room.entranceY) <= 1 && x === room.entranceX)) {
                return true;
            }
        }
        // Check if this is near any exit
        for (let i = 0; i < room.exitX.length; i++) {
            const exitX = room.exitX[i];
            const exitY = room.exitY[i];
            if ((Math.abs(x - exitX) <= 1 && y === exitY) ||
                (Math.abs(y - exitY) <= 1 && x === exitX)) {
                return true;
            }
        }
        return false;
    }
    // Grid management methods
    /**
     * Assign grid coordinates to a room and update the room's grid properties
     * @param roomIndex Index of the room in the rooms array
     * @param x Grid X coordinate
     * @param y Grid Y coordinate
     */
    assignGridCoordinates(roomIndex, x, y) {
        if (roomIndex < 0 || roomIndex >= this.rooms.length) {
            return; // Invalid room index
        }
        const room = this.rooms[roomIndex];
        if (!room) {
            return;
        }
        // Update the room's grid coordinates
        room.gridX = x;
        room.gridY = y;
        // Update the grid position mapping
        const gridKey = `${x},${y}`;
        this.roomGridPositions.set(gridKey, roomIndex);
    }
    /**
     * Get the grid coordinates for a room
     * @param roomIndex Index of the room in the rooms array
     * @returns Grid coordinates or null if room doesn't exist
     */
    getGridCoordinates(roomIndex) {
        if (roomIndex < 0 || roomIndex >= this.rooms.length) {
            return null; // Invalid room index
        }
        const room = this.rooms[roomIndex];
        if (!room) {
            return null;
        }
        return {
            x: room.gridX,
            y: room.gridY
        };
    }
    /**
     * Find an existing room at adjacent coordinates or create a new one
     * @param currentX Current grid X coordinate
     * @param currentY Current grid Y coordinate
     * @param direction Direction to look for adjacent room ("north", "south", "east", "west")
     * @returns Room index of the adjacent room (existing or newly created)
     */
    findOrCreateAdjacentRoom(currentX, currentY, direction) {
        // Calculate target coordinates based on direction
        let targetX = currentX;
        let targetY = currentY;
        switch (direction) {
            case "north":
                targetY = currentY - 1; // North is negative Y (up on screen)
                break;
            case "south":
                targetY = currentY + 1; // South is positive Y (down on screen)
                break;
            case "east":
                targetX = currentX + 1; // East is positive X
                break;
            case "west":
                targetX = currentX - 1; // West is negative X
                break;
            default:
                return -1; // Invalid direction
        }
        // Check if a room already exists at the target coordinates
        const gridKey = `${targetX},${targetY}`;
        const existingRoomIndex = this.roomGridPositions.get(gridKey);
        if (existingRoomIndex !== undefined) {
            // Room already exists at target coordinates
            return existingRoomIndex;
        }
        // No room exists - create a new one with real-time generation
        const entranceDirection = this.getOppositeDirection(direction);
        const newRoom = this.createNewRoom(entranceDirection);
        // Add the new room to the rooms array
        const newRoomIndex = this.rooms.length;
        this.rooms.push(newRoom);
        // Assign grid coordinates to the new room
        this.assignGridCoordinates(newRoomIndex, targetX, targetY);
        console.log(`Created new room ${newRoomIndex} with entrance from ${entranceDirection}`);
        return newRoomIndex;
    }
    /**
     * Establish a connection between two rooms through their exits
     * @param fromRoomIndex Index of the room with the exit
     * @param exitIndex Index of the exit in the from room
     * @param toRoomIndex Index of the target room
     * @param direction Direction of the connection
     */
    establishConnection(fromRoomIndex, exitIndex, toRoomIndex, direction) {
        const fromRoom = this.rooms[fromRoomIndex];
        const toRoom = this.rooms[toRoomIndex];
        if (!fromRoom || !toRoom) {
            console.error("Invalid room indices for connection:", fromRoomIndex, toRoomIndex);
            return;
        }
        // Update the from room's connection tracking
        if (exitIndex >= 0 && exitIndex < fromRoom.connectedRoomIndices.length) {
            fromRoom.connectedRoomIndices[exitIndex] = toRoomIndex;
            fromRoom.exitConnected[exitIndex] = true;
            console.log(`Connected room ${fromRoomIndex} exit ${exitIndex} to room ${toRoomIndex}`);
        }
        else {
            console.warn(`Invalid exit index ${exitIndex} for room ${fromRoomIndex}`);
        }
        // Find the corresponding entrance in the target room and establish reverse connection
        const oppositeDirection = this.getOppositeDirection(direction);
        // Look for an exit in the target room that faces back to the source room
        let reverseConnectionEstablished = false;
        for (let i = 0; i < toRoom.exitDirections.length; i++) {
            if (toRoom.exitDirections[i] === oppositeDirection) {
                // Found matching exit in target room - establish reverse connection
                toRoom.connectedRoomIndices[i] = fromRoomIndex;
                toRoom.exitConnected[i] = true;
                console.log(`Established reverse connection from room ${toRoomIndex} exit ${i} to room ${fromRoomIndex}`);
                reverseConnectionEstablished = true;
                break;
            }
        }
        // If no reverse exit exists, create one to ensure bidirectional connectivity
        if (!reverseConnectionEstablished) {
            console.log(`No reverse exit found in room ${toRoomIndex}, creating exit in ${oppositeDirection} direction`);
            toRoom.createExit(oppositeDirection);
            // Connect the newly created exit
            const newExitIndex = toRoom.exitDirections.length - 1;
            toRoom.connectedRoomIndices[newExitIndex] = fromRoomIndex;
            toRoom.exitConnected[newExitIndex] = true;
            console.log(`Created and connected reverse exit from room ${toRoomIndex} to room ${fromRoomIndex}`);
        }
    }
    /**
     * Get the opposite direction for entrance/exit alignment
     * @param direction Original direction
     * @returns Opposite direction
     */
    getOppositeDirection(direction) {
        switch (direction) {
            case "north": return "south";
            case "south": return "north";
            case "east": return "west";
            case "west": return "east";
            default: return "none";
        }
    }
}
exports.DungeonState = DungeonState;
__decorate([
    (0, schema_1.type)({ map: Player_1.Player })
], DungeonState.prototype, "players", void 0);
__decorate([
    (0, schema_1.type)({ map: DungeonSquare_1.DungeonSquare })
], DungeonState.prototype, "board", void 0);
__decorate([
    (0, schema_1.type)([Room_1.Room])
], DungeonState.prototype, "rooms", void 0);
__decorate([
    (0, schema_1.type)("number")
], DungeonState.prototype, "currentRoomIndex", void 0);
__decorate([
    (0, schema_1.type)(["number"])
], DungeonState.prototype, "displayedRoomIndices", void 0);
__decorate([
    (0, schema_1.type)(["number"])
], DungeonState.prototype, "roomPositionsX", void 0);
__decorate([
    (0, schema_1.type)(["number"])
], DungeonState.prototype, "roomPositionsY", void 0);
__decorate([
    (0, schema_1.type)("number")
], DungeonState.prototype, "gridOriginX", void 0);
__decorate([
    (0, schema_1.type)("number")
], DungeonState.prototype, "gridOriginY", void 0);
__decorate([
    (0, schema_1.type)({ map: "number" })
], DungeonState.prototype, "roomGridPositions", void 0);
