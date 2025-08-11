# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

Cross-off Dungeon is a multiplayer dungeon exploration game built with:

- **Frontend**: Next.js 14 + React 18 (TypeScript) in `/app/`
- **Backend**: Colyseus multiplayer server (TypeScript) in `/server/`
- **Real-time Communication**: WebSocket-based state synchronization using Colyseus

### Key Architecture Components

**Server (`/server/src/`)**:
- `rooms/Dungeon.ts`: Main Colyseus room handler managing game sessions (max 4 clients)
- `rooms/schema/DungeonState.ts`: Server-side game state schema with player management and turn system
- `rooms/GridManager.ts`: Handles dungeon room generation and grid management
- `rooms/NavigationValidator.ts`: Validates player movement and navigation rules

**Client (`/app/src/app/`)**:
- `game.tsx`: Main game component managing Colyseus client connection and state
- `DungeonMap.tsx`: Renders the dungeon grid interface
- Card system components: `CardDeck.tsx`, `DrawnCard.tsx`, `DiscardPile.tsx`
- `TurnControls.tsx`: Manages turn-based gameplay UI

### Game Mechanics
- Turn-based gameplay with turn status tracking (`not_started`, `playing_turn`, `turn_complete`)
- Card-based square selection system with validation (max 3 squares per card)
- Multi-room dungeon exploration with room connectivity
- Real-time state synchronization between all connected clients

## Development Commands

**Frontend** (run from `/app/`):
```bash
npm run dev       # Start Next.js development server (localhost:3000)
npm run build     # Build for production
npm run lint      # Run ESLint
npm run test      # Run Jest tests
npm run test:watch # Run tests in watch mode
```

**Backend** (run from `/server/`):
```bash
npm start         # Start Colyseus server with tsx watch (localhost:2567)
npm run build     # Compile TypeScript to /build/
npm run test      # Run Mocha test suite
npm run loadtest  # Run load testing with 2 clients
```

## State Management & Communication

The game uses Colyseus schema-based state management:
- Server maintains authoritative state in `DungeonState`
- Client receives state updates via WebSocket and renders accordingly
- Message-based communication for player actions (`crossSquare`, `drawCard`, `endTurn`, etc.)
- Client-side validation with server-side confirmation for responsive UI

## Testing

- **Server**: Mocha test suite in `/server/test/` with comprehensive game logic tests
- **Client**: Jest with React Testing Library in `/app/src/app/__tests__/`
- Run tests independently in each directory using the respective `npm test` commands

## Connection Configuration

The client connects to `ws://localhost:2567` in development. The commented production URL suggests deployment on Colyseus Cloud.