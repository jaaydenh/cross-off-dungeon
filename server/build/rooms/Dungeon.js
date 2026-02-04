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
        // Card drawing message handler
        this.onMessage("drawCard", (client, message) => {
            const result = this.state.drawCard(client.sessionId);
            client.send("drawCardResult", result);
        });
        // Turn management message handlers
        this.onMessage("endTurn", (client, message) => {
            const player = this.state.players.get(client.sessionId);
            if (!player) {
                client.send("endTurnResult", {
                    success: false,
                    error: "Player not found"
                });
                return;
            }
            // Validate that the player can end their turn
            if (!this.state.canPlayerPerformAction(client.sessionId, "endTurn")) {
                client.send("endTurnResult", {
                    success: false,
                    error: "Cannot end turn: player must be in 'playing_turn' status"
                });
                return;
            }
            // Store the current turn before updating status
            const currentTurnBefore = this.state.currentTurn;
            // Check if all players will be ready after this player completes their turn
            const willAllPlayersBeReady = this.state.turnOrder.every(sessionId => {
                if (sessionId === client.sessionId) {
                    return true; // This player will be turn_complete
                }
                const otherPlayer = this.state.players.get(sessionId);
                return otherPlayer && otherPlayer.turnStatus === "turn_complete";
            });
            // Update player status to turn_complete
            const success = this.state.updatePlayerTurnStatus(client.sessionId, "turn_complete");
            if (success) {
                // Check if turn advanced by comparing turn numbers
                const turnAdvanced = this.state.currentTurn > currentTurnBefore;
                client.send("endTurnResult", {
                    success: true,
                    message: "Turn ended successfully",
                    turnAdvanced: turnAdvanced,
                    currentTurn: this.state.currentTurn
                });
                // If turn advanced, notify all clients about the new turn
                if (turnAdvanced) {
                    this.broadcast("turnAdvanced", {
                        newTurn: this.state.currentTurn,
                        message: `Turn ${this.state.currentTurn} has begun`
                    });
                }
            }
            else {
                client.send("endTurnResult", {
                    success: false,
                    error: "Failed to update turn status"
                });
            }
        });
        // Card-based square selection message handlers
        this.onMessage("playCard", (client, message) => {
            const result = this.state.playCard(client.sessionId, message.cardId);
            client.send("playCardResult", result);
        });
        this.onMessage("cancelCardAction", (client, message) => {
            const result = this.state.cancelCardAction(client.sessionId);
            client.send("cancelCardActionResult", result);
        });
        this.onMessage("confirmCardAction", (client, message) => {
            const result = this.state.confirmCardAction(client.sessionId);
            client.send("confirmCardActionResult", result);
        });
        // Monster-related message handlers
        this.onMessage("claimMonster", (client, message) => {
            const result = this.state.claimMonster(client.sessionId, message.monsterId);
            client.send("claimMonsterResult", result);
        });
        this.onMessage("crossMonsterSquare", (client, message) => {
            const result = this.state.crossMonsterSquare(client.sessionId, message.monsterId, message.x, message.y);
            client.send("crossMonsterSquareResult", result);
        });
    }
    onJoin(client, options) {
        this.state.createPlayer(client.sessionId, options.name);
        console.log(client.sessionId + ' : player: ' + options.name, "joined!");
        console.log(this.state.players.size, "players in room");
        // Initialize turn state when the first player joins
        if (this.state.players.size === 1) {
            this.state.initializeTurnState();
            console.log("Turn state initialized for the first player");
        }
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
