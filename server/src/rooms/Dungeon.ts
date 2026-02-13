import { Room, Client } from "@colyseus/core";
import { DungeonState, type MonsterAttackPhaseResult } from "./schema/DungeonState";

export class Dungeon extends Room<DungeonState> {
  maxClients = 4;

  // Room name used by clients when joining (helpful for debugging/logging)
  static readonly ROOM_NAME = "dungeon";

  private toFiniteInt(value: unknown, fallback: number): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return fallback;
    }
    return Math.trunc(value);
  }

  private toSafeString(value: unknown): string {
    return typeof value === "string" ? value : "";
  }

  private normalizeMonsterAttackPhasePayload(
    payload: MonsterAttackPhaseResult
  ): {
    turn: number;
    totalAttacks: number;
    attacks: Array<{
      playerSessionId: string;
      monsterId: string;
      monsterName: string;
      monsterAttack: number;
      attackNumber: number;
      outcome: string;
      card: {
        id: string;
        type: string;
        name: string;
        description: string;
        defenseSymbol: "empty" | "block" | "counter";
        color: "clear" | "red" | "blue" | "green";
      } | null;
      counterSquare: { x: number; y: number } | null;
    }>;
  } {
    const attacks = (Array.isArray(payload.attacks) ? payload.attacks : []).map((attack) => {
      const cardDefenseSymbol: "empty" | "block" | "counter" =
        attack.card?.defenseSymbol === "block" || attack.card?.defenseSymbol === "counter"
          ? attack.card.defenseSymbol
          : "empty";

      const card: {
        id: string;
        type: string;
        name: string;
        description: string;
        defenseSymbol: "empty" | "block" | "counter";
        color: "clear" | "red" | "blue" | "green";
      } | null = attack.card
        ? {
            id: this.toSafeString(attack.card.id),
            type: this.toSafeString(attack.card.type),
            name: this.toSafeString(attack.card.name),
            description: this.toSafeString(attack.card.description),
            defenseSymbol: cardDefenseSymbol,
            color:
              attack.card.color === "red" ||
              attack.card.color === "blue" ||
              attack.card.color === "green"
                ? attack.card.color
                : "clear"
          }
        : null;

      const counterSquare =
        attack.counterSquare &&
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

  private trySend(client: Client, type: string, payload: unknown): boolean {
    try {
      client.send(type, payload as any);
      return true;
    } catch (error) {
      console.error(`[Dungeon] Failed to send '${type}' to ${client.sessionId}:`, error);
      return false;
    }
  }

  private sendWithFallback(client: Client, type: string, payload: unknown, fallback: unknown): void {
    if (this.trySend(client, type, payload)) {
      return;
    }
    this.trySend(client, type, fallback);
  }

  private tryBroadcast(type: string, payload: unknown): boolean {
    try {
      this.broadcast(type, payload as any);
      return true;
    } catch (error) {
      console.error(`[Dungeon] Failed to broadcast '${type}':`, error);
      return false;
    }
  }

  private broadcastWithFallback(type: string, payload: unknown, fallback: unknown): void {
    if (this.tryBroadcast(type, payload)) {
      return;
    }
    this.tryBroadcast(type, fallback);
  }

  onCreate(options: any) {
    this.setState(new DungeonState());

    this.state.initializeBoard();

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
        this.sendWithFallback(
          client,
          "endTurnResult",
          {
            success: false,
            message: null,
            error: "Player not found",
            turnAdvanced: false,
            currentTurn: this.state.currentTurn
          },
          {
            success: false,
            message: null,
            error: "Serialization error",
            turnAdvanced: false,
            currentTurn: this.state.currentTurn
          }
        );
        return;
      }

      // Prevent ending the turn while a card is still active.
      if (this.state.activeCardPlayers.has(client.sessionId)) {
        this.sendWithFallback(
          client,
          "endTurnResult",
          {
            success: false,
            message: null,
            error: "Cannot end turn while a card is active. Confirm or cancel it first.",
            turnAdvanced: false,
            currentTurn: this.state.currentTurn
          },
          {
            success: false,
            message: null,
            error: "Serialization error",
            turnAdvanced: false,
            currentTurn: this.state.currentTurn
          }
        );
        return;
      }

      // Validate that the player can end their turn
      if (!this.state.canPlayerPerformAction(client.sessionId, "endTurn")) {
        this.sendWithFallback(
          client,
          "endTurnResult",
          {
            success: false,
            message: null,
            error: "Cannot end turn: player must be in 'playing_turn' status",
            turnAdvanced: false,
            currentTurn: this.state.currentTurn
          },
          {
            success: false,
            message: null,
            error: "Serialization error",
            turnAdvanced: false,
            currentTurn: this.state.currentTurn
          }
        );
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

        this.sendWithFallback(
          client,
          "endTurnResult",
          {
            success: true,
            message: "Turn ended successfully",
            error: null,
            turnAdvanced,
            currentTurn: this.state.currentTurn
          },
          {
            success: true,
            message: null,
            error: "Serialization error",
            turnAdvanced,
            currentTurn: this.state.currentTurn
          }
        );

        // If turn advanced, notify all clients about the new turn
        if (turnAdvanced) {
          if (attackPhaseResult && attackPhaseResult.totalAttacks > 0) {
            const normalizedAttackPhaseResult = this.normalizeMonsterAttackPhasePayload(attackPhaseResult);
            this.broadcastWithFallback(
              "monsterAttackPhase",
              normalizedAttackPhaseResult,
              {
                turn: this.state.currentTurn,
                totalAttacks: 0,
                attacks: []
              }
            );
          }

          this.broadcastWithFallback(
            "turnAdvanced",
            {
              newTurn: this.state.currentTurn,
              message: `Turn ${this.state.currentTurn} has begun`
            },
            {
              newTurn: this.state.currentTurn,
              message: `Turn ${this.state.currentTurn}`
            }
          );
        }
      } else {
        this.sendWithFallback(
          client,
          "endTurnResult",
          {
            success: false,
            message: null,
            error: "Failed to update turn status",
            turnAdvanced: false,
            currentTurn: this.state.currentTurn
          },
          {
            success: false,
            message: null,
            error: "Serialization error",
            turnAdvanced: false,
            currentTurn: this.state.currentTurn
          }
        );
      }
    });

    // Card-based square selection message handlers
    this.onMessage("playCard", (client, message) => {
      // Mutates state; clients will see the activated card via state patches.
      // NOTE: Sending playCardResult has intermittently triggered msgpackr encoding
      // RangeErrors in this project, so we intentionally do not respond here.
      this.state.playCard(client.sessionId, message.cardId);
    });

    this.onMessage("cancelCardAction", (client, message) => {
      const result = this.state.cancelCardAction(client.sessionId);
      client.send("cancelCardActionResult", result);
    });

    this.onMessage("confirmCardAction", (client, message) => {
      // Mutates state; clients will see updates via state patches.
      // NOTE: Sending confirmCardActionResult has intermittently triggered msgpackr encoding
      // RangeErrors in this project, so we intentionally do not respond here.
      this.state.confirmCardAction(client.sessionId, message);
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
      this.state.crossMonsterSquare(
        client.sessionId,
        message.monsterId,
        message.x,
        message.y
      );
    });
  }

  onJoin(client: Client, options: any) {
    this.state.createPlayer(client.sessionId, options.name);

    console.log(client.sessionId + ' : player: ' + options.name, "joined!");
    console.log(this.state.players.size, "players in room");

    // Initialize turn state when the first player joins
    if (this.state.players.size === 1) {
      this.state.initializeTurnState();
      console.log("Turn state initialized for the first player");
    }
  }

  onLeave(client: Client, consented: boolean) {
    this.state.removePlayer(client.sessionId);
    console.log(client.sessionId, "left!");
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }

}
