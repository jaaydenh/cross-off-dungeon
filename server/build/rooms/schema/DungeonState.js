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
const MonsterCard_1 = require("./MonsterCard");
const MonsterFactory_1 = require("../MonsterFactory");
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
        // Monster deck and management
        this.monsterDeck = new schema_1.ArraySchema();
        this.activeMonsters = new schema_1.ArraySchema(); // Monsters currently on the board or with players
        // Grid management properties
        this.gridOriginX = 0; // Starting grid position X
        this.gridOriginY = 0; // Starting grid position Y
        this.roomGridPositions = new schema_1.MapSchema(); // "x,y" -> roomIndex
        // Turn management properties
        this.currentTurn = 1;
        this.turnInProgress = false;
        this.turnOrder = new schema_1.ArraySchema(); // Player session IDs
        // Card-based square selection tracking
        this.activeCardPlayers = new schema_1.MapSchema(); // sessionId -> cardId
        // NOTE: These can grow quickly and are frequently mutated; keeping them inside Schema maps
        // has caused serialization issues (msgpackr RangeError: ERR_BUFFER_OUT_OF_BOUNDS) when sending
        // state patches under load / rapid interactions.
        //
        // They are server-side bookkeeping only, so we keep them as plain JS Maps (non-schema).
        // Selection format (semicolon-delimited):
        // - Room square:   "r:<roomIndex>:<x>,<y>"
        // - Monster square:"m:<monsterId>:<x>,<y>"
        this.selectedSquares = new Map(); // sessionId -> selections string
        this.selectedSquareCount = new Map(); // sessionId -> count
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
        // Initialize monster deck
        this.initializeMonsterDeck();
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
     * Initialize the monster deck with shuffled monsters
     */
    initializeMonsterDeck() {
        console.log('Initializing monster deck');
        const monsters = MonsterFactory_1.MonsterFactory.createMonsterDeck();
        monsters.forEach(monster => this.monsterDeck.push(monster));
        console.log(`Monster deck initialized with ${this.monsterDeck.length} monsters`);
    }
    /**
     * Draw a monster from the deck when a new room is opened
     * @returns The drawn monster card or null if deck is empty
     */
    drawMonsterCard() {
        if (this.monsterDeck.length === 0) {
            console.log('No monsters left in deck');
            return null;
        }
        const monster = this.monsterDeck.shift();
        if (monster) {
            this.activeMonsters.push(monster);
            console.log(`Drew monster: ${monster.name} (${monster.id})`);
        }
        return monster || null;
    }
    /**
     * Create the initial starting room
     */
    createInitialRoom() {
        const room = this.createNewRoom();
        room.generateExits(); // No entrance direction for the starting room
        // Add an entrance to the first room (players need a way to enter)
        room.createEntrance("south"); // Create entrance from the south
        this.rooms.push(room);
        this.currentRoomIndex = 0;
        // Draw a monster for the initial room too
        const monster = this.drawMonsterCard();
        if (monster) {
            monster.connectedToRoomIndex = 0;
            console.log(`Assigned monster ${monster.name} to initial room 0`);
        }
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
            // Draw a monster for the new room
            const monster = this.drawMonsterCard();
            if (monster) {
                monster.connectedToRoomIndex = targetRoomIndex;
                console.log(`Assigned monster ${monster.name} to new room ${targetRoomIndex}`);
            }
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
        // Add player to turn order if turn system is active
        this.addPlayerToTurnOrder(id);
    }
    removePlayer(id) {
        this.players.delete(id);
        // Clean up any in-progress card action state for this session.
        this.activeCardPlayers.delete(id);
        this.selectedSquares.delete(id);
        this.selectedSquareCount.delete(id);
        // Remove player from turn order
        this.removePlayerFromTurnOrder(id);
    }
    crossSquare(client, data) {
        const player = this.players.get(client.sessionId);
        if (!player) {
            return { success: false, error: "Player not found" };
        }
        // If a specific room index was provided, use that room instead of the current room
        const roomIndex = data.roomIndex !== undefined ? data.roomIndex : this.currentRoomIndex;
        if (!client.sessionId) {
            return { success: false, error: "Invalid client" };
        }
        const { x, y } = data;
        // Always require an active card; actual crossing happens on confirm.
        const activeCardId = this.activeCardPlayers.get(client.sessionId);
        if (!activeCardId) {
            return { success: false, error: "You need an active card to cross squares" };
        }
        // Do not allow mixing monster + room selections in a single card action.
        const existing = this.parseSelections(this.selectedSquares.get(client.sessionId) || "");
        if (existing.some((s) => s.kind === "monster")) {
            return { success: false, error: "Cannot mix monster and room selections in the same card action", invalidSquare: true };
        }
        return this.selectSquareForCard(client.sessionId, roomIndex, x, y);
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
    // Turn management methods
    /**
     * Initialize turn state for all players when the game starts
     * Sets up turn order and resets all player statuses
     */
    initializeTurnState() {
        // Clear existing turn order
        this.turnOrder.clear();
        // Add all current players to turn order
        this.players.forEach((player, sessionId) => {
            this.turnOrder.push(sessionId);
            // Reset player turn status
            player.turnStatus = "not_started";
            player.hasDrawnCard = false;
        });
        // Initialize turn state
        this.currentTurn = 1;
        this.turnInProgress = true;
        console.log(`Turn state initialized for ${this.turnOrder.length} players`);
    }
    /**
     * Add a player to the turn order when they join
     * @param sessionId Session ID of the player to add
     */
    addPlayerToTurnOrder(sessionId) {
        if (!this.turnOrder.includes(sessionId)) {
            this.turnOrder.push(sessionId);
            console.log(`Added player ${sessionId} to turn order`);
        }
    }
    /**
     * Remove a player from the turn order when they leave
     * @param sessionId Session ID of the player to remove
     */
    removePlayerFromTurnOrder(sessionId) {
        const index = this.turnOrder.indexOf(sessionId);
        if (index !== -1) {
            this.turnOrder.splice(index, 1);
            console.log(`Removed player ${sessionId} from turn order`);
            // Check if we need to advance turn after player removal
            if (this.turnInProgress && this.areAllPlayersReady()) {
                this.advanceTurn();
            }
        }
    }
    /**
     * Check if all players have completed their turns
     * @returns True if all players have status "turn_complete"
     */
    areAllPlayersReady() {
        if (this.turnOrder.length === 0) {
            return false;
        }
        for (const sessionId of this.turnOrder) {
            const player = this.players.get(sessionId);
            if (!player || player.turnStatus !== "turn_complete") {
                return false;
            }
        }
        return true;
    }
    /**
     * Advance to the next turn round when all players are ready
     * Resets all player statuses and increments turn counter
     */
    advanceTurn() {
        if (!this.areAllPlayersReady()) {
            console.log("Cannot advance turn: not all players are ready");
            return;
        }
        // Reset all player statuses for the new turn
        this.players.forEach((player) => {
            player.turnStatus = "not_started";
            player.hasDrawnCard = false;
        });
        // Increment turn counter
        this.currentTurn++;
        console.log(`Advanced to turn ${this.currentTurn}`);
    }
    /**
     * Update a player's turn status
     * @param sessionId Session ID of the player
     * @param status New turn status
     * @returns True if status was updated successfully
     */
    updatePlayerTurnStatus(sessionId, status) {
        const player = this.players.get(sessionId);
        if (!player) {
            console.error(`Player ${sessionId} not found`);
            return false;
        }
        // Validate status transition
        if (!this.isValidStatusTransition(player.turnStatus, status)) {
            console.error(`Invalid status transition from ${player.turnStatus} to ${status} for player ${sessionId}`);
            return false;
        }
        player.turnStatus = status;
        console.log(`Player ${sessionId} status updated to ${status}`);
        // Check if we should advance turn after this status update
        if (status === "turn_complete" && this.areAllPlayersReady()) {
            this.advanceTurn();
        }
        return true;
    }
    /**
     * Validate if a status transition is allowed
     * @param currentStatus Current player status
     * @param newStatus New status to transition to
     * @returns True if transition is valid
     */
    isValidStatusTransition(currentStatus, newStatus) {
        switch (currentStatus) {
            case "not_started":
                return newStatus === "playing_turn";
            case "playing_turn":
                return newStatus === "turn_complete";
            case "turn_complete":
                return newStatus === "not_started"; // Only allowed during turn advancement
            default:
                return false;
        }
    }
    /**
     * Get the current turn status summary
     * @returns Object with turn information and player statuses
     */
    getTurnStatus() {
        const playerStatuses = {};
        let playersReady = 0;
        this.players.forEach((player, sessionId) => {
            playerStatuses[sessionId] = player.turnStatus;
            if (player.turnStatus === "turn_complete") {
                playersReady++;
            }
        });
        return {
            currentTurn: this.currentTurn,
            turnInProgress: this.turnInProgress,
            totalPlayers: this.turnOrder.length,
            playersReady,
            playerStatuses
        };
    }
    /**
     * Check if a player can perform a specific action based on their turn status
     * @param sessionId Session ID of the player
     * @param action Action the player wants to perform
     * @returns True if action is allowed
     */
    canPlayerPerformAction(sessionId, action) {
        const player = this.players.get(sessionId);
        if (!player || !this.turnInProgress) {
            return false;
        }
        switch (action) {
            case "drawCard":
                return player.turnStatus === "not_started" && !player.hasDrawnCard;
            case "playCard":
                return player.turnStatus === "playing_turn" && player.hasDrawnCard;
            case "endTurn":
                return player.turnStatus === "playing_turn" && !this.activeCardPlayers.has(sessionId);
            default:
                return false;
        }
    }
    /**
     * Draw a card from the player's deck to their drawn cards
     * @param sessionId Session ID of the player
     * @returns Result object with success status and message
     */
    drawCard(sessionId) {
        const player = this.players.get(sessionId);
        if (!player) {
            return { success: false, error: "Player not found" };
        }
        // Validate that the player can draw a card
        if (!this.canPlayerPerformAction(sessionId, "drawCard")) {
            return {
                success: false,
                error: "Cannot draw card: either not your turn, already drawn a card this turn, or turn not in progress"
            };
        }
        // Check if deck has cards
        if (player.deck.length === 0) {
            return { success: false, error: "No cards left in deck" };
        }
        // Move top card from deck to drawnCards
        const drawnCard = player.deck.shift(); // Remove first card from deck
        if (drawnCard) {
            player.drawnCards.push(drawnCard);
            // Update player status
            player.hasDrawnCard = true;
            player.turnStatus = "playing_turn";
            console.log(`Player ${sessionId} drew card: ${drawnCard.id}`);
            return {
                success: true,
                message: `Drew card: ${drawnCard.description}`
            };
        }
        return { success: false, error: "Failed to draw card" };
    }
    /**
     * Activate a drawn card for square selection
     * @param sessionId Session ID of the player
     * @param cardId ID of the card to activate
     * @returns Result object with success status and message
     */
    playCard(sessionId, cardId) {
        const player = this.players.get(sessionId);
        if (!player) {
            return { success: false, error: "Player not found" };
        }
        // Validate that the player can play a card
        if (!this.canPlayerPerformAction(sessionId, "playCard")) {
            return {
                success: false,
                error: "Cannot play card: not in playing turn state or haven't drawn a card"
            };
        }
        // Find the card in drawn cards
        const cardIndex = player.drawnCards.findIndex(card => card.id === cardId);
        if (cardIndex === -1) {
            return { success: false, error: "Card not found in drawn cards" };
        }
        const card = player.drawnCards[cardIndex];
        // Check if player already has an active card
        if (this.activeCardPlayers.has(sessionId)) {
            return { success: false, error: "Player already has an active card" };
        }
        // Activate the card
        card.isActive = true;
        this.activeCardPlayers.set(sessionId, cardId);
        this.clearSelections(sessionId);
        console.log(`Player ${sessionId} activated card: ${cardId}`);
        // If a card targets "every monster" and the player has no eligible monsters, auto-discard it.
        if (this.cardIsMonsterEach(card)) {
            const eligibleMonsters = this.getPlayerMonsters(sessionId).filter((m) => !m.isCompleted());
            if (eligibleMonsters.length === 0) {
                const completed = this.completeCardAction(sessionId, []);
                return { success: completed.success, message: "No eligible monsters. Card discarded." };
            }
        }
        return {
            success: true,
            message: `Activated card: ${card.description}.`
        };
    }
    getActiveCard(sessionId) {
        const activeCardId = this.activeCardPlayers.get(sessionId);
        if (!activeCardId)
            return null;
        const player = this.players.get(sessionId);
        if (!player)
            return null;
        return player.drawnCards.find((card) => card.id === activeCardId) || null;
    }
    cardAllowsRoom(card) {
        return card.selectionTarget === "room" || card.selectionTarget === "room_or_monster";
    }
    cardAllowsMonster(card) {
        return (card.selectionTarget === "monster" ||
            card.selectionTarget === "room_or_monster" ||
            card.selectionTarget === "monster_each");
    }
    cardIsMonsterEach(card) {
        return card.selectionTarget === "monster_each";
    }
    getSelections(sessionId) {
        const selectionsString = this.selectedSquares.get(sessionId) || "";
        return this.parseSelections(selectionsString);
    }
    serializeSelections(selections) {
        if (selections.length === 0)
            return "";
        return selections
            .map((sel) => {
            if (sel.kind === "room") {
                return `r:${sel.roomIndex}:${sel.x},${sel.y}`;
            }
            return `m:${sel.monsterId}:${sel.x},${sel.y}`;
        })
            .join(";");
    }
    setSelections(sessionId, selections) {
        const serialized = this.serializeSelections(selections);
        this.selectedSquares.set(sessionId, serialized);
        this.selectedSquareCount.set(sessionId, selections.length);
    }
    clearSelections(sessionId) {
        this.selectedSquares.delete(sessionId);
        this.selectedSquareCount.delete(sessionId);
    }
    getExitIndexAtCoordinates(room, x, y) {
        for (let i = 0; i < room.exitX.length; i++) {
            if (room.exitX[i] === x && room.exitY[i] === y) {
                return i;
            }
        }
        return -1;
    }
    crossRoomSquare(sessionId, roomIndex, x, y, crossedExits) {
        const room = this.rooms[roomIndex];
        if (!room)
            return;
        const square = room.getSquare(x, y);
        if (!square)
            return;
        square.checked = true;
        if (!square.exit) {
            console.log(`Crossed square ${x},${y} in room ${roomIndex} for player ${sessionId}`);
            return;
        }
        const exitIndex = this.getExitIndexAtCoordinates(room, x, y);
        if (exitIndex !== -1) {
            crossedExits.push({ roomIndex, exitIndex });
            console.log(`Crossed exit square ${x},${y} in room ${roomIndex} for player ${sessionId}`);
            return;
        }
        console.log(`Crossed square ${x},${y} in room ${roomIndex} for player ${sessionId}`);
    }
    resolveCrossedExits(crossedExits) {
        const seenExits = new Set();
        for (const { roomIndex, exitIndex } of crossedExits) {
            const key = `${roomIndex}:${exitIndex}`;
            if (seenExits.has(key))
                continue;
            seenExits.add(key);
            const room = this.rooms[roomIndex];
            if (!room)
                continue;
            const exitDirection = room.exitDirections[exitIndex];
            this.addNewRoomFromExit(roomIndex, exitDirection, exitIndex);
        }
    }
    /**
     * Handle square selection during card-based play
     * @param sessionId Session ID of the player
     * @param roomIndex Index of the room containing the square
     * @param x X coordinate of the square
     * @param y Y coordinate of the square
     * @returns Result object with success status and message
     */
    selectSquareForCard(sessionId, roomIndex, x, y) {
        const player = this.players.get(sessionId);
        if (!player) {
            return { success: false, error: "Player not found" };
        }
        const card = this.getActiveCard(sessionId);
        if (!card) {
            return { success: false, error: "No active card for player" };
        }
        if (!this.cardAllowsRoom(card)) {
            return { success: false, error: "Active card does not allow room selection", invalidSquare: true };
        }
        const currentSelections = this.getSelections(sessionId);
        const roomSelections = currentSelections.filter((s) => s.kind === "room");
        const monsterSelections = currentSelections.filter((s) => s.kind === "monster");
        if (monsterSelections.length > 0) {
            return { success: false, error: "Cannot mix monster and room selections in the same card action", invalidSquare: true };
        }
        if (roomSelections.length > 0 && roomSelections.some((sel) => sel.roomIndex !== roomIndex)) {
            return { success: false, error: "Cannot select squares from multiple rooms in the same card action", invalidSquare: true };
        }
        // Get the room
        const room = this.rooms[roomIndex];
        if (!room) {
            return { success: false, error: "Invalid room index" };
        }
        // Validate coordinates
        if (!room.isValidPosition(x, y)) {
            return { success: false, error: "Invalid coordinates" };
        }
        const square = room.getSquare(x, y);
        if (!square || square.wall) {
            return { success: false, error: "Cannot select wall squares", invalidSquare: true };
        }
        const selectionMode = card.selectionMode || "squares";
        if (selectionMode === "horizontal_pair_twice") {
            const rightX = x + 1;
            const rightY = y;
            if (!room.isValidPosition(rightX, rightY)) {
                return {
                    success: false,
                    error: "Horizontal pair must fully fit inside the room",
                    invalidSquare: true
                };
            }
            const leftSquare = room.getSquare(x, y);
            const rightSquare = room.getSquare(rightX, rightY);
            if (!leftSquare || !rightSquare || leftSquare.wall || rightSquare.wall) {
                return {
                    success: false,
                    error: "Cannot place horizontal pair on wall squares",
                    invalidSquare: true
                };
            }
            if (leftSquare.checked || rightSquare.checked) {
                return {
                    success: false,
                    error: "Cannot place horizontal pair on already crossed squares",
                    invalidSquare: true
                };
            }
            const hasRequiredAdjacency = this.isAdjacentToEntranceOrCrossedSquare(room, x, y) ||
                this.isAdjacentToEntranceOrCrossedSquare(room, rightX, rightY);
            if (!hasRequiredAdjacency) {
                return {
                    success: false,
                    error: "At least one square in the pair must be adjacent to the entrance or an existing crossed square",
                    invalidSquare: true
                };
            }
            const alreadySelected = roomSelections.some((pos) => pos.roomIndex === roomIndex && pos.x === x && pos.y === y) ||
                roomSelections.some((pos) => pos.roomIndex === roomIndex && pos.x === rightX && pos.y === rightY);
            if (alreadySelected) {
                return { success: false, error: "Square already selected", invalidSquare: true };
            }
            const pairSelections = [
                { kind: "room", roomIndex, x, y },
                { kind: "room", roomIndex, x: rightX, y: rightY }
            ];
            const crossedExits = [];
            for (const selection of pairSelections) {
                this.crossRoomSquare(sessionId, selection.roomIndex, selection.x, selection.y, crossedExits);
            }
            this.resolveCrossedExits(crossedExits);
            const updatedSelections = [...currentSelections, ...pairSelections];
            this.setSelections(sessionId, updatedSelections);
            const placementsCompleted = Math.floor(updatedSelections.length / 2);
            if (placementsCompleted >= 2) {
                const completed = this.completeCardAction(sessionId, []);
                if (!completed.success) {
                    return completed;
                }
                return {
                    ...completed,
                    message: "Second horizontal pair crossed. Card action completed."
                };
            }
            return {
                success: true,
                message: "First horizontal pair crossed. Place one more horizontal pair.",
                completed: false
            };
        }
        if (selectionMode === "row") {
            if (square.checked) {
                return { success: false, error: "Square already crossed", invalidSquare: true };
            }
            if (card.requiresRoomStartAdjacency && !this.isValidStartingSquare(room, x, y)) {
                return {
                    success: false,
                    error: "Row must start at the entrance, adjacent to the entrance, or adjacent to an existing crossed square",
                    invalidSquare: true
                };
            }
            const rowSelections = [];
            for (let checkX = 0; checkX < room.width; checkX++) {
                const rowSquare = room.getSquare(checkX, y);
                if (!rowSquare || rowSquare.wall)
                    continue;
                if (rowSquare.checked)
                    continue;
                rowSelections.push({ kind: "room", roomIndex, x: checkX, y });
            }
            if (rowSelections.length === 0) {
                return { success: false, error: "No available squares in that row", invalidSquare: true };
            }
            this.setSelections(sessionId, rowSelections);
            console.log(`Player ${sessionId} selected row ${y} in room ${roomIndex} (${rowSelections.length})`);
            return {
                success: true,
                message: `Row selected (${rowSelections.length}). Use confirm button to commit move.`,
                completed: false
            };
        }
        // Squares mode
        if (square.checked) {
            return { success: false, error: "Square already crossed", invalidSquare: true };
        }
        // Check if this square is already selected
        const alreadySelected = roomSelections.some(pos => pos.roomIndex === roomIndex && pos.x === x && pos.y === y);
        if (alreadySelected) {
            return { success: false, error: "Square already selected", invalidSquare: true };
        }
        const maxSelections = card.maxSelections || 0;
        if (maxSelections > 0 && roomSelections.length >= maxSelections) {
            return {
                success: false,
                error: `Maximum of ${maxSelections} squares can be selected per card`,
                invalidSquare: true
            };
        }
        if (card.requiresConnected && roomSelections.length > 0) {
            const isConnected = this.isSquareConnectedToSelection(roomIndex, x, y, roomSelections, room);
            if (!isConnected) {
                return { success: false, error: "Square must be orthogonally connected to selected squares", invalidSquare: true };
            }
        }
        else if (roomSelections.length === 0 && card.requiresRoomStartAdjacency) {
            const isValidStart = this.isValidStartingSquare(room, x, y);
            if (!isValidStart) {
                return {
                    success: false,
                    error: "First square must be the entrance, adjacent to the entrance, or adjacent to an existing crossed square",
                    invalidSquare: true
                };
            }
        }
        const updatedSelections = [...currentSelections, { kind: "room", roomIndex, x, y }];
        this.setSelections(sessionId, updatedSelections);
        const newCount = roomSelections.length + 1;
        const maxLabel = maxSelections > 0 ? `/${maxSelections}` : "";
        console.log(`Player ${sessionId} selected square ${x},${y} in room ${roomIndex} (${newCount})`);
        return {
            success: true,
            message: `Square selected (${newCount}${maxLabel}). Use confirm button to commit move.`,
            completed: false
        };
    }
    /**
     * Check if a square is connected to the current selection
     */
    isSquareConnectedToSelection(roomIndex, x, y, selectedPositions, room) {
        // Check if the square is orthogonally adjacent to any selected square in the same room
        for (const pos of selectedPositions) {
            if (pos.roomIndex === roomIndex) {
                const dx = Math.abs(x - pos.x);
                const dy = Math.abs(y - pos.y);
                // Orthogonally adjacent means exactly one coordinate differs by 1
                if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
                    return true;
                }
            }
        }
        return false;
    }
    isAdjacentToEntranceOrCrossedSquare(room, x, y) {
        const isOrthAdjacent = (ax, ay, bx, by) => (Math.abs(ax - bx) === 1 && ay === by) || (Math.abs(ay - by) === 1 && ax === bx);
        if (room.entranceX !== -1 && room.entranceY !== -1) {
            if (isOrthAdjacent(x, y, room.entranceX, room.entranceY)) {
                return true;
            }
        }
        for (let checkY = 0; checkY < room.height; checkY++) {
            for (let checkX = 0; checkX < room.width; checkX++) {
                const square = room.getSquare(checkX, checkY);
                if (square?.checked && isOrthAdjacent(x, y, checkX, checkY)) {
                    return true;
                }
            }
        }
        return false;
    }
    /**
     * Check if a square is a valid starting position (entrance, adjacent to entrance, or adjacent to existing crossed square)
     */
    isValidStartingSquare(room, x, y) {
        // For the first square of a card action, allow placement on the entrance square,
        // adjacent (orthogonally) to the entrance, OR adjacent to any already-crossed square.
        const isOrthAdjacent = (ax, ay, bx, by) => (Math.abs(ax - bx) === 1 && ay === by) || (Math.abs(ay - by) === 1 && ax === bx);
        // Adjacent to entrance
        if (room.entranceX !== -1 && room.entranceY !== -1) {
            if (x === room.entranceX && y === room.entranceY) {
                return true;
            }
            if (isOrthAdjacent(x, y, room.entranceX, room.entranceY)) {
                return true;
            }
        }
        // Adjacent to any existing crossed square
        for (let checkY = 0; checkY < room.height; checkY++) {
            for (let checkX = 0; checkX < room.width; checkX++) {
                const square = room.getSquare(checkX, checkY);
                if (square?.checked && isOrthAdjacent(x, y, checkX, checkY)) {
                    return true;
                }
            }
        }
        return false;
    }
    /**
     * Complete the card action by crossing all selected squares and moving card to discard pile
     */
    completeCardAction(sessionId, selectedSelections) {
        const player = this.players.get(sessionId);
        if (!player) {
            return { success: false, error: "Player not found", completed: false };
        }
        const activeCardId = this.activeCardPlayers.get(sessionId);
        if (!activeCardId) {
            return { success: false, error: "No active card", completed: false };
        }
        // Find and remove the card from drawn cards
        const cardIndex = player.drawnCards.findIndex(card => card.id === activeCardId);
        if (cardIndex === -1) {
            return { success: false, error: "Active card not found", completed: false };
        }
        const card = player.drawnCards[cardIndex];
        // Cross all selected squares (room or monster)
        const crossedExits = [];
        for (const sel of selectedSelections) {
            if (sel.kind === "room") {
                this.crossRoomSquare(sessionId, sel.roomIndex, sel.x, sel.y, crossedExits);
            }
            else {
                const monster = this.activeMonsters.find((m) => m.id === sel.monsterId);
                if (!monster)
                    continue;
                // Ownership should have been validated at selection time, but re-check defensively.
                if (monster.playerOwnerId !== sessionId)
                    continue;
                const square = monster.getSquare(sel.x, sel.y);
                if (!square)
                    continue;
                if (!square.filled)
                    continue;
                square.checked = true;
                console.log(`Crossed square ${sel.x},${sel.y} on monster ${monster.name} for player ${sessionId}`);
                const completed = monster.isCompleted();
                if (completed) {
                    console.log(`Player ${sessionId} completed monster ${monster.name}!`);
                }
            }
        }
        // Process exit navigation after all squares have been crossed.
        // This ensures that exits included in multi-square moves (like row sweeps) open reliably,
        // even when the exit's adjacent squares are crossed within the same action.
        this.resolveCrossedExits(crossedExits);
        // Move card to discard pile
        card.isActive = false;
        player.drawnCards.splice(cardIndex, 1);
        player.discardPile.push(card);
        // Clean up card selection state
        this.activeCardPlayers.delete(sessionId);
        this.clearSelections(sessionId);
        console.log(`Player ${sessionId} completed card action with card ${activeCardId}`);
        return {
            success: true,
            message: "Card action completed! Squares crossed and card moved to discard pile.",
            completed: true
        };
    }
    /**
     * Cancel the current card action and clear selections
     * @param sessionId Session ID of the player
     * @returns Result object with success status and message
     */
    cancelCardAction(sessionId) {
        const player = this.players.get(sessionId);
        if (!player) {
            return { success: false, error: "Player not found" };
        }
        const activeCardId = this.activeCardPlayers.get(sessionId);
        if (!activeCardId) {
            return { success: false, error: "No active card to cancel" };
        }
        // Find the active card and deactivate it
        const card = player.drawnCards.find(card => card.id === activeCardId);
        if (card) {
            card.isActive = false;
        }
        // Clear card selection state
        this.activeCardPlayers.delete(sessionId);
        this.clearSelections(sessionId);
        console.log(`Player ${sessionId} cancelled card action for card ${activeCardId}`);
        return {
            success: true,
            message: "Card action cancelled. Card returned to drawn cards."
        };
    }
    /**
     * Confirm and commit the current card action with selected squares
     * @param sessionId Session ID of the player
     * @param data Optional selections payload sent by the client at confirm-time
     * @returns Result object with success status and message
     */
    confirmCardAction(sessionId, data) {
        const player = this.players.get(sessionId);
        if (!player) {
            return { success: false, error: "Player not found" };
        }
        const card = this.getActiveCard(sessionId);
        if (!card) {
            return { success: false, error: "No active card to confirm" };
        }
        if ((card.selectionMode || "squares") === "horizontal_pair_twice") {
            return {
                success: false,
                error: "This card resolves directly on board clicks and does not use confirm"
            };
        }
        // If selections are provided at confirm-time, validate and stage them now.
        // This allows clients to keep selection purely local until the user clicks Confirm.
        const payloadRoomSquares = Array.isArray(data?.roomSquares) ? data.roomSquares : undefined;
        const payloadMonsterSquares = Array.isArray(data?.monsterSquares) ? data.monsterSquares : undefined;
        const hasPayload = payloadRoomSquares !== undefined || payloadMonsterSquares !== undefined;
        if (hasPayload) {
            const roomSquares = payloadRoomSquares || [];
            const monsterSquares = payloadMonsterSquares || [];
            if (roomSquares.length > 0 && monsterSquares.length > 0) {
                return { success: false, error: "Cannot confirm a move that mixes room and monster selections" };
            }
            // Rebuild selection state from payload (authoritative at confirm-time).
            this.clearSelections(sessionId);
            if (roomSquares.length > 0) {
                if (!this.cardAllowsRoom(card)) {
                    return { success: false, error: "This card does not allow selecting room squares" };
                }
                const selectionMode = card.selectionMode || "squares";
                if (selectionMode === "row") {
                    // Row cards only need a single anchor square to determine the row. If clients
                    // include extra squares for UI highlighting, we ignore them.
                    const sq = roomSquares[0];
                    if (!sq || typeof sq !== "object") {
                        this.clearSelections(sessionId);
                        return { success: false, error: "Invalid square selection payload" };
                    }
                    const roomIndex = sq.roomIndex;
                    const x = sq.x;
                    const y = sq.y;
                    if (!Number.isFinite(roomIndex) || !Number.isFinite(x) || !Number.isFinite(y)) {
                        this.clearSelections(sessionId);
                        return { success: false, error: "Invalid square selection payload" };
                    }
                    const res = this.selectSquareForCard(sessionId, roomIndex, x, y);
                    if (!res.success) {
                        this.clearSelections(sessionId);
                        return { success: false, error: res.error || "Invalid square selection" };
                    }
                }
                else {
                    for (const sq of roomSquares) {
                        if (!sq || typeof sq !== "object") {
                            this.clearSelections(sessionId);
                            return { success: false, error: "Invalid square selection payload" };
                        }
                        const roomIndex = sq.roomIndex;
                        const x = sq.x;
                        const y = sq.y;
                        if (!Number.isFinite(roomIndex) || !Number.isFinite(x) || !Number.isFinite(y)) {
                            this.clearSelections(sessionId);
                            return { success: false, error: "Invalid square selection payload" };
                        }
                        const res = this.selectSquareForCard(sessionId, roomIndex, x, y);
                        if (!res.success) {
                            this.clearSelections(sessionId);
                            return { success: false, error: res.error || "Invalid square selection" };
                        }
                    }
                }
            }
            else if (monsterSquares.length > 0) {
                if (!this.cardAllowsMonster(card)) {
                    return { success: false, error: "This card does not allow selecting monster squares" };
                }
                for (const pos of monsterSquares) {
                    if (!pos || typeof pos !== "object") {
                        this.clearSelections(sessionId);
                        return { success: false, error: "Invalid monster selection payload" };
                    }
                    const monsterId = pos.monsterId;
                    const x = pos.x;
                    const y = pos.y;
                    if (typeof monsterId !== "string" || monsterId.length === 0 || !Number.isFinite(x) || !Number.isFinite(y)) {
                        this.clearSelections(sessionId);
                        return { success: false, error: "Invalid monster selection payload" };
                    }
                    const monster = this.activeMonsters.find((m) => m.id === monsterId);
                    if (!monster) {
                        this.clearSelections(sessionId);
                        return { success: false, error: "Monster not found" };
                    }
                    if (monster.playerOwnerId !== sessionId) {
                        this.clearSelections(sessionId);
                        return { success: false, error: "You don't own this monster" };
                    }
                    const res = this.selectMonsterSquareForCard(sessionId, monster, x, y);
                    if (!res.success) {
                        this.clearSelections(sessionId);
                        return { success: false, error: res.error || "Invalid monster selection" };
                    }
                }
            }
        }
        const selectedSelections = this.getSelections(sessionId);
        const roomSelections = selectedSelections.filter((s) => s.kind === "room");
        const monsterSelections = selectedSelections.filter((s) => s.kind === "monster");
        if (roomSelections.length > 0 && monsterSelections.length > 0) {
            return { success: false, error: "Cannot confirm a move that mixes room and monster selections" };
        }
        // "Every monster" cards require selections per monster (or auto-complete if no eligible monsters).
        if (this.cardIsMonsterEach(card)) {
            if (roomSelections.length > 0) {
                return { success: false, error: "This card requires selecting monster squares" };
            }
            const eligibleMonsters = this.getPlayerMonsters(sessionId).filter((m) => !m.isCompleted());
            if (eligibleMonsters.length === 0) {
                // Keep behavior consistent with playCard() auto-discard in case the state changed mid-turn.
                return this.completeCardAction(sessionId, []);
            }
            const byMonster = new Map();
            for (const sel of monsterSelections) {
                const list = byMonster.get(sel.monsterId) || [];
                list.push(sel);
                byMonster.set(sel.monsterId, list);
            }
            // Disallow selecting squares from monsters the player doesn't own.
            for (const monsterId of byMonster.keys()) {
                const monster = this.activeMonsters.find((m) => m.id === monsterId);
                if (!monster) {
                    return { success: false, error: "Monster not found" };
                }
                if (monster.playerOwnerId !== sessionId) {
                    return { success: false, error: "You don't own this monster" };
                }
            }
            const maxPerMonster = card.maxSelections || 2;
            for (const monster of eligibleMonsters) {
                const remainingSquares = monster.squares.filter((s) => s.filled && !s.checked).length;
                const required = Math.min(maxPerMonster, remainingSquares);
                const selectedForMonster = byMonster.get(monster.id) || [];
                if (selectedForMonster.length !== required) {
                    return {
                        success: false,
                        error: `Must select ${required} square(s) for each monster (missing for ${monster.name})`
                    };
                }
            }
            // Complete the card action with the selected squares.
            return this.completeCardAction(sessionId, selectedSelections);
        }
        const minSelections = card.minSelections || 1;
        const maxSelections = card.maxSelections || 0;
        // Enforce selection target constraints.
        if (card.selectionTarget === "room") {
            if (roomSelections.length === 0)
                return { success: false, error: "This card requires selecting room squares" };
            if (monsterSelections.length > 0)
                return { success: false, error: "This card does not allow selecting monster squares" };
        }
        else if (card.selectionTarget === "monster") {
            if (monsterSelections.length === 0)
                return { success: false, error: "This card requires selecting monster squares" };
            if (roomSelections.length > 0)
                return { success: false, error: "This card does not allow selecting room squares" };
        }
        else if (card.selectionTarget === "room_or_monster") {
            if (roomSelections.length === 0 && monsterSelections.length === 0) {
                return { success: false, error: "No squares selected to confirm" };
            }
            if (roomSelections.length > 0 && monsterSelections.length > 0) {
                return { success: false, error: "Cannot confirm a move that mixes room and monster selections" };
            }
        }
        else if (card.selectionTarget === "monster_each") {
            // Handled above.
        }
        else {
            return { success: false, error: "Unknown card selection target" };
        }
        // Enforce min/max constraints.
        if (selectedSelections.length < minSelections) {
            return { success: false, error: `Select at least ${minSelections} square(s) to confirm this card` };
        }
        if (maxSelections > 0 && selectedSelections.length > maxSelections) {
            return { success: false, error: `Select at most ${maxSelections} square(s) to confirm this card` };
        }
        // Defensive: keep selection scoped to a single room/monster when applicable.
        if (roomSelections.length > 0) {
            const roomIndex = roomSelections[0].roomIndex;
            if (roomSelections.some((s) => s.roomIndex !== roomIndex)) {
                return { success: false, error: "Cannot select squares from multiple rooms in the same card action" };
            }
        }
        if (monsterSelections.length > 0) {
            const monsterId = monsterSelections[0].monsterId;
            if (monsterSelections.some((s) => s.monsterId !== monsterId)) {
                return { success: false, error: "Cannot select squares from multiple monsters in the same card action" };
            }
        }
        // Complete the card action with the selected squares
        return this.completeCardAction(sessionId, selectedSelections);
    }
    /**
     * Get the current card selection state for a player
     * @param sessionId Session ID of the player
     * @returns Card selection state information
     */
    getCardSelectionState(sessionId) {
        const activeCardId = this.activeCardPlayers.get(sessionId);
        const selectionsString = this.selectedSquares.get(sessionId) || "";
        const parsed = this.parseSelections(selectionsString);
        const selectedCount = parsed.length;
        const selectedSquares = parsed
            .filter((s) => s.kind === "room")
            .map((s) => ({ roomIndex: s.roomIndex, x: s.x, y: s.y }));
        const selectedMonsterSquares = parsed
            .filter((s) => s.kind === "monster")
            .map((s) => ({ monsterId: s.monsterId, x: s.x, y: s.y }));
        return {
            hasActiveCard: !!activeCardId,
            activeCardId,
            selectedCount,
            selectedSquares,
            selectedMonsterSquares
        };
    }
    parseSelections(selectionsString) {
        if (!selectionsString)
            return [];
        return selectionsString
            .split(";")
            .map((entry) => entry.trim())
            .filter(Boolean)
            .flatMap((entry) => {
            // Legacy format: "<roomIndex>:<x>,<y>"
            if (!entry.startsWith("r:") && !entry.startsWith("m:")) {
                const [roomIdx, coords] = entry.split(":");
                const [x, y] = (coords || "").split(",").map(Number);
                const roomIndex = parseInt(roomIdx, 10);
                if (!Number.isFinite(roomIndex) || !Number.isFinite(x) || !Number.isFinite(y))
                    return [];
                return [{ kind: "room", roomIndex, x, y }];
            }
            const parts = entry.split(":");
            if (parts.length !== 3)
                return [];
            const [kind, idOrRoom, coords] = parts;
            const [x, y] = (coords || "").split(",").map(Number);
            if (!Number.isFinite(x) || !Number.isFinite(y))
                return [];
            if (kind === "r") {
                const roomIndex = parseInt(idOrRoom, 10);
                if (!Number.isFinite(roomIndex))
                    return [];
                return [{ kind: "room", roomIndex, x, y }];
            }
            if (kind === "m") {
                const monsterId = idOrRoom;
                if (!monsterId)
                    return [];
                return [{ kind: "monster", monsterId, x, y }];
            }
            return [];
        });
    }
    selectMonsterSquareForCard(sessionId, monster, x, y) {
        const card = this.getActiveCard(sessionId);
        if (!card) {
            return { success: false, error: "No active card for player" };
        }
        if (!this.cardAllowsMonster(card)) {
            return { success: false, error: "Active card does not allow monster selection", invalidSquare: true };
        }
        const selectionMode = card.selectionMode || "squares";
        if (selectionMode !== "squares" && selectionMode !== "horizontal_pair_twice") {
            return { success: false, error: "Active card does not allow selecting monster squares", invalidSquare: true };
        }
        const currentSelections = this.getSelections(sessionId);
        const roomSelections = currentSelections.filter((s) => s.kind === "room");
        const monsterSelections = currentSelections.filter((s) => s.kind === "monster");
        if (roomSelections.length > 0) {
            return { success: false, error: "Cannot mix monster and room selections in the same card action", invalidSquare: true };
        }
        const allowsMultiMonster = this.cardIsMonsterEach(card);
        if (!allowsMultiMonster && monsterSelections.length > 0 && monsterSelections.some((p) => p.monsterId !== monster.id)) {
            return { success: false, error: "Cannot select squares from multiple monsters in the same card action", invalidSquare: true };
        }
        if (selectionMode === "horizontal_pair_twice") {
            const rightX = x + 1;
            const rightY = y;
            const leftSquare = monster.getSquare(x, y);
            const rightSquare = monster.getSquare(rightX, rightY);
            if (!leftSquare || !rightSquare) {
                return { success: false, error: "Horizontal pair must fully fit inside the monster card", invalidSquare: true };
            }
            if (!leftSquare.filled || !rightSquare.filled) {
                return { success: false, error: "Cannot place horizontal pair on empty monster squares", invalidSquare: true };
            }
            if (leftSquare.checked || rightSquare.checked) {
                return { success: false, error: "Cannot place horizontal pair on already crossed monster squares", invalidSquare: true };
            }
            const alreadySelected = monsterSelections.some((pos) => pos.monsterId === monster.id && pos.x === x && pos.y === y) ||
                monsterSelections.some((pos) => pos.monsterId === monster.id && pos.x === rightX && pos.y === rightY);
            if (alreadySelected) {
                return { success: false, error: "Square already selected", invalidSquare: true };
            }
            leftSquare.checked = true;
            rightSquare.checked = true;
            const pairSelections = [
                { kind: "monster", monsterId: monster.id, x, y },
                { kind: "monster", monsterId: monster.id, x: rightX, y: rightY }
            ];
            const updatedSelections = [...currentSelections, ...pairSelections];
            this.setSelections(sessionId, updatedSelections);
            const placementsCompleted = Math.floor(updatedSelections.length / 2);
            if (placementsCompleted >= 2) {
                const completed = this.completeCardAction(sessionId, []);
                if (!completed.success) {
                    return completed;
                }
                return {
                    ...completed,
                    message: "Second horizontal pair crossed. Card action completed."
                };
            }
            return {
                success: true,
                message: "First horizontal pair crossed. Place one more horizontal pair.",
                completed: false
            };
        }
        const square = monster.getSquare(x, y);
        if (!square) {
            return { success: false, error: "Invalid coordinates", invalidSquare: true };
        }
        if (!square.filled) {
            return { success: false, error: "Cannot select empty squares", invalidSquare: true };
        }
        if (square.checked) {
            return { success: false, error: "Square already crossed", invalidSquare: true };
        }
        const alreadySelected = monsterSelections.some((pos) => pos.monsterId === monster.id && pos.x === x && pos.y === y);
        if (alreadySelected) {
            return { success: false, error: "Square already selected", invalidSquare: true };
        }
        const maxSelections = card.maxSelections || 0;
        const currentForMonster = monsterSelections.filter((p) => p.monsterId === monster.id);
        if (maxSelections > 0) {
            if (allowsMultiMonster) {
                if (currentForMonster.length >= maxSelections) {
                    return {
                        success: false,
                        error: `Maximum of ${maxSelections} squares can be selected per monster`,
                        invalidSquare: true
                    };
                }
            }
            else if (monsterSelections.length >= maxSelections) {
                return {
                    success: false,
                    error: `Maximum of ${maxSelections} squares can be selected per card`,
                    invalidSquare: true
                };
            }
        }
        const isOrthAdjacent = (ax, ay, bx, by) => (Math.abs(ax - bx) === 1 && ay === by) || (Math.abs(ay - by) === 1 && ax === bx);
        if (card.requiresMonsterStartAdjacency && currentForMonster.length === 0) {
            const hasAnyCrossed = monster.squares.some((s) => s.filled && s.checked);
            if (hasAnyCrossed) {
                let adjacentToCrossed = false;
                for (let checkY = 0; checkY < monster.height; checkY++) {
                    for (let checkX = 0; checkX < monster.width; checkX++) {
                        const s = monster.getSquare(checkX, checkY);
                        if (s?.filled && s.checked && isOrthAdjacent(x, y, checkX, checkY)) {
                            adjacentToCrossed = true;
                            break;
                        }
                    }
                    if (adjacentToCrossed)
                        break;
                }
                if (!adjacentToCrossed) {
                    return {
                        success: false,
                        error: "First square must be adjacent to an already crossed monster square",
                        invalidSquare: true
                    };
                }
            }
        }
        if (card.requiresConnected && currentForMonster.length > 0) {
            const isConnected = currentForMonster.some((pos) => isOrthAdjacent(x, y, pos.x, pos.y));
            if (!isConnected) {
                return { success: false, error: "Square must be orthogonally connected to selected squares", invalidSquare: true };
            }
        }
        const updatedSelections = [...currentSelections, { kind: "monster", monsterId: monster.id, x, y }];
        this.setSelections(sessionId, updatedSelections);
        const newCountForMonster = currentForMonster.length + 1;
        const maxLabel = maxSelections > 0 ? `/${maxSelections}` : "";
        console.log(`Player ${sessionId} selected monster square ${x},${y} on ${monster.id} (${newCountForMonster})`);
        return {
            success: true,
            message: `Square selected (${newCountForMonster}${maxLabel}) on this monster. Use confirm button to commit move.`,
            completed: false
        };
    }
    // Monster-related methods
    /**
     * Move a monster from its current position to a player's area
     * @param sessionId Session ID of the player
     * @param monsterId ID of the monster to claim
     * @returns Result object with success status and message
     */
    claimMonster(sessionId, monsterId) {
        const player = this.players.get(sessionId);
        if (!player) {
            return { success: false, error: "Player not found" };
        }
        // Find the monster in activeMonsters
        const monsterIndex = this.activeMonsters.findIndex(monster => monster.id === monsterId);
        if (monsterIndex === -1) {
            return { success: false, error: "Monster not found" };
        }
        const monster = this.activeMonsters[monsterIndex];
        // Check if monster is already owned
        if (monster.playerOwnerId !== "") {
            return { success: false, error: "Monster already claimed by another player" };
        }
        // Check if monster is connected to a room (can't claim monsters in player areas)
        if (monster.connectedToRoomIndex === -1) {
            return { success: false, error: "Monster is not available to claim" };
        }
        // Claim the monster
        monster.playerOwnerId = sessionId;
        monster.connectedToRoomIndex = -1; // Move to player area
        console.log(`Player ${sessionId} claimed monster ${monster.name} (${monster.id})`);
        return {
            success: true,
            message: `Successfully claimed ${monster.name}! You can now cross off squares on this monster.`
        };
    }
    /**
     * Cross off a square on a monster card owned by the player
     * @param sessionId Session ID of the player
     * @param monsterId ID of the monster
     * @param x X coordinate of the square
     * @param y Y coordinate of the square
     * @returns Result object with success status and message
     */
    crossMonsterSquare(sessionId, monsterId, x, y) {
        const player = this.players.get(sessionId);
        if (!player) {
            return { success: false, error: "Player not found" };
        }
        // Find the monster in activeMonsters
        const monster = this.activeMonsters.find(m => m.id === monsterId);
        if (!monster) {
            return { success: false, error: "Monster not found" };
        }
        // Check if player owns the monster
        if (monster.playerOwnerId !== sessionId) {
            return { success: false, error: "You don't own this monster" };
        }
        // Check if player has an active card
        const activeCardId = this.activeCardPlayers.get(sessionId);
        if (!activeCardId) {
            return { success: false, error: "You need an active card to cross monster squares" };
        }
        // Do not allow mixing monster + room selections in a single card action.
        const existing = this.parseSelections(this.selectedSquares.get(sessionId) || "");
        if (existing.some((s) => s.kind === "room")) {
            return { success: false, error: "Cannot mix monster and room selections in the same card action", invalidSquare: true };
        }
        return this.selectMonsterSquareForCard(sessionId, monster, x, y);
    }
    /**
     * Check if a room is blocked by an adjacent monster
     * @param roomIndex Index of the room to check
     * @returns True if the room is blocked by a monster
     */
    isRoomBlockedByMonster(roomIndex) {
        // Find any monster connected to this room
        return this.activeMonsters.some(monster => monster.connectedToRoomIndex === roomIndex && monster.playerOwnerId === "");
    }
    /**
     * Get all monsters owned by a player
     * @param sessionId Session ID of the player
     * @returns Array of monster cards owned by the player
     */
    getPlayerMonsters(sessionId) {
        return this.activeMonsters.filter(monster => monster.playerOwnerId === sessionId);
    }
    /**
     * Get all monsters connected to rooms (not owned by players)
     * @returns Array of monster cards connected to rooms
     */
    getRoomMonsters() {
        return this.activeMonsters
            .filter(monster => monster.connectedToRoomIndex !== -1 && monster.playerOwnerId === "")
            .map(monster => ({ monster, roomIndex: monster.connectedToRoomIndex }));
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
    (0, schema_1.type)([MonsterCard_1.MonsterCard])
], DungeonState.prototype, "monsterDeck", void 0);
__decorate([
    (0, schema_1.type)([MonsterCard_1.MonsterCard])
], DungeonState.prototype, "activeMonsters", void 0);
__decorate([
    (0, schema_1.type)("number")
], DungeonState.prototype, "gridOriginX", void 0);
__decorate([
    (0, schema_1.type)("number")
], DungeonState.prototype, "gridOriginY", void 0);
__decorate([
    (0, schema_1.type)({ map: "number" })
], DungeonState.prototype, "roomGridPositions", void 0);
__decorate([
    (0, schema_1.type)("number")
], DungeonState.prototype, "currentTurn", void 0);
__decorate([
    (0, schema_1.type)("boolean")
], DungeonState.prototype, "turnInProgress", void 0);
__decorate([
    (0, schema_1.type)(["string"])
], DungeonState.prototype, "turnOrder", void 0);
__decorate([
    (0, schema_1.type)({ map: "string" })
], DungeonState.prototype, "activeCardPlayers", void 0);
