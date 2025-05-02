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

  initializeBoard() {
    console.log('initializeBoard');
    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 4; y++) {
        this.board.set(`${x},${y}`, new DungeonSquare());
      }
    }
    
    // Create 10 random rooms
    this.generateRooms(10);
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
        }
      }
    }
  }
}
