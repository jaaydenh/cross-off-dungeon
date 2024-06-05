import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { Player } from "./Player";
import { Client } from "colyseus";

const BOARD_WIDTH = 4;

export class DungeonState extends Schema {

  @type({ map: Player }) players = new MapSchema<Player>();
  @type(["number"]) board: number[] = new ArraySchema<number>
    (0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
    );

  createPlayer(id: string, name: string) {
    this.players.set(id, new Player(name))
  }

  removePlayer(id: string) {
    this.players.delete(id)
  }

  crossSquare(client: Client, data: any) {
    const player = this.players.get(client.sessionId);
    console.log(player.name, "crosses square", data.x, data.y);

    if (client.sessionId) {
      const index = data.x + BOARD_WIDTH * data.y;

      if (this.board[index] === 0) {
        this.board[index] = 1;
      }
    }
  }
}
