import assert from "assert";
import { ColyseusTestServer, boot } from "@colyseus/testing";
import { describe, it, before, after, beforeEach } from "mocha";
import appConfig from "../src/app.config";

describe("Multi-Player Turn Integration", () => {
    let colyseus: ColyseusTestServer;

    before(async () => colyseus = await boot(appConfig));
    after(async () => await colyseus.shutdown());
    beforeEach(async () => await colyseus.cleanup());

    describe("Turn Initialization", () => {
        it("should initialize turn state when first player joins", async () => {
            const room = await colyseus.createRoom("dungeon", {});
            const client1 = await colyseus.connectTo(room, { name: "Player1" });

            assert.strictEqual(room.state.currentTurn, 1);
            assert.strictEqual(room.state.turnInProgress, true);
            assert.strictEqual(room.state.turnOrder.length, 1);
            assert.strictEqual(room.state.turnOrder[0], client1.sessionId);

            const player = room.state.players.get(client1.sessionId)!;
            assert.strictEqual(player.turnStatus, "not_started");
            assert.strictEqual(player.hasDrawnCard, false);
        });

        it("should add subsequent players to turn order", async () => {
            const room = await colyseus.createRoom("dungeon", {});
            const client1 = await colyseus.connectTo(room, { name: "Player1" });
            const client2 = await colyseus.connectTo(room, { name: "Player2" });
            const client3 = await colyseus.connectTo(room, { name: "Player3" });

            assert.strictEqual(room.state.turnOrder.length, 3);
            assert(room.state.turnOrder.includes(client1.sessionId));
            assert(room.state.turnOrder.includes(client2.sessionId));
            assert(room.state.turnOrder.includes(client3.sessionId));

            // All players should start with not_started status
            [client1, client2, client3].forEach(client => {
                const player = room.state.players.get(client.sessionId)!;
                assert.strictEqual(player.turnStatus, "not_started");
                assert.strictEqual(player.hasDrawnCard, false);
            });
        });

        it("should handle player leaving and rejoining", async () => {
            const room = await colyseus.createRoom("dungeon", {});
            const client1 = await colyseus.connectTo(room, { name: "Player1" });
            const client2 = await colyseus.connectTo(room, { name: "Player2" });

            assert.strictEqual(room.state.turnOrder.length, 2);

            // Player 1 leaves
            await client1.leave();
            assert.strictEqual(room.state.turnOrder.length, 1);
            assert.strictEqual(room.state.turnOrder[0], client2.sessionId);

            // New player joins
            const client3 = await colyseus.connectTo(room, { name: "Player3" });
            assert.strictEqual(room.state.turnOrder.length, 2);
            assert(room.state.turnOrder.includes(client2.sessionId));
            assert(room.state.turnOrder.includes(client3.sessionId));
        });
    });

    describe("Complete Turn Cycle", () => {
        it("should handle complete turn cycle with 2 players", async () => {
            const room = await colyseus.createRoom("dungeon", {});
            const client1 = await colyseus.connectTo(room, { name: "Player1" });
            const client2 = await colyseus.connectTo(room, { name: "Player2" });

            const player1 = room.state.players.get(client1.sessionId)!;
            const player2 = room.state.players.get(client2.sessionId)!;

            // Initial state
            assert.strictEqual(room.state.currentTurn, 1);
            assert.strictEqual(player1.turnStatus, "not_started");
            assert.strictEqual(player2.turnStatus, "not_started");

            // Player 1 draws card
            room.state.drawCard(client1.sessionId);
            assert.strictEqual(player1.turnStatus, "playing_turn");
            assert.strictEqual(player1.hasDrawnCard, true);

            // Player 2 draws card
            room.state.drawCard(client2.sessionId);
            assert.strictEqual(player2.turnStatus, "playing_turn");
            assert.strictEqual(player2.hasDrawnCard, true);

            // Player 1 ends turn
            room.state.updatePlayerTurnStatus(client1.sessionId, "turn_complete");
            assert.strictEqual(player1.turnStatus, "turn_complete");
            assert.strictEqual(room.state.currentTurn, 1); // Should not advance yet

            // Player 2 ends turn - should advance turn
            room.state.updatePlayerTurnStatus(client2.sessionId, "turn_complete");

            // Turn should advance and statuses reset
            assert.strictEqual(room.state.currentTurn, 2);
            assert.strictEqual(player1.turnStatus, "not_started");
            assert.strictEqual(player2.turnStatus, "not_started");
            assert.strictEqual(player1.hasDrawnCard, false);
            assert.strictEqual(player2.hasDrawnCard, false);
        });

        it("should handle complete turn cycle with 4 players", async () => {
            const room = await colyseus.createRoom("dungeon", {});
            const clients: any[] = [];
            const players: any[] = [];

            // Connect 4 players
            for (let i = 1; i <= 4; i++) {
                const client = await colyseus.connectTo(room, { name: `Player${i}` });
                clients.push(client);
                players.push(room.state.players.get(client.sessionId)!);
            }

            assert.strictEqual(room.state.currentTurn, 1);

            // All players draw cards
            for (let i = 0; i < 4; i++) {
                room.state.drawCard(clients[i].sessionId);
                assert.strictEqual(players[i].turnStatus, "playing_turn");
            }

            // First 3 players end their turns
            for (let i = 0; i < 3; i++) {
                room.state.updatePlayerTurnStatus(clients[i].sessionId, "turn_complete");
                assert.strictEqual(players[i].turnStatus, "turn_complete");
                assert.strictEqual(room.state.currentTurn, 1); // Should not advance yet
            }

            // Last player ends turn - should advance
            room.state.updatePlayerTurnStatus(clients[3].sessionId, "turn_complete");

            // Verify turn advancement and reset
            assert.strictEqual(room.state.currentTurn, 2);
            for (let i = 0; i < 4; i++) {
                assert.strictEqual(players[i].turnStatus, "not_started");
                assert.strictEqual(players[i].hasDrawnCard, false);
            }
        });
    });

    describe("Turn Message Handling", () => {
        it("should handle endTurn messages with proper responses", async () => {
            const room = await colyseus.createRoom("dungeon", {});
            const client1 = await colyseus.connectTo(room, { name: "Player1" });
            const client2 = await colyseus.connectTo(room, { name: "Player2" });

            // Set up message listeners
            let endTurnResult1: any = null;
            let endTurnResult2: any = null;
            let turnAdvancedMessages: any[] = [];

            client1.onMessage("endTurnResult", (message) => {
                endTurnResult1 = message;
            });
            client2.onMessage("endTurnResult", (message) => {
                endTurnResult2 = message;
            });
            client1.onMessage("turnAdvanced", (message) => {
                turnAdvancedMessages.push(message);
            });
            client2.onMessage("turnAdvanced", (message) => {
                turnAdvancedMessages.push(message);
            });

            // Both players draw cards
            room.state.drawCard(client1.sessionId);
            room.state.drawCard(client2.sessionId);

            // Player 1 ends turn
            client1.send("endTurn", {});
            await room.waitForNextPatch();

            assert(endTurnResult1 !== null);
            assert.strictEqual(endTurnResult1.success, true);
            assert.strictEqual(endTurnResult1.turnAdvanced, false);
            assert.strictEqual(endTurnResult1.currentTurn, 1);

            // Player 2 ends turn
            client2.send("endTurn", {});
            await room.waitForNextPatch();

            assert(endTurnResult2 !== null);
            assert.strictEqual(endTurnResult2.success, true);
            assert.strictEqual(endTurnResult2.turnAdvanced, true);
            assert.strictEqual(endTurnResult2.currentTurn, 2);

            // Both clients should receive turnAdvanced broadcast
            assert.strictEqual(turnAdvancedMessages.length, 2);
            assert.strictEqual(turnAdvancedMessages[0].newTurn, 2);
            assert.strictEqual(turnAdvancedMessages[0].message, "Turn 2 has begun");
        });

        it("should reject invalid endTurn attempts", async () => {
            const room = await colyseus.createRoom("dungeon", {});
            const client1 = await colyseus.connectTo(room, { name: "Player1" });

            let endTurnResult: any = null;
            client1.onMessage("endTurnResult", (message) => {
                endTurnResult = message;
            });

            // Try to end turn without drawing card
            client1.send("endTurn", {});
            await room.waitForNextPatch();

            assert(endTurnResult !== null);
            assert.strictEqual(endTurnResult.success, false);
            assert(endTurnResult.error?.includes("must be in 'playing_turn' status"));
        });
    });

    describe("Card and Turn Integration", () => {
        it("should integrate card drawing with turn management", async () => {
            const room = await colyseus.createRoom("dungeon", {});
            const client1 = await colyseus.connectTo(room, { name: "Player1" });
            const client2 = await colyseus.connectTo(room, { name: "Player2" });

            const player1 = room.state.players.get(client1.sessionId)!;
            const player2 = room.state.players.get(client2.sessionId)!;

            // Players draw cards via messages
            client1.send("drawCard", {});
            client2.send("drawCard", {});
            await room.waitForNextPatch();

            // Verify card drawing updated turn status
            assert.strictEqual(player1.turnStatus, "playing_turn");
            assert.strictEqual(player2.turnStatus, "playing_turn");
            assert.strictEqual(player1.drawnCards.length, 1);
            assert.strictEqual(player2.drawnCards.length, 1);

            // Players can now play cards
            const card1Id = player1.drawnCards[0].id;
            const card2Id = player2.drawnCards[0].id;

            client1.send("playCard", { cardId: card1Id });
            client2.send("playCard", { cardId: card2Id });
            await room.waitForNextPatch();

            // Verify cards are activated
            assert.strictEqual(player1.drawnCards[0].isActive, true);
            assert.strictEqual(player2.drawnCards[0].isActive, true);

            // Players end their turns
            client1.send("endTurn", {});
            client2.send("endTurn", {});
            await room.waitForNextPatch();

            // Verify turn advancement
            assert.strictEqual(room.state.currentTurn, 2);
            assert.strictEqual(player1.turnStatus, "not_started");
            assert.strictEqual(player2.turnStatus, "not_started");
        });

        it("should handle card completion during turns", async () => {
            const room = await colyseus.createRoom("dungeon", {});
            const client = await colyseus.connectTo(room, { name: "TestPlayer" });

            const player = room.state.players.get(client.sessionId)!;

            // Draw and activate card
            client.send("drawCard", {});
            await room.waitForNextPatch();

            const cardId = player.drawnCards[0].id;
            client.send("playCard", { cardId });
            await room.waitForNextPatch();

            // Simulate completing card action by manually setting up state
            room.state.activeCardPlayers.set(client.sessionId, cardId);
            room.state.selectedSquares.set(client.sessionId, "0:1,1;0:1,2;0:2,1");
            room.state.selectedSquareCount.set(client.sessionId, 3);

            // Complete the card action
            const selectedPositions = [
                { roomIndex: 0, x: 1, y: 1 },
                { roomIndex: 0, x: 1, y: 2 },
                { roomIndex: 0, x: 2, y: 1 }
            ];
            const result = (room.state as any).completeCardAction(client.sessionId, selectedPositions);

            assert.strictEqual(result.success, true);
            assert.strictEqual(player.discardPile.length, 1);
            assert.strictEqual(player.drawnCards.length, 0);

            // Player can still end turn
            client.send("endTurn", {});
            await room.waitForNextPatch();

            assert.strictEqual(room.state.currentTurn, 2);
            assert.strictEqual(player.turnStatus, "not_started");
        });
    });

    describe("Player Disconnection During Turns", () => {
        it("should advance turn when disconnected player was blocking", async () => {
            const room = await colyseus.createRoom("dungeon", {});
            const client1 = await colyseus.connectTo(room, { name: "Player1" });
            const client2 = await colyseus.connectTo(room, { name: "Player2" });

            const player1 = room.state.players.get(client1.sessionId)!;
            const player2 = room.state.players.get(client2.sessionId)!;

            // Both players draw cards and player1 ends turn
            room.state.drawCard(client1.sessionId);
            room.state.drawCard(client2.sessionId);
            room.state.updatePlayerTurnStatus(client1.sessionId, "turn_complete");

            // Verify turn hasn't advanced yet
            assert.strictEqual(room.state.currentTurn, 1);
            assert.strictEqual(player1.turnStatus, "turn_complete");
            assert.strictEqual(player2.turnStatus, "playing_turn");

            // Player2 disconnects
            await client2.leave();

            // Turn should advance since player2 is no longer in the game
            assert.strictEqual(room.state.turnOrder.length, 1);
            assert.strictEqual(room.state.currentTurn, 2);
            assert.strictEqual(player1.turnStatus, "not_started");
        });

        it("should handle multiple disconnections gracefully", async () => {
            const room = await colyseus.createRoom("dungeon", {});
            const client1 = await colyseus.connectTo(room, { name: "Player1" });
            const client2 = await colyseus.connectTo(room, { name: "Player2" });
            const client3 = await colyseus.connectTo(room, { name: "Player3" });

            // All players draw cards
            room.state.drawCard(client1.sessionId);
            room.state.drawCard(client2.sessionId);
            room.state.drawCard(client3.sessionId);

            // Player1 ends turn
            room.state.updatePlayerTurnStatus(client1.sessionId, "turn_complete");
            assert.strictEqual(room.state.currentTurn, 1);

            // Player2 and Player3 disconnect
            await client2.leave();
            await client3.leave();

            // Turn should advance since only player1 remains
            assert.strictEqual(room.state.turnOrder.length, 1);
            assert.strictEqual(room.state.currentTurn, 2);

            const player1 = room.state.players.get(client1.sessionId)!;
            assert.strictEqual(player1.turnStatus, "not_started");
        });
    });

    describe("Turn Status Validation", () => {
        it("should validate action permissions based on turn status", async () => {
            const room = await colyseus.createRoom("dungeon", {});
            const client1 = await colyseus.connectTo(room, { name: "Player1" });
            const client2 = await colyseus.connectTo(room, { name: "Player2" });

            // Test initial permissions
            assert.strictEqual(room.state.canPlayerPerformAction(client1.sessionId, "drawCard"), true);
            assert.strictEqual(room.state.canPlayerPerformAction(client1.sessionId, "playCard"), false);
            assert.strictEqual(room.state.canPlayerPerformAction(client1.sessionId, "endTurn"), false);

            // After drawing card
            room.state.drawCard(client1.sessionId);
            assert.strictEqual(room.state.canPlayerPerformAction(client1.sessionId, "drawCard"), false);
            assert.strictEqual(room.state.canPlayerPerformAction(client1.sessionId, "playCard"), true);
            assert.strictEqual(room.state.canPlayerPerformAction(client1.sessionId, "endTurn"), true);

            // After completing turn
            room.state.updatePlayerTurnStatus(client1.sessionId, "turn_complete");
            assert.strictEqual(room.state.canPlayerPerformAction(client1.sessionId, "drawCard"), false);
            assert.strictEqual(room.state.canPlayerPerformAction(client1.sessionId, "playCard"), false);
            assert.strictEqual(room.state.canPlayerPerformAction(client1.sessionId, "endTurn"), false);
        });

        it("should provide accurate turn status summary", async () => {
            const room = await colyseus.createRoom("dungeon", {});
            const client1 = await colyseus.connectTo(room, { name: "Player1" });
            const client2 = await colyseus.connectTo(room, { name: "Player2" });
            const client3 = await colyseus.connectTo(room, { name: "Player3" });

            const status = room.state.getTurnStatus();
            assert.strictEqual(status.currentTurn, 1);
            assert.strictEqual(status.turnInProgress, true);
            assert.strictEqual(status.totalPlayers, 3);
            assert.strictEqual(status.playersReady, 0);

            // Players draw cards and end turns
            room.state.drawCard(client1.sessionId);
            room.state.drawCard(client2.sessionId);
            room.state.updatePlayerTurnStatus(client1.sessionId, "turn_complete");

            const status2 = room.state.getTurnStatus();
            assert.strictEqual(status2.playersReady, 1);
            assert.strictEqual(status2.playerStatuses[client1.sessionId], "turn_complete");
            assert.strictEqual(status2.playerStatuses[client2.sessionId], "playing_turn");
            assert.strictEqual(status2.playerStatuses[client3.sessionId], "not_started");
        });
    });

    describe("Edge Cases", () => {
        it("should handle single player turn advancement", async () => {
            const room = await colyseus.createRoom("dungeon", {});
            const client = await colyseus.connectTo(room, { name: "SoloPlayer" });

            const player = room.state.players.get(client.sessionId)!;

            // Draw card and end turn
            room.state.drawCard(client.sessionId);
            assert.strictEqual(player.turnStatus, "playing_turn");

            // End turn - should advance immediately with single player
            room.state.updatePlayerTurnStatus(client.sessionId, "turn_complete");

            // With single player, turn advances immediately
            assert.strictEqual(room.state.currentTurn, 2);
            assert.strictEqual(player.turnStatus, "not_started");
            assert.strictEqual(player.hasDrawnCard, false);
        });

        it("should handle rapid player join/leave during turns", async () => {
            const room = await colyseus.createRoom("dungeon", {});
            const client1 = await colyseus.connectTo(room, { name: "Player1" });

            // Player draws card
            room.state.drawCard(client1.sessionId);

            // New player joins mid-turn
            const client2 = await colyseus.connectTo(room, { name: "Player2" });
            assert.strictEqual(room.state.turnOrder.length, 2);

            // Original player ends turn
            room.state.updatePlayerTurnStatus(client1.sessionId, "turn_complete");
            assert.strictEqual(room.state.currentTurn, 1); // Should not advance yet

            // New player draws and ends turn
            room.state.drawCard(client2.sessionId);
            room.state.updatePlayerTurnStatus(client2.sessionId, "turn_complete");

            // Now turn should advance
            assert.strictEqual(room.state.currentTurn, 2);
        });
    });
});