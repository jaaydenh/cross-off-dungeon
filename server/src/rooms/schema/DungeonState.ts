import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { Player } from "./Player";
import { Client } from "colyseus";
import { DungeonSquare } from "./DungeonSquare";

const BOARD_WIDTH = 4;

export class DungeonState extends Schema {

  @type({ map: Player }) players = new MapSchema<Player>();
  @type({ map: DungeonSquare }) board = new MapSchema<DungeonSquare>();

  initializeBoard() {
    console.log('initializeBoard');
    for (let x = 0; x < 4; x++) {
      for (let y = 0; y < 4; y++) {
        this.board.set(`${x},${y}`, new DungeonSquare());
      }
    }
  }

  createPlayer(id: string, name: string) {
    this.players.set(id, new Player(name))
  }

  removePlayer(id: string) {
    this.players.delete(id)
  }

  crossSquare(client: Client, data: any) {
    const player = this.players.get(client.sessionId);

    if (client.sessionId) {
      const { x, y } = data;
      const newSquare = new DungeonSquare();
      newSquare.checked = true;
      this.board.set(`${x},${y}`, newSquare);
      console.log(player.name, "crosses square", data.x, data.y);
    }
  }
}
