"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Dungeon = void 0;
const core_1 = require("@colyseus/core");
const DungeonState_1 = require("./schema/DungeonState");
class Dungeon extends core_1.Room {
    constructor() {
        super(...arguments);
        this.maxClients = 4;
    }
    onCreate(options) {
        this.setState(new DungeonState_1.DungeonState());
        this.state.initializeBoard();
        this.onMessage("crossSquare", (client, message) => {
            const result = this.state.crossSquare(client, message);
            // Send response back to client with result
            client.send("crossSquareResult", result);
        });
    }
    onJoin(client, options) {
        this.state.createPlayer(client.sessionId, options.name);
        console.log(client.sessionId + ' : player: ' + options.name, "joined!");
        console.log(this.state.players.size, "players in room");
    }
    onLeave(client, consented) {
        this.state.removePlayer(client.sessionId);
        console.log(client.sessionId, "left!");
    }
    onDispose() {
        console.log("room", this.roomId, "disposing...");
    }
}
exports.Dungeon = Dungeon;
