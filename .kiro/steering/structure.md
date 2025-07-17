# Project Structure

This is a monorepo with separate frontend and backend applications.

## Root Level
```
├── app/           # Next.js frontend application
├── server/        # Colyseus game server
├── .kiro/         # Kiro IDE configuration and steering
└── LICENSE        # Project license
```

## Frontend Structure (app/)
```
app/
├── src/
│   ├── app/                    # Next.js App Router pages and components
│   │   ├── page.tsx           # Main game entry point
│   │   ├── game.tsx           # Core game component with Colyseus client
│   │   ├── DungeonMap.tsx     # Dungeon visualization component
│   │   ├── grid.tsx           # Grid layout component
│   │   ├── square.tsx         # Individual square component
│   │   ├── layout.tsx         # Root layout
│   │   └── globals.css        # Global styles
│   └── types/                 # TypeScript type definitions (shared with server)
│       ├── DungeonState.ts    # Game state types
│       ├── DungeonSquare.ts   # Square entity types
│       ├── Player.ts          # Player entity types
│       └── Room.ts            # Room entity types
├── public/                    # Static assets
├── package.json              # Frontend dependencies and scripts
├── next.config.mjs           # Next.js configuration
├── tailwind.config.ts        # Tailwind CSS configuration
└── tsconfig.json             # TypeScript configuration
```

## Backend Structure (server/)
```
server/
├── src/
│   ├── index.ts              # Server entry point
│   ├── app.config.ts         # Colyseus server configuration
│   └── rooms/                # Game room implementations
│       ├── Dungeon.ts        # Main dungeon room logic
│       └── schema/           # Colyseus schema definitions
│           ├── DungeonState.ts    # Main game state schema
│           ├── DungeonSquare.ts   # Square schema
│           ├── Player.ts          # Player schema
│           └── Room.ts            # Room schema
├── test/                     # Test files
│   ├── DungeonRoom_test.ts   # Dungeon room tests
│   └── Room_test.ts          # Room logic tests
├── loadtest/                 # Load testing scripts
│   └── example.ts            # Load test example
├── package.json              # Backend dependencies and scripts
├── tsconfig.json             # TypeScript configuration
└── ecosystem.config.js       # PM2 process configuration
```

## Key Conventions

### File Organization
- **Shared Types**: Type definitions are duplicated between `app/src/types/` and `server/src/rooms/schema/` to maintain separation
- **Component Structure**: React components use PascalCase naming
- **Schema Files**: Colyseus schema files use decorators and extend Schema class
- **Room Logic**: Game logic is centralized in room classes, not components

### Naming Patterns
- **Components**: PascalCase (e.g., `DungeonMap.tsx`, `Game.tsx`)
- **Types/Schemas**: PascalCase (e.g., `DungeonState.ts`, `Player.ts`)
- **Utilities**: camelCase for functions and variables
- **Constants**: UPPER_SNAKE_CASE (e.g., `BOARD_WIDTH`)

### Code Organization
- **Client-Server Communication**: Messages use camelCase (e.g., `crossSquare`)
- **State Management**: Colyseus handles all real-time state synchronization
- **UI Layout**: Uses Tailwind utility classes with responsive design
- **Game Logic**: Server-authoritative with client prediction for UI responsiveness