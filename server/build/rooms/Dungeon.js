"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Dungeon = void 0;
const core_1 = require("@colyseus/core");
const shared_types_1 = require("@colyseus/shared-types");
const DungeonState_1 = require("./schema/DungeonState");
class Dungeon extends core_1.Room {
    constructor() {
        super(...arguments);
        this.maxClients = 4;
        this.reconnectionWindowSeconds = 90;
    }
    // Room name used by clients when joining (helpful for debugging/logging)
    static { this.ROOM_NAME = "dungeon"; }
    toFiniteInt(value, fallback) {
        if (typeof value !== "number" || !Number.isFinite(value)) {
            return fallback;
        }
        return Math.trunc(value);
    }
    toSafeString(value) {
        return typeof value === "string" ? value : "";
    }
    normalizePlayerName(value) {
        if (typeof value !== "string") {
            return "";
        }
        return value.trim().replace(/\s+/g, " ").slice(0, 24);
    }
    async updateLobbyMetadata() {
        const metadata = {
            roomCode: this.roomId,
            currentDay: this.state.currentDay,
            currentTurn: this.state.currentTurn,
            gameStatus: this.state.gameStatus,
            playerCount: this.state.players.size,
            maxPlayers: this.maxClients
        };
        try {
            await this.setMetadata(metadata);
        }
        catch (error) {
            console.error("[Dungeon] Failed to update room metadata:", error);
        }
    }
    normalizeMonsterAttackPhasePayload(payload) {
        const attacks = (Array.isArray(payload.attacks) ? payload.attacks : []).map((attack) => {
            const cardDefenseSymbol = attack.card?.defenseSymbol === "block" ||
                attack.card?.defenseSymbol === "counter" ||
                attack.card?.defenseSymbol === "dodge"
                ? attack.card.defenseSymbol
                : "empty";
            const card = attack.card
                ? {
                    id: this.toSafeString(attack.card.id),
                    type: this.toSafeString(attack.card.type),
                    name: this.toSafeString(attack.card.name),
                    description: this.toSafeString(attack.card.description),
                    defenseSymbol: cardDefenseSymbol,
                    color: attack.card.color === "red" ||
                        attack.card.color === "blue" ||
                        attack.card.color === "green"
                        ? attack.card.color
                        : "clear"
                }
                : null;
            const counterSquare = attack.counterSquare &&
                typeof attack.counterSquare.x === "number" &&
                Number.isFinite(attack.counterSquare.x) &&
                typeof attack.counterSquare.y === "number" &&
                Number.isFinite(attack.counterSquare.y)
                ? {
                    x: Math.trunc(attack.counterSquare.x),
                    y: Math.trunc(attack.counterSquare.y)
                }
                : null;
            return {
                playerSessionId: this.toSafeString(attack.playerSessionId),
                monsterId: this.toSafeString(attack.monsterId),
                monsterName: this.toSafeString(attack.monsterName),
                monsterAttack: Math.max(1, this.toFiniteInt(attack.monsterAttack, 1)),
                attackNumber: Math.max(1, this.toFiniteInt(attack.attackNumber, 1)),
                outcome: this.toSafeString(attack.outcome) || "no_card_available",
                card,
                counterSquare
            };
        });
        return {
            turn: this.toFiniteInt(payload.turn, this.state.currentTurn),
            totalAttacks: attacks.length,
            attacks
        };
    }
    trySend(client, type, payload) {
        try {
            client.send(type, payload);
            return true;
        }
        catch (error) {
            console.error(`[Dungeon] Failed to send '${type}' to ${client.sessionId}:`, error);
            return false;
        }
    }
    sendWithFallback(client, type, payload, fallback) {
        if (this.trySend(client, type, payload)) {
            return;
        }
        this.trySend(client, type, fallback);
    }
    tryBroadcast(type, payload) {
        try {
            this.broadcast(type, payload);
            return true;
        }
        catch (error) {
            console.error(`[Dungeon] Failed to broadcast '${type}':`, error);
            return false;
        }
    }
    broadcastWithFallback(type, payload, fallback) {
        if (this.tryBroadcast(type, payload)) {
            return;
        }
        this.tryBroadcast(type, fallback);
    }
    onCreate(options) {
        this.setState(new DungeonState_1.DungeonState());
        this.state.initializeBoard();
        void this.updateLobbyMetadata();
        this.onMessage("crossSquare", (client, message) => {
            // Mutates state; clients will see changes via state patches.
            // NOTE: Sending crossSquareResult has intermittently triggered msgpackr encoding
            // RangeErrors in this project, so we intentionally do not respond here.
            this.state.crossSquare(client, message);
        });
        // Card drawing message handler
        this.onMessage("drawCard", (client, message) => {
            // Mutates state; clients will see the new drawn card via state patches.
            // NOTE: Sending drawCardResult has intermittently triggered msgpackr encoding
            // RangeErrors in this project, so we intentionally do not respond here.
            this.state.drawCard(client.sessionId);
        });
        // Turn management message handlers
        this.onMessage("endTurn", (client, message) => {
            const player = this.state.players.get(client.sessionId);
            if (!player) {
                this.sendWithFallback(client, "endTurnResult", {
                    success: false,
                    message: null,
                    error: "Player not found",
                    turnAdvanced: false,
                    currentTurn: this.state.currentTurn
                }, {
                    success: false,
                    message: null,
                    error: "Serialization error",
                    turnAdvanced: false,
                    currentTurn: this.state.currentTurn
                });
                return;
            }
            const endTurnPreparation = this.state.preparePlayerForEndTurn(client.sessionId);
            if (!endTurnPreparation.success) {
                this.sendWithFallback(client, "endTurnResult", {
                    success: false,
                    message: null,
                    error: endTurnPreparation.error || "Cannot end turn",
                    turnAdvanced: false,
                    currentTurn: this.state.currentTurn
                }, {
                    success: false,
                    message: null,
                    error: "Serialization error",
                    turnAdvanced: false,
                    currentTurn: this.state.currentTurn
                });
                return;
            }
            const discardedActiveCard = !!endTurnPreparation.discardedActiveCard;
            // Validate that the player can end their turn
            if (!this.state.canPlayerPerformAction(client.sessionId, "endTurn")) {
                this.sendWithFallback(client, "endTurnResult", {
                    success: false,
                    message: null,
                    error: "Cannot end turn: player must be in 'playing_turn' status",
                    turnAdvanced: false,
                    currentTurn: this.state.currentTurn
                }, {
                    success: false,
                    message: null,
                    error: "Serialization error",
                    turnAdvanced: false,
                    currentTurn: this.state.currentTurn
                });
                return;
            }
            // Store the current turn before updating status
            const currentTurnBefore = this.state.currentTurn;
            // Update player status to turn_complete
            const success = this.state.updatePlayerTurnStatus(client.sessionId, "turn_complete");
            if (success) {
                // Check if turn advanced by comparing turn numbers
                const turnAdvanced = this.state.currentTurn > currentTurnBefore;
                const attackPhaseResult = turnAdvanced
                    ? this.state.consumePendingMonsterAttackPhaseResult()
                    : null;
                void this.updateLobbyMetadata();
                this.sendWithFallback(client, "endTurnResult", {
                    success: true,
                    message: discardedActiveCard
                        ? "Turn ended successfully. Unplayable active card discarded."
                        : "Turn ended successfully",
                    error: null,
                    turnAdvanced,
                    discardedActiveCard,
                    currentTurn: this.state.currentTurn
                }, {
                    success: true,
                    message: null,
                    error: "Serialization error",
                    turnAdvanced,
                    discardedActiveCard,
                    currentTurn: this.state.currentTurn
                });
                // If turn advanced, notify all clients about the new turn
                if (turnAdvanced) {
                    if (attackPhaseResult && attackPhaseResult.totalAttacks > 0) {
                        const normalizedAttackPhaseResult = this.normalizeMonsterAttackPhasePayload(attackPhaseResult);
                        this.broadcastWithFallback("monsterAttackPhase", normalizedAttackPhaseResult, {
                            turn: this.state.currentTurn,
                            totalAttacks: 0,
                            attacks: []
                        });
                    }
                    this.broadcastWithFallback("turnAdvanced", {
                        newTurn: this.state.currentTurn,
                        message: `Turn ${this.state.currentTurn} has begun`
                    }, {
                        newTurn: this.state.currentTurn,
                        message: `Turn ${this.state.currentTurn}`
                    });
                }
            }
            else {
                this.sendWithFallback(client, "endTurnResult", {
                    success: false,
                    message: null,
                    error: "Failed to update turn status",
                    turnAdvanced: false,
                    currentTurn: this.state.currentTurn
                }, {
                    success: false,
                    message: null,
                    error: "Serialization error",
                    turnAdvanced: false,
                    currentTurn: this.state.currentTurn
                });
            }
        });
        // Card-based square selection message handlers
        this.onMessage("playCard", (client, message) => {
            // Mutates state; clients will see the activated card via state patches.
            // NOTE: Sending playCardResult has intermittently triggered msgpackr encoding
            // RangeErrors in this project, so we intentionally do not respond here.
            this.state.playCard(client.sessionId, message.cardId);
        });
        this.onMessage("selectInspirationTarget", (client, message) => {
            // Mutates state; clients will see inspiration targeting updates via state patches.
            // NOTE: Sending explicit result messages has intermittently triggered msgpackr issues in this project.
            this.state.selectInspirationTarget(client.sessionId, this.toSafeString(message?.targetSessionId));
        });
        this.onMessage("cancelCardAction", (client, message) => {
            const result = this.state.cancelCardAction(client.sessionId);
            client.send("cancelCardActionResult", result);
        });
        this.onMessage("discardCardAction", (client, message) => {
            const result = this.state.discardCardAction(client.sessionId);
            client.send("discardCardActionResult", result);
        });
        this.onMessage("confirmCardAction", (client, message) => {
            // Mutates state; clients will see updates via state patches.
            // NOTE: Sending confirmCardActionResult has intermittently triggered msgpackr encoding
            // RangeErrors in this project, so we intentionally do not respond here.
            this.state.confirmCardAction(client.sessionId, message);
        });
        this.onMessage("setDebugMode", (client, message) => {
            this.state.setDebugMode(!!message?.enabled);
        });
        this.onMessage("debugCompleteMonster", (client, message) => {
            this.state.debugCompleteMonster(client.sessionId, message?.monsterId);
        });
        // Monster-related message handlers
        this.onMessage("claimMonster", (client, message) => {
            // Mutates state; clients will see monster ownership updates via state patches.
            // NOTE: Sending claimMonsterResult has intermittently triggered msgpackr encoding
            // RangeErrors in this project, so we intentionally do not respond here.
            this.state.claimMonster(client.sessionId, message.monsterId);
        });
        this.onMessage("crossMonsterSquare", (client, message) => {
            // Mutates state; clients will see monster square updates via state patches.
            // NOTE: Sending crossMonsterSquareResult has intermittently triggered msgpackr encoding
            // RangeErrors in this project, so we intentionally do not respond here.
            this.state.crossMonsterSquare(client.sessionId, message.monsterId, message.x, message.y);
        });
    }
    onAuth(client, options) {
        const playerName = this.normalizePlayerName(options?.name);
        if (!playerName) {
            throw new Error("Player name is required");
        }
        return { playerName };
    }
    onJoin(client, options, auth) {
        const playerName = this.normalizePlayerName(auth?.playerName ?? options?.name);
        if (!playerName) {
            throw new Error("Player name is required");
        }
        this.state.createPlayer(client.sessionId, playerName);
        console.log(client.sessionId + ' : player: ' + playerName, "joined!");
        console.log(this.state.players.size, "players in room");
        // Initialize turn state when the first player joins
        if (this.state.players.size === 1) {
            this.state.initializeTurnState();
            console.log("Turn state initialized for the first player");
            void this.updateLobbyMetadata();
            return;
        }
        void this.updateLobbyMetadata();
    }
    async onLeave(client, code) {
        const consented = code === shared_types_1.CloseCode.CONSENTED;
        // Keep accidental refreshes/disconnects reconnectable for a short window.
        if (!consented) {
            try {
                await this.allowReconnection(client, this.reconnectionWindowSeconds);
                console.log(client.sessionId, "reconnected");
                void this.updateLobbyMetadata();
                return;
            }
            catch (error) {
                console.log(client.sessionId, "did not reconnect in time");
            }
        }
        this.state.removePlayer(client.sessionId);
        void this.updateLobbyMetadata();
        console.log(client.sessionId, "left!");
    }
    onDispose() {
        console.log("room", this.roomId, "disposing...");
    }
}
exports.Dungeon = Dungeon;
