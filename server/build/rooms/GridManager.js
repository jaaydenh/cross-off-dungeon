"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GridManager = void 0;
/**
 * GridManager handles the coordinate-based layout of rooms in the dungeon.
 * It manages room placement, connections, and validation of exit-entrance alignment.
 */
class GridManager {
    constructor() {
        this.roomGrid = new Map();
    }
    /**
     * Get the room index at specific grid coordinates
     * @param x Grid X coordinate
     * @param y Grid Y coordinate
     * @returns Room index or null if no room exists at coordinates
     */
    getRoomAt(x, y) {
        const key = `${x},${y}`;
        return this.roomGrid.get(key) ?? null;
    }
    /**
     * Set a room at specific grid coordinates
     * @param x Grid X coordinate
     * @param y Grid Y coordinate
     * @param roomIndex Index of the room to place
     */
    setRoomAt(x, y, roomIndex) {
        const key = `${x},${y}`;
        this.roomGrid.set(key, roomIndex);
    }
    /**
     * Get the adjacent room in a specific direction
     * @param x Current grid X coordinate
     * @param y Current grid Y coordinate
     * @param direction Direction to check ("north", "south", "east", "west")
     * @returns Room index of adjacent room or null if none exists
     */
    getAdjacentRoom(x, y, direction) {
        let targetX = x;
        let targetY = y;
        switch (direction.toLowerCase()) {
            case "north":
                targetY = y - 1; // North is negative Y (up on screen)
                break;
            case "south":
                targetY = y + 1; // South is positive Y (down on screen)
                break;
            case "east":
                targetX = x + 1;
                break;
            case "west":
                targetX = x - 1;
                break;
            default:
                return null; // Invalid direction
        }
        return this.getRoomAt(targetX, targetY);
    }
    /**
     * Validate that two rooms can be connected through their exits/entrances
     * @param room1 First room
     * @param room2 Second room
     * @param direction Direction from room1 to room2
     * @returns True if rooms can be connected, false otherwise
     */
    validateConnection(room1, room2, direction) {
        // Get the opposite direction for room2's entrance
        const oppositeDirection = this.getOppositeDirection(direction);
        // Check if room1 has an exit in the specified direction
        const room1HasExit = this.roomHasExitInDirection(room1, direction);
        // Check if room2 has an entrance from the opposite direction
        const room2HasEntrance = room2.entranceDirection === oppositeDirection;
        return room1HasExit && room2HasEntrance;
    }
    /**
     * Check if a room has an exit in a specific direction
     * @param room Room to check
     * @param direction Direction to check for exit
     * @returns True if room has exit in direction, false otherwise
     */
    roomHasExitInDirection(room, direction) {
        for (let i = 0; i < room.exitDirections.length; i++) {
            if (room.exitDirections[i] === direction) {
                return true;
            }
        }
        return false;
    }
    /**
     * Get the opposite direction
     * @param direction Original direction
     * @returns Opposite direction
     */
    getOppositeDirection(direction) {
        switch (direction.toLowerCase()) {
            case "north": return "south";
            case "south": return "north";
            case "east": return "west";
            case "west": return "east";
            default: return "none";
        }
    }
    /**
     * Get all room positions currently in the grid
     * @returns Array of {x, y, roomIndex} objects
     */
    getAllRoomPositions() {
        const positions = [];
        for (const [key, roomIndex] of this.roomGrid.entries()) {
            const [x, y] = key.split(',').map(Number);
            positions.push({ x, y, roomIndex });
        }
        return positions;
    }
    /**
     * Remove a room from the grid
     * @param x Grid X coordinate
     * @param y Grid Y coordinate
     * @returns True if room was removed, false if no room existed at coordinates
     */
    removeRoomAt(x, y) {
        const key = `${x},${y}`;
        return this.roomGrid.delete(key);
    }
    /**
     * Clear all rooms from the grid
     */
    clear() {
        this.roomGrid.clear();
    }
    /**
     * Get the total number of rooms in the grid
     * @returns Number of rooms
     */
    getRoomCount() {
        return this.roomGrid.size;
    }
    /**
     * Check if the grid has any rooms
     * @returns True if grid is empty, false otherwise
     */
    isEmpty() {
        return this.roomGrid.size === 0;
    }
}
exports.GridManager = GridManager;
