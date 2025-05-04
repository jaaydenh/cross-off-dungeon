import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { Player } from "./Player";
import { Client } from "colyseus";
import { DungeonSquare } from "./DungeonSquare";
import { Room } from "./Room";

const BOARD_WIDTH = 4;

export class DungeonState extends Schema {

  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: DungeonSquare }) board = new MapSchema<DungeonSquare>();
  @type([Room]) rooms = new ArraySchema<Room>();
  @type("number") currentRoomIndex = 0;
  @type(["number"]) displayedRoomIndices = new ArraySchema<number>(); // Indices of rooms currently displayed
  @type(["number"]) roomPositionsX = new ArraySchema<number>(); // X positions of displayed rooms
  @type(["number"]) roomPositionsY = new ArraySchema<number>(); // Y positions of displayed rooms

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
    
    // Generate exits for the first room
    this.rooms[0].generateExits();
  }

  generateRooms(count: number) {
    // Clear existing rooms
    this.rooms.clear();
    
    for (let i = 0; i < count; i++) {
      // Generate random width and height between 6-10
      const width = Math.floor(Math.random() * 5) + 6; // 6-10
      const height = Math.floor(Math.random() * 5) + 6; // 6-10
      
      const room = new Room(width, height);
      
      // Add some random walls inside the room (not just on the border)
      const numInnerWalls = Math.floor(Math.random() * (width * height / 10));
      for (let j = 0; j < numInnerWalls; j++) {
        const x = Math.floor(Math.random() * (width - 2)) + 1; // Avoid border
        const y = Math.floor(Math.random() * (height - 2)) + 1; // Avoid border
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
  
  // Add a new room when a player exits through an exit
  addNewRoom(exitDirection: string, exitIndex: number) {
    // Get the current room
    const currentRoom = this.getCurrentRoom();
    if (!currentRoom) return;
    
    // Get the next room from the array
    const nextRoomIndex = (this.currentRoomIndex + 1) % this.rooms.length;
    const nextRoom = this.rooms[nextRoomIndex];
    
    // Set the entrance of the next room based on the exit direction of the current room
    const entranceDirection = currentRoom.getOppositeDirection(exitDirection);
    nextRoom.generateExits(entranceDirection);
    
    // Calculate the position of the new room relative to the current room
    let offsetX = 0;
    let offsetY = 0;
    
    // Determine the position offset based on the exit direction
    switch (exitDirection) {
      case "north":
        offsetY = -1; // New room is above
        break;
      case "east":
        offsetX = 1; // New room is to the right
        break;
      case "south":
        offsetY = 1; // New room is below
        break;
      case "west":
        offsetX = -1; // New room is to the left
        break;
    }
    
    // Get the current room's position
    const currentRoomIndex = this.displayedRoomIndices.indexOf(this.currentRoomIndex);
    const currentX = this.roomPositionsX[currentRoomIndex];
    const currentY = this.roomPositionsY[currentRoomIndex];
    
    // Calculate the new room's position
    const newX = currentX + offsetX;
    const newY = currentY + offsetY;
    
    // Add the new room to the displayed rooms
    this.displayedRoomIndices.push(nextRoomIndex);
    this.roomPositionsX.push(newX);
    this.roomPositionsY.push(newY);
    
    // Update the current room index
    this.currentRoomIndex = nextRoomIndex;
    
    console.log(`Added new room at position (${newX}, ${newY}), direction: ${exitDirection}`);
    
    return nextRoom;
  }

  createPlayer(id: string, name: string) {
    this.players.set(id, new Player(name))
  }

  removePlayer(id: string) {
    this.players.delete(id)
  }

  crossSquare(client: Client, data: any) {
    const player = this.players.get(client.sessionId);
    const currentRoom = this.getCurrentRoom();

    if (client.sessionId && currentRoom) {
      const { x, y } = data;
      
      // Check if the coordinates are valid for the current room
      if (currentRoom.isValidPosition(x, y)) {
        const square = currentRoom.getSquare(x, y);
        
        // Only allow crossing squares that are not walls
        if (square && !square.wall) {
          square.checked = true;
          console.log(player.name, "crosses square", x, y);
          
          // Check if the square is an exit
          if (square.exit) {
            // Find which exit was crossed
            let exitIndex = -1;
            for (let i = 0; i < currentRoom.exitX.length; i++) {
              if (currentRoom.exitX[i] === x && currentRoom.exitY[i] === y) {
                exitIndex = i;
                break;
              }
            }
            
            if (exitIndex !== -1) {
              // Get the direction of the exit
              const exitDirection = currentRoom.exitDirections[exitIndex];
              
              // Add a new room in that direction
              this.addNewRoom(exitDirection, exitIndex);
            }
          }
        }
      }
    }
  }
}
