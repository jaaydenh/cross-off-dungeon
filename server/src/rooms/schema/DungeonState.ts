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

  // Navigation validator for exit adjacency checking
  private navigationValidator = new NavigationValidator();

  initializeBoard() {
    console.log('initializeBoard');
    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 4; y++) {
        this.board.set(`${x},${y}`, new DungeonSquare());
      }
    }
    
    // Create 10 random rooms
    this.generateRooms(10);
    
    // Initialize the displayed rooms array with the first room
    this.displayedRoomIndices.push(0);
    this.roomPositionsX.push(0); // First room is at position (0,0)
    this.roomPositionsY.push(0);
    
    // Assign grid coordinates to the first room at the origin
    this.assignGridCoordinates(0, this.gridOriginX, this.gridOriginY);
    
    // Generate exits for the first room
    this.rooms[0].generateExits();
  }

  generateRooms(count: number) {
    // Clear existing rooms
    this.rooms.clear();
    
    for (let i = 0; i < count; i++) {
      // Generate random width between 6-8 and height between 4-6
      const width = Math.floor(Math.random() * 3) + 6; // 6-8
      const height = Math.floor(Math.random() * 3) + 4; // 4-6
      
      const room = new Room(width, height);
      
      // Add some random inner walls
      const numInnerWalls = Math.floor(Math.random() * (width * height / 10));
      for (let j = 0; j < numInnerWalls; j++) {
        const x = Math.floor(Math.random() * width);
        const y = Math.floor(Math.random() * height);
        
        // Skip if this would be adjacent to an entrance or exit
        if (this.isAdjacentToEntranceOrExit(room, x, y)) {
          continue;
        }
        
        const square = room.getSquare(x, y);
        if (square) {
          square.wall = true;
        }
      }
      
      this.rooms.push(room);
    }
    
    // Shuffle the rooms
    this.shuffleRooms();
    
    // Set the current room to the first one
    this.currentRoomIndex = 0;
  }
  
  shuffleRooms() {
    // Fisher-Yates shuffle algorithm
    for (let i = this.rooms.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.rooms[i], this.rooms[j]] = [this.rooms[j], this.rooms[i]];
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
      // No room exists - find or create a new room
      targetRoomIndex = this.findOrCreateAdjacentRoom(sourceCoords.x, sourceCoords.y, exitDirection);
      targetRoom = this.rooms[targetRoomIndex];
      
      // Assign proper grid coordinates to the new room
      this.assignGridCoordinates(targetRoomIndex, targetX, targetY);
      
      // Set the entrance direction for the new room
      const entranceDirection = this.getOppositeDirection(exitDirection);
      targetRoom.generateExits(entranceDirection);
      
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
    this.players.set(id, new Player(name))
  }

  removePlayer(id: string) {
    this.players.delete(id)
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
    // Calculate target coordinates based on direction (matching addNewRoom logic)
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
    
    // No room exists, find the next available room from the pre-generated rooms
    let nextRoomIndex = -1;
    for (let i = 0; i < this.rooms.length; i++) {
      // Check if this room is already assigned to grid coordinates
      const gridKey = `${this.rooms[i].gridX},${this.rooms[i].gridY}`;
      const isAssigned = this.roomGridPositions.get(gridKey) === i;
      
      if (!isAssigned) {
        // This room hasn't been assigned to the grid yet
        nextRoomIndex = i;
        break;
      }
    }
    
    if (nextRoomIndex === -1) {
      // All rooms have been used, cycle back to reuse rooms
      // Find a room that's not currently displayed
      for (let i = 0; i < this.rooms.length; i++) {
        if (!this.displayedRoomIndices.includes(i)) {
          nextRoomIndex = i;
          break;
        }
      }
      
      // If all rooms are displayed, use the next room in sequence
      if (nextRoomIndex === -1) {
        nextRoomIndex = (this.currentRoomIndex + 1) % this.rooms.length;
      }
    }
    
    // Assign grid coordinates to the new room
    this.assignGridCoordinates(nextRoomIndex, targetX, targetY);
    
    // Set up the room with appropriate entrance direction
    const entranceDirection = this.getOppositeDirection(direction);
    this.rooms[nextRoomIndex].generateExits(entranceDirection);
    
    return nextRoomIndex;
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
}
