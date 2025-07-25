import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { Player } from "./Player";
import { Client } from "colyseus";
import { DungeonSquare } from "./DungeonSquare";
import { Room } from "./Room";
import { NavigationValidator } from "../NavigationValidator";

const BOARD_WIDTH = 4;

export class DungeonState extends Schema {

  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: DungeonSquare }) board = new MapSchema<DungeonSquare>();
  @type([Room]) rooms = new ArraySchema<Room>();
  @type("number") currentRoomIndex = 0;
  @type(["number"]) displayedRoomIndices = new ArraySchema<number>(); // Indices of rooms currently displayed
  @type(["number"]) roomPositionsX = new ArraySchema<number>(); // X positions of displayed rooms
  @type(["number"]) roomPositionsY = new ArraySchema<number>(); // Y positions of displayed rooms
  
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
  @type({ map: "string" }) selectedSquares = new MapSchema<string>(); // sessionId -> "roomIndex:x,y;roomIndex:x,y"
  @type({ map: "number" }) selectedSquareCount = new MapSchema<number>(); // sessionId -> count

  // Navigation validator for exit adjacency checking
  private navigationValidator = new NavigationValidator();

  initializeBoard() {
    console.log('initializeBoard');
    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 4; y++) {
        this.board.set(`${x},${y}`, new DungeonSquare());
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
    
    // Add an entrance to the first room (players need a way to enter)
    room.createEntrance("south"); // Create entrance from the south
    
    this.rooms.push(room);
    this.currentRoomIndex = 0;
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
    
    // Remove player from turn order
    this.removePlayerFromTurnOrder(id);
  }

  crossSquare(client: Client, data: any) {
    const player = this.players.get(client.sessionId);
    
    // If a specific room index was provided, use that room instead of the current room
    const roomIndex = data.roomIndex !== undefined ? data.roomIndex : this.currentRoomIndex;
    const room = this.rooms[roomIndex];

    if (!client.sessionId || !room) {
      return { success: false, error: "Invalid client or room" };
    }

    const { x, y } = data;
    
    // Check if player has an active card - if so, route to card-based selection
    const activeCardId = this.activeCardPlayers.get(client.sessionId);
    if (activeCardId) {
      return this.selectSquareForCard(client.sessionId, roomIndex, x, y);
    }
    
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
  getGridCoordinates(roomIndex: number): {x: number, y: number} | null {
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
        return player.turnStatus === "playing_turn";
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
      message: `Activated card: ${card.description}. Select 3 connected squares.` 
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

    // Get current selected squares
    const currentSelections = this.selectedSquares.get(sessionId) || "";
    const currentCount = this.selectedSquareCount.get(sessionId) || 0;

    // Parse current selections
    const selectedPositions = currentSelections ? currentSelections.split(";").map(pos => {
      const [roomIdx, coords] = pos.split(":");
      const [posX, posY] = coords.split(",").map(Number);
      return { roomIndex: parseInt(roomIdx), x: posX, y: posY };
    }) : [];

    // Check if this square is already selected
    const alreadySelected = selectedPositions.some(pos => 
      pos.roomIndex === roomIndex && pos.x === x && pos.y === y
    );
    if (alreadySelected) {
      return { success: false, error: "Square already selected", invalidSquare: true };
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
    const newSelection = `${roomIndex}:${x},${y}`;
    const updatedSelections = currentSelections ? `${currentSelections};${newSelection}` : newSelection;
    const newCount = currentCount + 1;

    this.selectedSquares.set(sessionId, updatedSelections);
    this.selectedSquareCount.set(sessionId, newCount);

    console.log(`Player ${sessionId} selected square ${x},${y} in room ${roomIndex} (${newCount})`);

    return { 
      success: true, 
      message: `Square selected (${newCount}). Use confirm button to commit move.` 
    };
  }

  /**
   * Check if a square is connected to the current selection
   */
  private isSquareConnectedToSelection(
    roomIndex: number, 
    x: number, 
    y: number, 
    selectedPositions: Array<{roomIndex: number, x: number, y: number}>,
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
    // Check if adjacent to entrance
    if (room.entranceX !== -1 && room.entranceY !== -1) {
      const dx = Math.abs(x - room.entranceX);
      const dy = Math.abs(y - room.entranceY);
      
      if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
        return true;
      }
    }

    // Check if adjacent to any existing crossed square
    for (let checkX = 0; checkX < room.width; checkX++) {
      for (let checkY = 0; checkY < room.height; checkY++) {
        const square = room.getSquare(checkX, checkY);
        if (square && square.checked) {
          const dx = Math.abs(x - checkX);
          const dy = Math.abs(y - checkY);
          
          if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
            return true;
          }
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
    selectedPositions: Array<{roomIndex: number, x: number, y: number}>
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
    
    // Cross all selected squares
    for (const pos of selectedPositions) {
      const room = this.rooms[pos.roomIndex];
      if (room) {
        const square = room.getSquare(pos.x, pos.y);
        if (square) {
          square.checked = true;
          console.log(`Crossed square ${pos.x},${pos.y} in room ${pos.roomIndex} for player ${sessionId}`);
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
      message: "Card action completed! 3 squares crossed and card moved to discard pile.",
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
   * @returns Result object with success status and message
   */
  confirmCardAction(sessionId: string): { success: boolean; message?: string; error?: string; completed?: boolean } {
    const player = this.players.get(sessionId);
    if (!player) {
      return { success: false, error: "Player not found" };
    }

    const activeCardId = this.activeCardPlayers.get(sessionId);
    if (!activeCardId) {
      return { success: false, error: "No active card to confirm" };
    }

    const selectedCount = this.selectedSquareCount.get(sessionId) || 0;
    if (selectedCount === 0) {
      return { success: false, error: "No squares selected to confirm" };
    }

    // Get current selected squares
    const currentSelections = this.selectedSquares.get(sessionId) || "";
    const selectedPositions = currentSelections.split(";").map(pos => {
      const [roomIdx, coords] = pos.split(":");
      const [posX, posY] = coords.split(",").map(Number);
      return { roomIndex: parseInt(roomIdx), x: posX, y: posY };
    });

    // Complete the card action with the selected squares
    return this.completeCardAction(sessionId, selectedPositions);
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
    selectedSquares: Array<{roomIndex: number, x: number, y: number}>;
  } {
    const activeCardId = this.activeCardPlayers.get(sessionId);
    const selectedCount = this.selectedSquareCount.get(sessionId) || 0;
    const selectionsString = this.selectedSquares.get(sessionId) || "";
    
    const selectedSquares = selectionsString ? selectionsString.split(";").map(pos => {
      const [roomIdx, coords] = pos.split(":");
      const [x, y] = coords.split(",").map(Number);
      return { roomIndex: parseInt(roomIdx), x, y };
    }) : [];

    return {
      hasActiveCard: !!activeCardId,
      activeCardId,
      selectedCount,
      selectedSquares
    };
  }
}
