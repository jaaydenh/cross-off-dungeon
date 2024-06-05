import { Room, Client } from "@colyseus/core";
import { DungeonState } from "./schema/DungeonState";

export class Dungeon extends Room<DungeonState> {
  maxClients = 4;

  onCreate(options: any) {
    this.setState(new DungeonState());

    this.onMessage("crossSquare", (client, message) => this.state.crossSquare(client, message));
  }

  onJoin(client: Client, options: any) {
    this.state.createPlayer(client.sessionId, options.name);
    console.log(client.sessionId + ' : player: ' + options.name, "joined!");
    console.log(this.state.players.size, "players in room");
  }

  onLeave(client: Client, consented: boolean) {
    this.state.removePlayer(client.sessionId);
    console.log(client.sessionId, "left!");
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }

}
