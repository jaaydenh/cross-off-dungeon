# Product Overview

This is a multiplayer dungeon exploration game built with real-time synchronization. Players can join rooms, explore procedurally generated dungeon rooms, and interact with a grid-based game world.

## Core Features
- Real-time multiplayer gameplay (up to 4 players per room)
- Procedurally generated dungeon rooms with random layouts
- Grid-based movement and interaction system
- Room-to-room navigation through exits
- Player state synchronization across clients

## Game Mechanics
- Players can click on dungeon squares to "cross" them
- Rooms have walls, exits, and entrances
- Exiting through a room's exit generates and connects to a new room
- Multiple rooms can be displayed simultaneously as players explore
- Each room has randomized dimensions (6-10 width/height) and wall placement

## Architecture
The game uses a client-server architecture with:
- **Frontend**: Next.js React application for the game interface
- **Backend**: Colyseus game server handling real-time state synchronization
- **Communication**: WebSocket-based real-time messaging between client and server