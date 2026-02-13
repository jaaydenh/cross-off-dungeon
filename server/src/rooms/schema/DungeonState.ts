import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { Player } from "./Player";
import { Client } from "colyseus";
import { DungeonSquare } from "./DungeonSquare";
import { Room } from "./Room";
import { NavigationValidator } from "../NavigationValidator";
import { MonsterCard } from "./MonsterCard";
import { MonsterFactory } from "../MonsterFactory";
import { Card } from "./Card";
import { HEROIC_MOVE_AND_FIGHT_CARD_ID, COMBAT_CARD_ID } from "../cards/CardRegistry";
import type { CardColor } from "./Card";

const BOARD_WIDTH = 4;
type GameStatus = "in_progress" | "won" | "lost";
type Selection =
  | { kind: "room"; roomIndex: number; x: number; y: number }
  | { kind: "monster"; monsterId: string; x: number; y: number };

type MonsterAttackCardSnapshot = {
  id: string;
  type: string;
  name: string;
  description: string;
  defenseSymbol: "empty" | "block" | "counter";
  color: CardColor;
};

type MonsterAttackOutcome = "discarded" | "returned_to_deck" | "counter_attack" | "no_card_available";

export type MonsterAttackEvent = {
  playerSessionId: string;
  monsterId: string;
  monsterName: string;
  monsterAttack: number;
  attackNumber: number;
  card?: MonsterAttackCardSnapshot;
  outcome: MonsterAttackOutcome;
  counterSquare?: { x: number; y: number } | null;
};

export type MonsterAttackPhaseResult = {
  turn: number;
  totalAttacks: number;
  attacks: MonsterAttackEvent[];
};

type DrawnRoomCard = {
  drawIndex: number;
  isBossRoom: boolean;
};

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
  @type("number") currentDay = 1;
  @type("number") maxDays = 3;
  @type("string") gameStatus: GameStatus = "in_progress";

  // Room deck properties
  @type("number") roomDeckSize = 10;
  @type("number") roomsDrawn = 0;
  @type("number") bossRoomDrawIndex = -1;
  @type("boolean") bossRoomDiscovered = false;
  @type("string") bossMonsterId = "";
  @type("boolean") bossDefeated = false;

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
  private pendingMonsterAttackPhaseResult: MonsterAttackPhaseResult | null = null;

  initializeBoard() {
    console.log('initializeBoard');
    this.configureRoomDeckForPlayerCount(1);

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

  private getRoomDeckSizeForPlayerCount(playerCount: number): number {
    switch (Math.max(1, Math.min(4, Math.floor(playerCount || 1)))) {
      case 1:
        return 10;
      case 2:
        return 15;
      case 3:
        return 20;
      default:
        return 25;
    }
  }

  private rollBossRoomDrawIndex(deckSize: number): number {
    const bottomRangeStart = Math.max(1, deckSize - 4);
    const bottomRangeSize = deckSize - bottomRangeStart + 1;
    return bottomRangeStart + Math.floor(Math.random() * bottomRangeSize);
  }

  private configureRoomDeckForPlayerCount(playerCount: number): void {
    this.roomDeckSize = this.getRoomDeckSizeForPlayerCount(playerCount);
    this.roomsDrawn = Math.min(this.rooms.length, this.roomDeckSize);
    this.bossRoomDrawIndex = this.rollBossRoomDrawIndex(this.roomDeckSize);
    this.bossRoomDiscovered = false;
  }

  private drawRoomCard(): DrawnRoomCard | null {
    if (this.roomsDrawn >= this.roomDeckSize) {
      console.log("No room cards left in deck");
      return null;
    }

    this.roomsDrawn += 1;
    const drawIndex = this.roomsDrawn;
    const isBossRoom = drawIndex === this.bossRoomDrawIndex;
    if (isBossRoom) {
      this.bossRoomDiscovered = true;
    }

    return { drawIndex, isBossRoom };
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

  drawBossMonsterCard(): MonsterCard {
    const bossMonster = MonsterFactory.createBoss(`boss_${this.currentDay}_${this.roomsDrawn}`);
    this.activeMonsters.push(bossMonster);
    this.bossMonsterId = bossMonster.id;
    console.log(`Drew boss monster: ${bossMonster.name} (${bossMonster.id})`);
    return bossMonster;
  }

  /**
   * Create the initial starting room
   */
  createInitialRoom() {
    const roomCard = this.drawRoomCard();
    const room = this.createNewRoom(undefined, roomCard?.isBossRoom ?? false);
    room.generateExits(); // No entrance direction for the starting room

    // Add an entrance to the first room (players need a way to enter)
    room.createEntrance("south"); // Create entrance from the south

    this.rooms.push(room);
    this.currentRoomIndex = 0;

    // Draw a monster for the initial room too
    const monster = room.isBossRoom ? this.drawBossMonsterCard() : this.drawMonsterCard();
    if (monster) {
      monster.connectedToRoomIndex = 0;
      console.log(`Assigned monster ${monster.name} to initial room 0`);
    }
  }

  /**
   * Create a new room with random dimensions and wall placement
   * @param entranceDirection Optional entrance direction for the room
   * @param isBossRoom Whether this room is the boss room from the room deck
   * @returns A new Room instance
   */
  createNewRoom(entranceDirection?: string, isBossRoom: boolean = false): Room {
    // Generate random dimensions
    const width = Math.floor(Math.random() * 3) + 6; // 6-8
    const height = Math.floor(Math.random() * 3) + 4; // 4-6

    const room = new Room(width, height);
    room.isBossRoom = isBossRoom;

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
      const roomCard = this.drawRoomCard();
      if (!roomCard) {
        console.warn(`Cannot create new room from exit ${exitDirection}: room deck is empty`);
        this.currentRoomIndex = fromRoomIndex;
        return sourceRoom;
      }

      // No room exists - create a new room with real-time generation
      const entranceDirection = this.getOppositeDirection(exitDirection);
      const newRoom = this.createNewRoom(entranceDirection, roomCard.isBossRoom);

      // Add the new room to the rooms array
      targetRoomIndex = this.rooms.length;
      this.rooms.push(newRoom);
      targetRoom = newRoom;

      // Assign proper grid coordinates to the new room
      this.assignGridCoordinates(targetRoomIndex, targetX, targetY);

      // Draw a monster for the new room
      const monster = newRoom.isBossRoom ? this.drawBossMonsterCard() : this.drawMonsterCard();
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
    this.reconfigureRoomDeckForLobbyPlayerCount();
  }

  removePlayer(id: string) {
    if (this.players.has(id)) {
      this.players.delete(id);
    }

    // Clean up any in-progress card action state for this session.
    if (this.activeCardPlayers.has(id)) {
      this.activeCardPlayers.delete(id);
    }
    this.selectedSquares.delete(id);
    this.selectedSquareCount.delete(id);

    // Remove player from turn order
    this.removePlayerFromTurnOrder(id);
    this.reconfigureRoomDeckForLobbyPlayerCount();
  }

  private reconfigureRoomDeckForLobbyPlayerCount(): void {
    // Keep deck sizing dynamic only before exploration has begun.
    if (this.currentDay !== 1 || this.currentTurn !== 1 || this.rooms.length > 1) {
      return;
    }

    this.configureRoomDeckForPlayerCount(this.players.size || 1);
  }

  crossSquare(client: Client, data: any) {
    if (!this.isGameInProgress()) {
      return { success: false, error: "Game is already complete" };
    }

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
    const activeCard = this.getActiveCard(client.sessionId);
    if (!activeCard) {
      return { success: false, error: "No active card for player" };
    }

    // Do not allow mixing monster + room selections in a single card action.
    const existing = this.parseSelections(this.selectedSquares.get(client.sessionId) || "");
    if (existing.some((s) => s.kind === "monster") && !this.allowsMixedRoomAndMonsterSelections(activeCard)) {
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

    const roomCard = this.drawRoomCard();
    if (!roomCard) {
      return -1;
    }

    // No room exists - create a new one with real-time generation
    const entranceDirection = this.getOppositeDirection(direction);
    const newRoom = this.createNewRoom(entranceDirection, roomCard.isBossRoom);

    // Add the new room to the rooms array
    const newRoomIndex = this.rooms.length;
    this.rooms.push(newRoom);

    // Assign grid coordinates to the new room
    this.assignGridCoordinates(newRoomIndex, targetX, targetY);

    const monster = newRoom.isBossRoom ? this.drawBossMonsterCard() : this.drawMonsterCard();
    if (monster) {
      monster.connectedToRoomIndex = newRoomIndex;
    }

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

    this.configureRoomDeckForPlayerCount(this.players.size || 1);
    this.currentDay = 1;
    this.gameStatus = "in_progress";
    this.bossDefeated = false;

    // Initialize turn state
    this.currentTurn = 1;
    this.turnInProgress = true;

    console.log(`Turn state initialized for ${this.turnOrder.length} players`);
  }

  isGameInProgress(): boolean {
    return this.gameStatus === "in_progress";
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

    if (!this.isGameInProgress()) {
      console.log("Cannot advance turn: game is already complete");
      return;
    }

    const dayCompleted = this.areAllPlayerDecksEmptyForDay();

    // Resolve monster attacks before resetting players for the next round.
    this.pendingMonsterAttackPhaseResult = this.resolveMonsterAttackPhase();
    this.checkAndHandleBossDefeat();
    if (dayCompleted) {
      if (this.currentDay >= this.maxDays && !this.bossDefeated) {
        this.gameStatus = "lost";
        this.turnInProgress = false;
        this.resetPlayersForFreshTurn();
        this.currentTurn++;
        console.log(`Game lost on day ${this.currentDay}: boss not defeated in time`);
        return;
      }

      this.startNextDay();
    } else {
      this.resetPlayersForFreshTurn();
    }

    this.currentTurn++;

    if (dayCompleted && this.isGameInProgress()) {
      console.log(`Advanced to turn ${this.currentTurn} (day ${this.currentDay})`);
      return;
    }

    console.log(`Advanced to turn ${this.currentTurn}`);
  }

  private resetPlayersForFreshTurn(): void {
    this.players.forEach((player) => {
      player.turnStatus = "not_started";
      player.hasDrawnCard = false;
    });
  }

  private areAllPlayerDecksEmptyForDay(): boolean {
    if (this.turnOrder.length === 0) {
      return false;
    }

    for (const sessionId of this.turnOrder) {
      const player = this.players.get(sessionId);
      if (!player) {
        return false;
      }

      if (player.deck.length > 0) {
        return false;
      }
    }

    return true;
  }

  private shuffleCards(cards: Card[]): void {
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
  }

  private startNextDay(): void {
    this.currentDay++;

    this.players.forEach((player) => {
      const carryOverCards: Card[] = [];

      while (player.deck.length > 0) {
        const card = player.deck.shift();
        if (card) {
          card.isActive = false;
          carryOverCards.push(card);
        }
      }

      while (player.drawnCards.length > 0) {
        const card = player.drawnCards.shift();
        if (card) {
          card.isActive = false;
          carryOverCards.push(card);
        }
      }

      while (player.discardPile.length > 0) {
        const card = player.discardPile.shift();
        if (card) {
          card.isActive = false;
          carryOverCards.push(card);
        }
      }

      this.shuffleCards(carryOverCards);
      carryOverCards.forEach((card) => player.deck.push(card));
    });

    this.activeCardPlayers.clear();
    this.selectedSquares.clear();
    this.selectedSquareCount.clear();
    this.resetPlayersForFreshTurn();
    this.turnInProgress = true;

    console.log(`Day ${this.currentDay} has started`);
  }

  private checkAndHandleBossDefeat(): boolean {
    if (this.bossDefeated) {
      return true;
    }

    if (!this.bossMonsterId) {
      return false;
    }

    const boss = this.activeMonsters.find((monster) => monster.id === this.bossMonsterId);
    if (!boss || !boss.isCompleted()) {
      return false;
    }

    this.bossDefeated = true;
    this.gameStatus = "won";
    this.turnInProgress = false;
    console.log(`Boss ${boss.name} defeated. Players win.`);
    return true;
  }

  /**
   * Returns the latest monster attack phase result once, then clears it.
   * Intended for room-layer messaging right after turn advancement.
   */
  consumePendingMonsterAttackPhaseResult(): MonsterAttackPhaseResult | null {
    const result = this.pendingMonsterAttackPhaseResult;
    this.pendingMonsterAttackPhaseResult = null;
    return result;
  }

  private resolveMonsterAttackPhase(): MonsterAttackPhaseResult {
    const attacks: MonsterAttackEvent[] = [];
    const attackingMonsters = this.activeMonsters.filter(
      (monster) =>
        monster.playerOwnerId !== "" &&
        monster.connectedToRoomIndex === -1 &&
        !monster.isCompleted()
    );

    for (const monster of attackingMonsters) {
      const playerSessionId = monster.playerOwnerId;
      const player = this.players.get(playerSessionId);
      if (!player) {
        continue;
      }

      const monsterAttack = Math.max(1, Math.min(3, Math.floor(monster.attackRating || 1)));
      for (let attackNumber = 1; attackNumber <= monsterAttack; attackNumber++) {
        if (player.deck.length === 0) {
          attacks.push({
            playerSessionId,
            monsterId: monster.id,
            monsterName: monster.name,
            monsterAttack,
            attackNumber,
            outcome: "no_card_available"
          });
          continue;
        }

        const defenseCard = player.deck.shift();
        if (!defenseCard) {
          attacks.push({
            playerSessionId,
            monsterId: monster.id,
            monsterName: monster.name,
            monsterAttack,
            attackNumber,
            outcome: "no_card_available"
          });
          continue;
        }

        const defenseSymbol = (defenseCard.defenseSymbol || "empty") as "empty" | "block" | "counter";
        const cardColor = (defenseCard.color || "clear") as CardColor;
        const cardSnapshot: MonsterAttackCardSnapshot = {
          id: defenseCard.id,
          type: defenseCard.type,
          name: defenseCard.name || "",
          description: defenseCard.description,
          defenseSymbol,
          color: cardColor
        };

        if (defenseSymbol === "block") {
          // Block returns the card to the player's deck.
          player.deck.push(defenseCard);
          attacks.push({
            playerSessionId,
            monsterId: monster.id,
            monsterName: monster.name,
            monsterAttack,
            attackNumber,
            card: cardSnapshot,
            outcome: "returned_to_deck"
          });
          continue;
        }

        if (defenseSymbol === "counter") {
          // Counter crosses one random available monster square, then returns card to deck.
          const counterSquare = this.crossRandomUncrossedMonsterSquare(monster);
          this.checkAndHandleBossDefeat();
          player.deck.push(defenseCard);
          attacks.push({
            playerSessionId,
            monsterId: monster.id,
            monsterName: monster.name,
            monsterAttack,
            attackNumber,
            card: cardSnapshot,
            outcome: "counter_attack",
            counterSquare
          });
          continue;
        }

        // Empty symbol loses the card to discard.
        player.discardPile.push(defenseCard);
        attacks.push({
          playerSessionId,
          monsterId: monster.id,
          monsterName: monster.name,
          monsterAttack,
          attackNumber,
          card: cardSnapshot,
          outcome: "discarded"
        });
      }
    }

    return {
      turn: this.currentTurn,
      totalAttacks: attacks.length,
      attacks
    };
  }

  private crossRandomUncrossedMonsterSquare(monster: MonsterCard): { x: number; y: number } | null {
    const availableSquares = monster.squares.filter((square) => square.filled && !square.checked);
    if (availableSquares.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * availableSquares.length);
    const selectedSquare = availableSquares[randomIndex];
    selectedSquare.checked = true;

    return { x: selectedSquare.x, y: selectedSquare.y };
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
    if (!player || !this.turnInProgress || !this.isGameInProgress()) {
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
    if (!this.isGameInProgress()) {
      return { success: false, error: "Game is already complete" };
    }

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

  private drawCardsFromDeckForEffect(sessionId: string, count: number): number {
    const player = this.players.get(sessionId);
    if (!player || count <= 0) {
      return 0;
    }

    let drawnCount = 0;
    while (drawnCount < count && player.deck.length > 0) {
      const drawnCard = player.deck.shift();
      if (!drawnCard) break;

      player.drawnCards.push(drawnCard);
      drawnCount += 1;
    }

    return drawnCount;
  }

  /**
   * Activate a drawn card for square selection
   * @param sessionId Session ID of the player
   * @param cardId ID of the card to activate
   * @returns Result object with success status and message
   */
  playCard(sessionId: string, cardId: string): { success: boolean; message?: string; error?: string } {
    if (!this.isGameInProgress()) {
      return { success: false, error: "Game is already complete" };
    }

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

  private getActiveCard(sessionId: string) {
    const activeCardId = this.activeCardPlayers.get(sessionId);
    if (!activeCardId) return null;

    const player = this.players.get(sessionId);
    if (!player) return null;

    return player.drawnCards.find((card) => card.id === activeCardId) || null;
  }

  private cardAllowsRoom(card: { selectionTarget?: string }): boolean {
    return card.selectionTarget === "room" || card.selectionTarget === "room_or_monster";
  }

  private cardAllowsMonster(card: { selectionTarget?: string }): boolean {
    return (
      card.selectionTarget === "monster" ||
      card.selectionTarget === "room_or_monster" ||
      card.selectionTarget === "monster_each"
    );
  }

  private cardIsMonsterEach(card: { selectionTarget?: string }): boolean {
    return card.selectionTarget === "monster_each";
  }

  private isHeroicMoveAndFightCard(card?: { type?: string } | null): boolean {
    return card?.type === HEROIC_MOVE_AND_FIGHT_CARD_ID;
  }

  private isCombatCard(card?: { type?: string } | null): boolean {
    return card?.type === COMBAT_CARD_ID;
  }

  private allowsMixedRoomAndMonsterSelections(card?: { type?: string } | null): boolean {
    return this.isHeroicMoveAndFightCard(card);
  }

  private getSelections(sessionId: string): Selection[] {
    const selectionsString = this.selectedSquares.get(sessionId) || "";
    return this.parseSelections(selectionsString);
  }

  private serializeSelections(selections: Selection[]): string {
    if (selections.length === 0) return "";

    return selections
      .map((sel) => {
        if (sel.kind === "room") {
          return `r:${sel.roomIndex}:${sel.x},${sel.y}`;
        }
        return `m:${sel.monsterId}:${sel.x},${sel.y}`;
      })
      .join(";");
  }

  private setSelections(sessionId: string, selections: Selection[]): void {
    const serialized = this.serializeSelections(selections);
    this.selectedSquares.set(sessionId, serialized);
    this.selectedSquareCount.set(sessionId, selections.length);
  }

  private clearSelections(sessionId: string): void {
    this.selectedSquares.delete(sessionId);
    this.selectedSquareCount.delete(sessionId);
  }

  private getExitIndexAtCoordinates(room: Room, x: number, y: number): number {
    for (let i = 0; i < room.exitX.length; i++) {
      if (room.exitX[i] === x && room.exitY[i] === y) {
        return i;
      }
    }
    return -1;
  }

  private crossRoomSquare(
    sessionId: string,
    roomIndex: number,
    x: number,
    y: number,
    crossedExits: Array<{ roomIndex: number; exitIndex: number }>
  ): void {
    const room = this.rooms[roomIndex];
    if (!room) return;

    const square = room.getSquare(x, y);
    if (!square) return;

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

  private resolveCrossedExits(crossedExits: Array<{ roomIndex: number; exitIndex: number }>): void {
    const seenExits = new Set<string>();
    for (const { roomIndex, exitIndex } of crossedExits) {
      const key = `${roomIndex}:${exitIndex}`;
      if (seenExits.has(key)) continue;
      seenExits.add(key);

      const room = this.rooms[roomIndex];
      if (!room) continue;

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
  selectSquareForCard(sessionId: string, roomIndex: number, x: number, y: number): {
    success: boolean;
    message?: string;
    error?: string;
    invalidSquare?: boolean;
    completed?: boolean;
  } {
    if (!this.isGameInProgress()) {
      return { success: false, error: "Game is already complete" };
    }

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
    const roomSelections = currentSelections.filter(
      (s): s is { kind: "room"; roomIndex: number; x: number; y: number } => s.kind === "room"
    );
    const monsterSelections = currentSelections.filter(
      (s): s is { kind: "monster"; monsterId: string; x: number; y: number } => s.kind === "monster"
    );

    if (monsterSelections.length > 0 && !this.allowsMixedRoomAndMonsterSelections(card)) {
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

      const hasRequiredAdjacency =
        this.isAdjacentToEntranceOrCrossedSquare(room, x, y) ||
        this.isAdjacentToEntranceOrCrossedSquare(room, rightX, rightY);
      if (!hasRequiredAdjacency) {
        return {
          success: false,
          error: "At least one square in the pair must be adjacent to the entrance or an existing crossed square",
          invalidSquare: true
        };
      }

      const alreadySelected =
        roomSelections.some((pos) => pos.roomIndex === roomIndex && pos.x === x && pos.y === y) ||
        roomSelections.some((pos) => pos.roomIndex === roomIndex && pos.x === rightX && pos.y === rightY);
      if (alreadySelected) {
        return { success: false, error: "Square already selected", invalidSquare: true };
      }

      const pairSelections: Array<{ kind: "room"; roomIndex: number; x: number; y: number }> = [
        { kind: "room", roomIndex, x, y },
        { kind: "room", roomIndex, x: rightX, y: rightY }
      ];

      const crossedExits: Array<{ roomIndex: number; exitIndex: number }> = [];
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

      const rowSelections: Selection[] = [];
      for (let checkX = 0; checkX < room.width; checkX++) {
        const rowSquare = room.getSquare(checkX, y);
        if (!rowSquare || rowSquare.wall) continue;
        if (rowSquare.checked) continue;
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
    const alreadySelected = roomSelections.some(pos =>
      pos.roomIndex === roomIndex && pos.x === x && pos.y === y
    );
    if (alreadySelected) {
      return { success: false, error: "Square already selected", invalidSquare: true };
    }

    if (this.isHeroicMoveAndFightCard(card) && roomSelections.length >= 2) {
      return {
        success: false,
        error: "Move 2 allows selecting only 2 room squares",
        invalidSquare: true
      };
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
    } else if (roomSelections.length === 0 && card.requiresRoomStartAdjacency) {
      const isValidStart = this.isValidStartingSquare(room, x, y);
      if (!isValidStart) {
        return {
          success: false,
          error: "First square must be the entrance, adjacent to the entrance, or adjacent to an existing crossed square",
          invalidSquare: true
        };
      }
    }

    const updatedSelections = [...currentSelections, { kind: "room" as const, roomIndex, x, y }];
    this.setSelections(sessionId, updatedSelections);

    const newCount = roomSelections.length + 1;
    const cardLabelLimit = this.isHeroicMoveAndFightCard(card) ? 2 : maxSelections;
    const maxLabel = cardLabelLimit > 0 ? `/${cardLabelLimit}` : "";

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

  private isAdjacentToEntranceOrCrossedSquare(room: Room, x: number, y: number): boolean {
    const isOrthAdjacent = (ax: number, ay: number, bx: number, by: number) =>
      (Math.abs(ax - bx) === 1 && ay === by) || (Math.abs(ay - by) === 1 && ax === bx);

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
  private isValidStartingSquare(room: Room, x: number, y: number): boolean {
    // For the first square of a card action, allow placement on the entrance square,
    // adjacent (orthogonally) to the entrance, OR adjacent to any already-crossed square.
    const isOrthAdjacent = (ax: number, ay: number, bx: number, by: number) =>
      (Math.abs(ax - bx) === 1 && ay === by) || (Math.abs(ay - by) === 1 && ax === bx);

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
    const crossedExits: Array<{ roomIndex: number; exitIndex: number }> = [];
    for (const sel of selectedSelections) {
      if (sel.kind === "room") {
        this.crossRoomSquare(sessionId, sel.roomIndex, sel.x, sel.y, crossedExits);
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

    this.checkAndHandleBossDefeat();

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

    const requestedBonusDraws = Math.max(0, Math.floor(card.drawCardsOnResolve || 0));
    const actualBonusDraws =
      requestedBonusDraws > 0 ? this.drawCardsFromDeckForEffect(sessionId, requestedBonusDraws) : 0;

    console.log(`Player ${sessionId} completed card action with card ${activeCardId}`);

    let message = "Card action completed! Squares crossed and card moved to discard pile.";
    if (requestedBonusDraws > 0) {
      if (actualBonusDraws === requestedBonusDraws) {
        message += ` Drew ${actualBonusDraws} bonus card${actualBonusDraws === 1 ? "" : "s"}.`;
      } else if (actualBonusDraws > 0) {
        message += ` Drew ${actualBonusDraws} bonus card${actualBonusDraws === 1 ? "" : "s"} (deck emptied before drawing all requested cards).`;
      } else {
        message += " Could not draw a bonus card because the deck is empty.";
      }
    }

    return {
      success: true,
      message,
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
  confirmCardAction(sessionId: string, data?: any): { success: boolean; message?: string; error?: string; completed?: boolean } {
    if (!this.isGameInProgress()) {
      return { success: false, error: "Game is already complete" };
    }

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
      const roomSquares: Array<{ roomIndex: number; x: number; y: number }> = payloadRoomSquares || [];
      const monsterSquares: Array<{ monsterId: string; x: number; y: number }> = payloadMonsterSquares || [];

      if (
        roomSquares.length > 0 &&
        monsterSquares.length > 0 &&
        !this.allowsMixedRoomAndMonsterSelections(card)
      ) {
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

          const roomIndex = (sq as any).roomIndex;
          const x = (sq as any).x;
          const y = (sq as any).y;
          if (!Number.isFinite(roomIndex) || !Number.isFinite(x) || !Number.isFinite(y)) {
            this.clearSelections(sessionId);
            return { success: false, error: "Invalid square selection payload" };
          }

          const res = this.selectSquareForCard(sessionId, roomIndex, x, y);
          if (!res.success) {
            this.clearSelections(sessionId);
            return { success: false, error: res.error || "Invalid square selection" };
          }
        } else {
          for (const sq of roomSquares) {
            if (!sq || typeof sq !== "object") {
              this.clearSelections(sessionId);
              return { success: false, error: "Invalid square selection payload" };
            }

            const roomIndex = (sq as any).roomIndex;
            const x = (sq as any).x;
            const y = (sq as any).y;
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

      if (monsterSquares.length > 0) {
        if (!this.cardAllowsMonster(card)) {
          return { success: false, error: "This card does not allow selecting monster squares" };
        }

        for (const pos of monsterSquares) {
          if (!pos || typeof pos !== "object") {
            this.clearSelections(sessionId);
            return { success: false, error: "Invalid monster selection payload" };
          }

          const monsterId = (pos as any).monsterId;
          const x = (pos as any).x;
          const y = (pos as any).y;
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

    const roomSelections = selectedSelections.filter(
      (s): s is { kind: "room"; roomIndex: number; x: number; y: number } => s.kind === "room"
    );
    const monsterSelections = selectedSelections.filter(
      (s): s is { kind: "monster"; monsterId: string; x: number; y: number } => s.kind === "monster"
    );

    if (
      roomSelections.length > 0 &&
      monsterSelections.length > 0 &&
      !this.allowsMixedRoomAndMonsterSelections(card)
    ) {
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

      const byMonster = new Map<string, Array<{ kind: "monster"; monsterId: string; x: number; y: number }>>();
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

    if (this.isHeroicMoveAndFightCard(card)) {
      if (roomSelections.length !== 2) {
        return { success: false, error: "Move 2 requires exactly 2 room squares" };
      }

      const roomIndex = roomSelections[0].roomIndex;
      if (roomSelections.some((s) => s.roomIndex !== roomIndex)) {
        return { success: false, error: "Move 2 must stay within a single room" };
      }

      const eligibleMonsters = this.getPlayerMonsters(sessionId).filter((m) => !m.isCompleted());
      const hasEligibleMonster = eligibleMonsters.length > 0;

      if (monsterSelections.length === 0) {
        if (hasEligibleMonster) {
          return {
            success: false,
            error: "Move 2 and fight 2 requires at least 1 monster square when a monster is available"
          };
        }

        return this.completeCardAction(sessionId, selectedSelections);
      }

      if (monsterSelections.length > 2) {
        return { success: false, error: "Fight 2 allows selecting at most 2 monster squares" };
      }

      const monsterId = monsterSelections[0].monsterId;
      if (monsterSelections.some((s) => s.monsterId !== monsterId)) {
        return { success: false, error: "Fight 2 must target a single monster" };
      }

      const targetMonster = eligibleMonsters.find((m) => m.id === monsterId);
      if (!targetMonster) {
        return { success: false, error: "Fight 2 must target an available monster you own" };
      }

      return this.completeCardAction(sessionId, selectedSelections);
    }

    const minSelections = card.minSelections || 1;
    const maxSelections = card.maxSelections || 0;

    // Enforce selection target constraints.
    if (card.selectionTarget === "room") {
      if (roomSelections.length === 0) return { success: false, error: "This card requires selecting room squares" };
      if (monsterSelections.length > 0) return { success: false, error: "This card does not allow selecting monster squares" };
    } else if (card.selectionTarget === "monster") {
      if (monsterSelections.length === 0) return { success: false, error: "This card requires selecting monster squares" };
      if (roomSelections.length > 0) return { success: false, error: "This card does not allow selecting room squares" };
    } else if (card.selectionTarget === "room_or_monster") {
      if (roomSelections.length === 0 && monsterSelections.length === 0) {
        return { success: false, error: "No squares selected to confirm" };
      }
      if (
        roomSelections.length > 0 &&
        monsterSelections.length > 0 &&
        !this.allowsMixedRoomAndMonsterSelections(card)
      ) {
        return { success: false, error: "Cannot confirm a move that mixes room and monster selections" };
      }
    } else if (card.selectionTarget === "monster_each") {
      // Handled above.
    } else {
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
  getCardSelectionState(sessionId: string): {
    hasActiveCard: boolean;
    activeCardId?: string;
    selectedCount: number;
    selectedSquares: Array<{ roomIndex: number, x: number, y: number }>;
    selectedMonsterSquares: Array<{ monsterId: string, x: number, y: number }>;
  } {
    const activeCardId = this.activeCardPlayers.get(sessionId);
    const selectionsString = this.selectedSquares.get(sessionId) || "";

    const parsed = this.parseSelections(selectionsString);
    const selectedCount = parsed.length;
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
    const monsterSelections = currentSelections.filter(
      (s): s is { kind: "monster"; monsterId: string; x: number; y: number } => s.kind === "monster"
    );

    if (roomSelections.length > 0 && !this.allowsMixedRoomAndMonsterSelections(card)) {
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

      const alreadySelected =
        monsterSelections.some((pos) => pos.monsterId === monster.id && pos.x === x && pos.y === y) ||
        monsterSelections.some((pos) => pos.monsterId === monster.id && pos.x === rightX && pos.y === rightY);
      if (alreadySelected) {
        return { success: false, error: "Square already selected", invalidSquare: true };
      }

      leftSquare.checked = true;
      rightSquare.checked = true;

      const pairSelections: Array<{ kind: "monster"; monsterId: string; x: number; y: number }> = [
        { kind: "monster", monsterId: monster.id, x, y },
        { kind: "monster", monsterId: monster.id, x: rightX, y: rightY }
      ];

      const updatedSelections: Selection[] = [...currentSelections, ...pairSelections];
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

    const currentForMonster = monsterSelections.filter((p) => p.monsterId === monster.id);
    if (this.isHeroicMoveAndFightCard(card) && currentForMonster.length >= 2) {
      return {
        success: false,
        error: "Fight 2 allows selecting only 2 monster squares",
        invalidSquare: true
      };
    }

    const maxSelections = card.maxSelections || 0;
    if (maxSelections > 0) {
      if (allowsMultiMonster) {
        if (currentForMonster.length >= maxSelections) {
          return {
            success: false,
            error: `Maximum of ${maxSelections} squares can be selected per monster`,
            invalidSquare: true
          };
        }
      } else if (monsterSelections.length >= maxSelections) {
        return {
          success: false,
          error: `Maximum of ${maxSelections} squares can be selected per card`,
          invalidSquare: true
        };
      }
    }

    const isOrthAdjacent = (ax: number, ay: number, bx: number, by: number) =>
      (Math.abs(ax - bx) === 1 && ay === by) || (Math.abs(ay - by) === 1 && ax === bx);
    const isDiagonalAdjacent = (ax: number, ay: number, bx: number, by: number) =>
      Math.abs(ax - bx) === 1 && Math.abs(ay - by) === 1;

    if (card.requiresConnected && currentForMonster.length > 0) {
      const isConnected = this.isCombatCard(card)
        ? currentForMonster.some((pos) => isDiagonalAdjacent(x, y, pos.x, pos.y))
        : currentForMonster.some((pos) => isOrthAdjacent(x, y, pos.x, pos.y));
      if (!isConnected) {
        const error = this.isCombatCard(card)
          ? "Square must be diagonally connected to selected squares"
          : "Square must be orthogonally connected to selected squares";
        return { success: false, error, invalidSquare: true };
      }
    }

    const updatedSelections: Selection[] = [...currentSelections, { kind: "monster", monsterId: monster.id, x, y }];
    this.setSelections(sessionId, updatedSelections);

    const newCountForMonster = currentForMonster.length + 1;
    const cardLabelLimit = this.isHeroicMoveAndFightCard(card) ? 2 : maxSelections;
    const maxLabel = cardLabelLimit > 0 ? `/${cardLabelLimit}` : "";

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
  claimMonster(sessionId: string, monsterId: string): { success: boolean; message?: string; error?: string } {
    if (!this.isGameInProgress()) {
      return { success: false, error: "Game is already complete" };
    }

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
    if (!this.isGameInProgress()) {
      return { success: false, error: "Game is already complete" };
    }

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
    const activeCard = this.getActiveCard(sessionId);
    if (!activeCard) {
      return { success: false, error: "No active card for player" };
    }

    // Do not allow mixing monster + room selections in a single card action.
    const existing = this.parseSelections(this.selectedSquares.get(sessionId) || "");
    if (existing.some((s) => s.kind === "room") && !this.allowsMixedRoomAndMonsterSelections(activeCard)) {
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
