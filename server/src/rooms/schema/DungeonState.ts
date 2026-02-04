import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { Player } from "./Player";
import { Client } from "colyseus";
import { DungeonSquare } from "./DungeonSquare";
import { Room } from "./Room";
import { NavigationValidator } from "../NavigationValidator";
import { MonsterCard } from "./MonsterCard";
import { MonsterFactory } from "../MonsterFactory";

const BOARD_WIDTH = 4;

export class DungeonState extends Schema {

  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: DungeonSquare }) board = new MapSchema<DungeonSquare>();
  @type([Room]) rooms = new ArraySchema<Room>();
  @type("number") currentRoomIndex = 0;
  @type(["number"]) displayedRoomIndices = new ArraySchema<number>(); // Indices of rooms currently displayed
  @type(["number"]) roomPositionsX = new ArraySchema<number>(); // X positions of displayed rooms
  @type(["number"]) roomPositionsY = new ArraySchema<number>(); // Y positions of displayed rooms

  // Monster deck and management
  @type([MonsterCard]) monsterDeck = new ArraySchema<MonsterCard>();
  @type([MonsterCard]) activeMonsters = new ArraySchema<MonsterCard>(); // Monsters currently on the board or with players

  // Grid management properties
  @type("number") gridOriginX = 0; // Starting grid position X
  @type("number") gridOriginY = 0; // Starting grid position Y
  @type({ map: "number" }) roomGridPositions = new MapSchema<number>(); // "x,y" -> roomIndex

  // Turn management properties
  @type("number") currentTurn = 1;
  @type("boolean") turnInProgress = false;
  @type(["string"]) turnOrder = new ArraySchema<string>(); // Player session IDs

  // Card-based square selection tracking
  @type({ map: "string" }) activeCardPlayers = new MapSchema<string>(); // sessionId -> cardId

  // NOTE: These can grow quickly and are frequently mutated; keeping them inside Schema maps
  // has caused serialization issues (msgpackr RangeError: ERR_BUFFER_OUT_OF_BOUNDS) when sending
  // state patches under load / rapid interactions.
  //
  // They are server-side bookkeeping only, so we keep them as plain JS Maps (non-schema).
  // Selection format (semicolon-delimited):
  // - Room square:   "r:<roomIndex>:<x>,<y>"
  // - Monster square:"m:<monsterId>:<x>,<y>"
  selectedSquares = new Map<string, string>(); // sessionId -> selections string
  selectedSquareCount = new Map<string, number>(); // sessionId -> count

  // Navigation validator for exit adjacency checking
  private navigationValidator = new NavigationValidator();

  initializeBoard() {
    console.log('initializeBoard');
    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 4; y++) {
        this.board.set(`${x},${y}`, new DungeonSquare());
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
  initializeMonsterDeck(): void {
    console.log('Initializing monster deck');
    const monsters = MonsterFactory.createMonsterDeck();
    monsters.forEach(monster => this.monsterDeck.push(monster));
    console.log(`Monster deck initialized with ${this.monsterDeck.length} monsters`);
  }

  /**
   * Draw a monster from the deck when a new room is opened
   * @returns The drawn monster card or null if deck is empty
   */
  drawMonsterCard(): MonsterCard | null {
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
  createNewRoom(entranceDirection?: string): Room {
    // Generate random dimensions
    const width = Math.floor(Math.random() * 3) + 6; // 6-8
    const height = Math.floor(Math.random() * 3) + 4; // 4-6

    const room = new Room(width, height);

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
  private addRandomWalls(room: Room) {
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

  getCurrentRoom(): Room | undefined {
    return this.rooms[this.currentRoomIndex];
  }

  // Add a new room when a player exits through an exit from any room
  addNewRoomFromExit(fromRoomIndex: number, exitDirection: string, exitIndex: number) {
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

    let targetRoomIndex: number;
    let targetRoom: Room;

    if (existingRoomIndex !== undefined) {
      // Room already exists at target coordinates - connect to it
      targetRoomIndex = existingRoomIndex;
      targetRoom = this.rooms[targetRoomIndex];

      console.log(`Connecting to existing room ${targetRoomIndex} at grid (${targetX}, ${targetY})`);

      // Establish bidirectional connection
      this.establishConnection(fromRoomIndex, exitIndex, targetRoomIndex, exitDirection);
    } else {
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
  addNewRoom(exitDirection: string, exitIndex: number) {
    return this.addNewRoomFromExit(this.currentRoomIndex, exitDirection, exitIndex);
  }



  createPlayer(id: string, name: string) {
    this.players.set(id, new Player(name));

    // Add player to turn order if turn system is active
    this.addPlayerToTurnOrder(id);
  }

  removePlayer(id: string) {
    this.players.delete(id);

    // Clean up any in-progress card action state for this session.
    this.activeCardPlayers.delete(id);
    this.selectedSquares.delete(id);
    this.selectedSquareCount.delete(id);

    // Remove player from turn order
    this.removePlayerFromTurnOrder(id);
  }

  crossSquare(client: Client, data: any) {
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
  isAdjacentToEntranceOrExit(room: Room, x: number, y: number): boolean {
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
  assignGridCoordinates(roomIndex: number, x: number, y: number): void {
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
  getGridCoordinates(roomIndex: number): { x: number, y: number } | null {
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
  findOrCreateAdjacentRoom(currentX: number, currentY: number, direction: string): number {
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
  establishConnection(fromRoomIndex: number, exitIndex: number, toRoomIndex: number, direction: string): void {
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
    } else {
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
  private getOppositeDirection(direction: string): string {
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
  initializeTurnState(): void {
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
  addPlayerToTurnOrder(sessionId: string): void {
    if (!this.turnOrder.includes(sessionId)) {
      this.turnOrder.push(sessionId);
      console.log(`Added player ${sessionId} to turn order`);
    }
  }

  /**
   * Remove a player from the turn order when they leave
   * @param sessionId Session ID of the player to remove
   */
  removePlayerFromTurnOrder(sessionId: string): void {
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
  areAllPlayersReady(): boolean {
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
  advanceTurn(): void {
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
  updatePlayerTurnStatus(sessionId: string, status: "not_started" | "playing_turn" | "turn_complete"): boolean {
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
  private isValidStatusTransition(currentStatus: string, newStatus: string): boolean {
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
  getTurnStatus(): {
    currentTurn: number;
    turnInProgress: boolean;
    totalPlayers: number;
    playersReady: number;
    playerStatuses: { [sessionId: string]: string };
  } {
    const playerStatuses: { [sessionId: string]: string } = {};
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
  canPlayerPerformAction(sessionId: string, action: "drawCard" | "playCard" | "endTurn"): boolean {
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
  drawCard(sessionId: string): { success: boolean; message?: string; error?: string } {
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
  playCard(sessionId: string, cardId: string): { success: boolean; message?: string; error?: string } {
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
    this.selectedSquares.set(sessionId, "");
    this.selectedSquareCount.set(sessionId, 0);

    console.log(`Player ${sessionId} activated card: ${cardId}`);

    return {
      success: true,
      message: `Activated card: ${card.description}. Select up to 3 connected squares.`
    };
  }

  /**
   * Handle square selection during card-based play
   * @param sessionId Session ID of the player
   * @param roomIndex Index of the room containing the square
   * @param x X coordinate of the square
   * @param y Y coordinate of the square
   * @returns Result object with success status and message
   */
  selectSquareForCard(sessionId: string, roomIndex: number, x: number, y: number): {
    success: boolean;
    message?: string;
    error?: string;
    invalidSquare?: boolean;
    completed?: boolean;
  } {
    const player = this.players.get(sessionId);
    if (!player) {
      return { success: false, error: "Player not found" };
    }

    // Check if player has an active card
    const activeCardId = this.activeCardPlayers.get(sessionId);
    if (!activeCardId) {
      return { success: false, error: "No active card for player" };
    }

    // Get the room
    const room = this.rooms[roomIndex];
    if (!room) {
      return { success: false, error: "Invalid room index" };
    }

    // Room squares cannot be crossed while an unclaimed monster is connected to this room.
    if (this.isRoomBlockedByMonster(roomIndex)) {
      return {
        success: false,
        error: "Cannot cross squares in rooms with adjacent monsters. Claim the monster first!",
        invalidSquare: true
      };
    }

    // Validate coordinates
    if (!room.isValidPosition(x, y)) {
      return { success: false, error: "Invalid coordinates" };
    }

    const square = room.getSquare(x, y);
    if (!square || square.wall) {
      return { success: false, error: "Cannot select wall squares", invalidSquare: true };
    }

    // Check if square is already crossed
    if (square.checked) {
      return { success: false, error: "Square already crossed", invalidSquare: true };
    }

    // Special handling for exit squares
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
        // For card-based selection, exits can be selected like regular squares
        // The actual navigation validation will happen when the card action is confirmed
        // This allows exits to be part of multi-square card selections
        console.log(`Player ${sessionId} selected exit square ${x},${y} for card action`);
      }
    }

    // Get current selected squares
    const currentSelections = this.selectedSquares.get(sessionId) || "";
    const currentCount = this.selectedSquareCount.get(sessionId) || 0;

    // Parse current selections (room only)
    const selectedPositions = this.parseSelections(currentSelections)
      .filter((s): s is { kind: "room"; roomIndex: number; x: number; y: number } => s.kind === "room");

    // Check if this square is already selected
    const alreadySelected = selectedPositions.some(pos =>
      pos.roomIndex === roomIndex && pos.x === x && pos.y === y
    );
    if (alreadySelected) {
      return { success: false, error: "Square already selected", invalidSquare: true };
    }

    // Check maximum of 3 squares limit
    if (currentCount >= 3) {
      return { success: false, error: "Maximum of 3 squares can be selected per card", invalidSquare: true };
    }

    // Validate connectivity for non-first squares
    if (currentCount > 0) {
      const isConnected = this.isSquareConnectedToSelection(roomIndex, x, y, selectedPositions, room);
      if (!isConnected) {
        return { success: false, error: "Square must be orthogonally connected to selected squares", invalidSquare: true };
      }
    } else {
      // First square must be adjacent to entrance or existing crossed square
      const isValidStart = this.isValidStartingSquare(room, x, y);
      if (!isValidStart) {
        return { success: false, error: "First square must be adjacent to entrance or existing crossed square", invalidSquare: true };
      }
    }

    // Add square to selection
    const newSelection = `r:${roomIndex}:${x},${y}`;
    const updatedSelections = currentSelections ? `${currentSelections};${newSelection}` : newSelection;
    const newCount = currentCount + 1;

    this.selectedSquares.set(sessionId, updatedSelections);
    this.selectedSquareCount.set(sessionId, newCount);

    console.log(`Player ${sessionId} selected square ${x},${y} in room ${roomIndex} (${newCount})`);

    return {
      success: true,
      message: `Square selected (${newCount}/3). Use confirm button to commit move.`,
      completed: false
    };
  }

  /**
   * Check if a square is connected to the current selection
   */
  private isSquareConnectedToSelection(
    roomIndex: number,
    x: number,
    y: number,
    selectedPositions: Array<{ roomIndex: number, x: number, y: number }>,
    room: Room
  ): boolean {
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

  /**
   * Check if a square is a valid starting position (adjacent to entrance or existing crossed square)
   */
  private isValidStartingSquare(room: Room, x: number, y: number): boolean {
    // For the first square of a card action, allow placement adjacent (orthogonally)
    // to the entrance OR to any already-crossed square.
    const isOrthAdjacent = (ax: number, ay: number, bx: number, by: number) =>
      (Math.abs(ax - bx) === 1 && ay === by) || (Math.abs(ay - by) === 1 && ax === bx);

    // Adjacent to entrance
    if (room.entranceX !== -1 && room.entranceY !== -1) {
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
  private completeCardAction(
    sessionId: string,
    selectedSelections: Array<
      | { kind: "room"; roomIndex: number; x: number; y: number }
      | { kind: "monster"; monsterId: string; x: number; y: number }
    >
  ): { success: boolean; message?: string; error?: string; completed: boolean } {
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
    for (const sel of selectedSelections) {
      if (sel.kind === "room") {
        const room = this.rooms[sel.roomIndex];
        if (!room) continue;

        const square = room.getSquare(sel.x, sel.y);
        if (!square) continue;

        // Check if this is an exit square
        if (square.exit) {
          // Find which exit was clicked
          let exitIndex = -1;
          for (let i = 0; i < room.exitX.length; i++) {
            if (room.exitX[i] === sel.x && room.exitY[i] === sel.y) {
              exitIndex = i;
              break;
            }
          }

          if (exitIndex !== -1) {
            // Validate exit navigation using NavigationValidator
            const canNavigate = this.navigationValidator.canNavigateToExit(room, exitIndex);

            if (canNavigate) {
              // Navigation is valid - cross the square and process exit
              square.checked = true;
              console.log(`Crossed exit square ${sel.x},${sel.y} in room ${sel.roomIndex} for player ${sessionId}`);

              // Get the direction of the exit
              const exitDirection = room.exitDirections[exitIndex];

              // Add a new room in that direction
              this.addNewRoomFromExit(sel.roomIndex, exitDirection, exitIndex);
            } else {
              console.log(`Exit navigation failed for square ${sel.x},${sel.y} in room ${sel.roomIndex} - no adjacent crossed squares`);
              // Still cross the square but don't trigger navigation
              square.checked = true;
            }
          } else {
            // Exit square but couldn't find exit index - treat as regular square
            square.checked = true;
            console.log(`Crossed square ${sel.x},${sel.y} in room ${sel.roomIndex} for player ${sessionId}`);
          }
        } else {
          // Regular square crossing
          square.checked = true;
          console.log(`Crossed square ${sel.x},${sel.y} in room ${sel.roomIndex} for player ${sessionId}`);
        }
      } else {
        const monster = this.activeMonsters.find((m) => m.id === sel.monsterId);
        if (!monster) continue;

        // Ownership should have been validated at selection time, but re-check defensively.
        if (monster.playerOwnerId !== sessionId) continue;

        const square = monster.getSquare(sel.x, sel.y);
        if (!square) continue;

        if (!square.filled) continue;

        square.checked = true;
        console.log(`Crossed square ${sel.x},${sel.y} on monster ${monster.name} for player ${sessionId}`);

        const completed = monster.isCompleted();
        if (completed) {
          console.log(`Player ${sessionId} completed monster ${monster.name}!`);
        }
      }
    }

    // Move card to discard pile
    card.isActive = false;
    player.drawnCards.splice(cardIndex, 1);
    player.discardPile.push(card);

    // Clean up card selection state
    this.activeCardPlayers.delete(sessionId);
    this.selectedSquares.delete(sessionId);
    this.selectedSquareCount.delete(sessionId);

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
  cancelCardAction(sessionId: string): { success: boolean; message?: string; error?: string } {
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
    this.selectedSquares.delete(sessionId);
    this.selectedSquareCount.delete(sessionId);

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
  confirmCardAction(sessionId: string, data?: any): { success: boolean; message?: string; error?: string; completed?: boolean } {
    const player = this.players.get(sessionId);
    if (!player) {
      return { success: false, error: "Player not found" };
    }

    const activeCardId = this.activeCardPlayers.get(sessionId);
    if (!activeCardId) {
      return { success: false, error: "No active card to confirm" };
    }

    // If selections are provided at confirm-time, validate and stage them now.
    // This allows clients to keep selection purely local until the user clicks Confirm.
    const payloadRoomSquares = Array.isArray(data?.roomSquares) ? data.roomSquares : undefined;
    const payloadMonsterSquares = Array.isArray(data?.monsterSquares) ? data.monsterSquares : undefined;
    const hasPayload = payloadRoomSquares !== undefined || payloadMonsterSquares !== undefined;

    if (hasPayload) {
      const roomSquares: Array<{ roomIndex: number; x: number; y: number }> = payloadRoomSquares || [];
      const monsterSquares: Array<{ monsterId: string; x: number; y: number }> = payloadMonsterSquares || [];

      const totalSelections = roomSquares.length + monsterSquares.length;
      if (totalSelections === 0) {
        return { success: false, error: "No squares selected to confirm" };
      }

      if (totalSelections > 3) {
        return { success: false, error: `Maximum of 3 squares can be confirmed per card (selected ${totalSelections})` };
      }

      if (roomSquares.length > 0 && monsterSquares.length > 0) {
        return { success: false, error: "Cannot confirm a move that mixes room and monster selections" };
      }

      if (monsterSquares.length > 0) {
        const monsterIds = new Set(monsterSquares.map((sq) => sq.monsterId));
        if (monsterIds.size !== 1) {
          return { success: false, error: "Cannot select squares from multiple monsters in the same card action" };
        }

        const monsterId = monsterSquares[0]?.monsterId;
        const monster = this.activeMonsters.find((m) => m.id === monsterId);
        if (!monster) {
          return { success: false, error: "Monster not found" };
        }
        if (monster.playerOwnerId !== sessionId) {
          return { success: false, error: "You don't own this monster" };
        }

        const validation = this.validateMonsterSelectionBatch(monster, monsterSquares);
        if (!validation.valid) {
          return { success: false, error: validation.error || "Invalid monster selection" };
        }

        const selections = monsterSquares.map((pos) => ({
          kind: "monster" as const,
          monsterId: pos.monsterId,
          x: pos.x,
          y: pos.y
        }));

        return this.completeCardAction(sessionId, selections);
      }

      // Clear any previously recorded selections for this player (legacy clients).
      this.selectedSquares.set(sessionId, "");
      this.selectedSquareCount.set(sessionId, 0);

      if (roomSquares.length > 0) {
        for (const sq of roomSquares) {
          if (!sq || typeof sq !== "object") {
            this.selectedSquares.set(sessionId, "");
            this.selectedSquareCount.set(sessionId, 0);
            return { success: false, error: "Invalid square selection payload" };
          }

          const roomIndex = (sq as any).roomIndex;
          const x = (sq as any).x;
          const y = (sq as any).y;
          if (!Number.isFinite(roomIndex) || !Number.isFinite(x) || !Number.isFinite(y)) {
            this.selectedSquares.set(sessionId, "");
            this.selectedSquareCount.set(sessionId, 0);
            return { success: false, error: "Invalid square selection payload" };
          }

          const res = this.selectSquareForCard(sessionId, roomIndex, x, y);
          if (!res.success) {
            this.selectedSquares.set(sessionId, "");
            this.selectedSquareCount.set(sessionId, 0);
            return { success: false, error: res.error || "Invalid square selection" };
          }
        }
      }
    }

    const selectedCount = this.selectedSquareCount.get(sessionId) || 0;
    if (selectedCount === 0) {
      return { success: false, error: "No squares selected to confirm" };
    }

    // Get current selected squares (room or monster)
    const currentSelections = this.selectedSquares.get(sessionId) || "";
    const selectedSelections = this.parseSelections(currentSelections);

    const roomSelections = selectedSelections.filter(
      (s): s is { kind: "room"; roomIndex: number; x: number; y: number } => s.kind === "room"
    );
    const monsterSelections = selectedSelections.filter(
      (s): s is { kind: "monster"; monsterId: string; x: number; y: number } => s.kind === "monster"
    );

    if (roomSelections.length > 0 && monsterSelections.length > 0) {
      return { success: false, error: "Cannot confirm a move that mixes room and monster selections" };
    }

    if (selectedSelections.length > 3) {
      return { success: false, error: `Too many squares selected (selected ${selectedSelections.length})` };
    }

    // Complete the card action with the selected squares
    return this.completeCardAction(sessionId, selectedSelections);
  }

  /**
   * Get the current card selection state for a player
   * @param sessionId Session ID of the player
   * @returns Card selection state information
   */
  getCardSelectionState(sessionId: string): {
    hasActiveCard: boolean;
    activeCardId?: string;
    selectedCount: number;
    selectedSquares: Array<{ roomIndex: number, x: number, y: number }>;
    selectedMonsterSquares: Array<{ monsterId: string, x: number, y: number }>;
  } {
    const activeCardId = this.activeCardPlayers.get(sessionId);
    const selectedCount = this.selectedSquareCount.get(sessionId) || 0;
    const selectionsString = this.selectedSquares.get(sessionId) || "";

    const parsed = this.parseSelections(selectionsString);
    const selectedSquares = parsed
      .filter((s): s is { kind: "room"; roomIndex: number; x: number; y: number } => s.kind === "room")
      .map((s) => ({ roomIndex: s.roomIndex, x: s.x, y: s.y }));

    const selectedMonsterSquares = parsed
      .filter((s): s is { kind: "monster"; monsterId: string; x: number; y: number } => s.kind === "monster")
      .map((s) => ({ monsterId: s.monsterId, x: s.x, y: s.y }));

    return {
      hasActiveCard: !!activeCardId,
      activeCardId,
      selectedCount,
      selectedSquares,
      selectedMonsterSquares
    };
  }

  private parseSelections(selectionsString: string): Array<
    | { kind: "room"; roomIndex: number; x: number; y: number }
    | { kind: "monster"; monsterId: string; x: number; y: number }
  > {
    if (!selectionsString) return [];

    type Selection =
      | { kind: "room"; roomIndex: number; x: number; y: number }
      | { kind: "monster"; monsterId: string; x: number; y: number };

    return selectionsString
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .flatMap((entry): Selection[] => {
        // Legacy format: "<roomIndex>:<x>,<y>"
        if (!entry.startsWith("r:") && !entry.startsWith("m:")) {
          const [roomIdx, coords] = entry.split(":");
          const [x, y] = (coords || "").split(",").map(Number);
          const roomIndex = parseInt(roomIdx, 10);
          if (!Number.isFinite(roomIndex) || !Number.isFinite(x) || !Number.isFinite(y)) return [];
          return [{ kind: "room" as const, roomIndex, x, y }];
        }

        const parts = entry.split(":");
        if (parts.length !== 3) return [];

        const [kind, idOrRoom, coords] = parts;
        const [x, y] = (coords || "").split(",").map(Number);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return [];

        if (kind === "r") {
          const roomIndex = parseInt(idOrRoom, 10);
          if (!Number.isFinite(roomIndex)) return [];
          return [{ kind: "room" as const, roomIndex, x, y }];
        }

        if (kind === "m") {
          const monsterId = idOrRoom;
          if (!monsterId) return [];
          return [{ kind: "monster" as const, monsterId, x, y }];
        }

        return [];
      });
  }

  private selectMonsterSquareForCard(
    sessionId: string,
    monster: MonsterCard,
    x: number,
    y: number
  ): {
    success: boolean;
    message?: string;
    error?: string;
    invalidSquare?: boolean;
    completed?: boolean;
  } {
    const currentSelections = this.selectedSquares.get(sessionId) || "";
    const currentCount = this.selectedSquareCount.get(sessionId) || 0;

    const selectedPositions = this.parseSelections(currentSelections)
      .filter((s): s is { kind: "monster"; monsterId: string; x: number; y: number } => s.kind === "monster");

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

    const alreadySelected = selectedPositions.some((pos) => pos.monsterId === monster.id && pos.x === x && pos.y === y);
    if (alreadySelected) {
      return { success: false, error: "Square already selected", invalidSquare: true };
    }

    if (currentCount >= 3) {
      return { success: false, error: "Maximum of 3 squares can be selected per card", invalidSquare: true };
    }

    // Enforce single-monster selection per card action
    if (selectedPositions.length > 0 && selectedPositions.some((p) => p.monsterId !== monster.id)) {
      return { success: false, error: "Cannot select squares from multiple monsters in the same card action", invalidSquare: true };
    }

    const isOrthAdjacent = (ax: number, ay: number, bx: number, by: number) =>
      (Math.abs(ax - bx) === 1 && ay === by) || (Math.abs(ay - by) === 1 && ax === bx);

    if (currentCount === 0) {
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
          if (adjacentToCrossed) break;
        }
        if (!adjacentToCrossed) {
          return { success: false, error: "First square must be adjacent to an already crossed monster square", invalidSquare: true };
        }
      }
    } else {
      const isConnected = selectedPositions.some((pos) => isOrthAdjacent(x, y, pos.x, pos.y));
      if (!isConnected) {
        return { success: false, error: "Square must be orthogonally connected to selected squares", invalidSquare: true };
      }
    }

    const newSelection = `m:${monster.id}:${x},${y}`;
    const updatedSelections = currentSelections ? `${currentSelections};${newSelection}` : newSelection;
    const newCount = currentCount + 1;

    this.selectedSquares.set(sessionId, updatedSelections);
    this.selectedSquareCount.set(sessionId, newCount);

    console.log(`Player ${sessionId} selected monster square ${x},${y} on ${monster.id} (${newCount})`);

    return {
      success: true,
      message: `Square selected (${newCount}/3). Use confirm button to commit move.`,
      completed: false
    };
  }

  private validateMonsterSelectionBatch(
    monster: MonsterCard,
    monsterSquares: Array<{ monsterId: string; x: number; y: number }>
  ): { valid: boolean; error?: string } {
    if (!Array.isArray(monsterSquares) || monsterSquares.length === 0) {
      return { valid: false, error: "No monster squares selected" };
    }

    if (monsterSquares.length > 3) {
      return { valid: false, error: "Maximum of 3 squares can be selected per card" };
    }

    const isOrthAdjacent = (ax: number, ay: number, bx: number, by: number) =>
      (Math.abs(ax - bx) === 1 && ay === by) || (Math.abs(ay - by) === 1 && ax === bx);

    const hasAnyCrossed = monster.squares.some((s) => s.filled && s.checked);
    const selectedPositions: Array<{ x: number; y: number }> = [];
    const seen = new Set<string>();

    for (let i = 0; i < monsterSquares.length; i++) {
      const pos = monsterSquares[i];
      if (!pos || pos.monsterId !== monster.id) {
        return { valid: false, error: "Invalid monster selection" };
      }

      const { x, y } = pos;
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return { valid: false, error: "Invalid monster selection" };
      }

      const key = `${x},${y}`;
      if (seen.has(key)) {
        return { valid: false, error: "Square already selected" };
      }
      seen.add(key);

      const square = monster.getSquare(x, y);
      if (!square) {
        return { valid: false, error: "Invalid coordinates" };
      }
      if (!square.filled) {
        return { valid: false, error: "Cannot select empty squares" };
      }
      if (square.checked) {
        return { valid: false, error: "Square already crossed" };
      }

      if (i === 0) {
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
            if (adjacentToCrossed) break;
          }
          if (!adjacentToCrossed) {
            return { valid: false, error: "First square must be adjacent to an already crossed monster square" };
          }
        }
      } else {
        const isConnected = selectedPositions.some((p) => isOrthAdjacent(x, y, p.x, p.y));
        if (!isConnected) {
          return { valid: false, error: "Square must be orthogonally connected to selected squares" };
        }
      }

      selectedPositions.push({ x, y });
    }

    return { valid: true };
  }

  private canContinueMonsterSelection(
    monster: MonsterCard,
    selectedPositions: Array<{ kind: "monster"; monsterId: string; x: number; y: number }>
  ): boolean {
    if (selectedPositions.length >= 3) return false;

    const selectedSet = new Set(selectedPositions.map((p) => `${p.x},${p.y}`));
    const isOrthAdjacent = (ax: number, ay: number, bx: number, by: number) =>
      (Math.abs(ax - bx) === 1 && ay === by) || (Math.abs(ay - by) === 1 && ax === bx);

    for (let y = 0; y < monster.height; y++) {
      for (let x = 0; x < monster.width; x++) {
        if (selectedSet.has(`${x},${y}`)) continue;

        const square = monster.getSquare(x, y);
        if (!square || !square.filled || square.checked) continue;

        const isConnected = selectedPositions.some((pos) => isOrthAdjacent(x, y, pos.x, pos.y));
        if (isConnected) {
          return true;
        }
      }
    }

    return false;
  }

  // Monster-related methods

  /**
   * Move a monster from its current position to a player's area
   * @param sessionId Session ID of the player
   * @param monsterId ID of the monster to claim
   * @returns Result object with success status and message
   */
  claimMonster(sessionId: string, monsterId: string): { success: boolean; message?: string; error?: string } {
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
  crossMonsterSquare(sessionId: string, monsterId: string, x: number, y: number): { 
    success: boolean; 
    message?: string; 
    error?: string; 
    invalidSquare?: boolean;
    completed?: boolean;
  } {
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
  isRoomBlockedByMonster(roomIndex: number): boolean {
    // Find any monster connected to this room
    return this.activeMonsters.some(monster => 
      monster.connectedToRoomIndex === roomIndex && monster.playerOwnerId === ""
    );
  }

  /**
   * Get all monsters owned by a player
   * @param sessionId Session ID of the player
   * @returns Array of monster cards owned by the player
   */
  getPlayerMonsters(sessionId: string): MonsterCard[] {
    return this.activeMonsters.filter(monster => monster.playerOwnerId === sessionId);
  }

  /**
   * Get all monsters connected to rooms (not owned by players)
   * @returns Array of monster cards connected to rooms
   */
  getRoomMonsters(): Array<{ monster: MonsterCard, roomIndex: number }> {
    return this.activeMonsters
      .filter(monster => monster.connectedToRoomIndex !== -1 && monster.playerOwnerId === "")
      .map(monster => ({ monster, roomIndex: monster.connectedToRoomIndex }));
  }
}
