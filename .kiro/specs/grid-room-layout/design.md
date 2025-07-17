# Design Document

## Overview

This design transforms the current room-based dungeon system into a true grid-based layout where rooms exist at specific coordinates and connect through aligned exits. The key changes involve implementing a coordinate system for rooms, enforcing exit connections between adjacent rooms, and adding adjacency validation for exit navigation.

The current system already has basic room positioning (`roomPositionsX`, `roomPositionsY`) but lacks true grid-based logic for room connections and exit validation. This design will build upon the existing Colyseus real-time architecture while adding the necessary grid management and navigation constraints.

## Architecture

### Grid Coordinate System
- **Grid Manager**: New component responsible for managing room coordinates and connections
- **Room Registry**: Map of (x,y) coordinates to room instances for fast lookups
- **Connection Validator**: Logic to ensure exits align with adjacent room entrances
- **Navigation Controller**: Handles exit clicking with adjacency validation

### Data Flow
1. **Room Creation**: When a room is generated, assign grid coordinates based on exit direction
2. **Connection Resolution**: Check if target coordinates have existing room, connect or create new
3. **Exit Validation**: Before allowing navigation, verify X adjacency to clicked exit
4. **State Synchronization**: Broadcast grid changes to all connected clients

## Components and Interfaces

### Server-Side Components

#### GridManager (New)
```typescript
class GridManager {
  private roomGrid: Map<string, number>; // "x,y" -> roomIndex
  private connections: Map<string, Connection[]>; // roomIndex -> connections
  
  getRoomAt(x: number, y: number): number | null
  setRoomAt(x: number, y: number, roomIndex: number): void
  getAdjacentRoom(x: number, y: number, direction: string): number | null
  validateConnection(room1: Room, room2: Room, direction: string): boolean
}
```

#### NavigationValidator (New)
```typescript
class NavigationValidator {
  canNavigateToExit(room: Room, exitX: number, exitY: number): boolean
  findAdjacentCrossedSquares(room: Room, x: number, y: number): DungeonSquare[]
  isOrthogonallyAdjacent(x1: number, y1: number, x2: number, y2: number): boolean
}
```

#### Enhanced DungeonState
```typescript
// Add new properties
@type("number") gridOriginX = 0; // Starting grid position
@type("number") gridOriginY = 0;
@type({ map: "number" }) roomGridPositions = new MapSchema<number>(); // "x,y" -> roomIndex

// New methods
assignGridCoordinates(roomIndex: number, x: number, y: number): void
getGridCoordinates(roomIndex: number): {x: number, y: number} | null
findOrCreateAdjacentRoom(currentX: number, currentY: number, direction: string): number
```

#### Enhanced Room Schema
```typescript
// Add grid position tracking
@type("number") gridX = 0;
@type("number") gridY = 0;

// Enhanced exit connection tracking
@type(["number"]) connectedRoomIndices = new ArraySchema<number>(); // Which rooms connect to each exit
@type(["boolean"]) exitConnected = new ArraySchema<boolean>(); // Whether each exit connects to discovered room
```

### Frontend Components

#### Enhanced DungeonMap
- **Grid Layout Calculator**: Positions rooms based on grid coordinates with consistent spacing
- **Connection Renderer**: Visual indicators for connected exits between adjacent rooms
- **Exit Click Handler**: Validates adjacency before sending navigation request

#### Enhanced Grid Component
- **Exit Highlighting**: Visual feedback for clickable vs non-clickable exits
- **Adjacency Indicator**: Highlight squares adjacent to exits for user guidance
- **Connection Visualization**: Show visual connections between aligned exits

## Data Models

### Grid Position Model
```typescript
interface GridPosition {
  x: number;
  y: number;
}

interface RoomConnection {
  fromRoomIndex: number;
  toRoomIndex: number;
  fromExitIndex: number;
  toEntranceDirection: string;
}
```

### Enhanced Room Model
```typescript
interface EnhancedRoom extends Room {
  gridX: number;
  gridY: number;
  connectedRoomIndices: number[];
  exitConnected: boolean[];
  
  // New methods
  getExitDirection(exitIndex: number): string;
  getConnectedRoom(exitIndex: number): number | null;
  isExitNavigable(exitIndex: number): boolean;
}
```

### Navigation Request Model
```typescript
interface NavigationRequest {
  roomIndex: number;
  exitIndex: number;
  playerPosition?: {x: number, y: number}; // For future player tracking
}
```

## Error Handling

### Grid Coordinate Conflicts
- **Detection**: Check for existing room at target coordinates before placement
- **Resolution**: Connect to existing room instead of creating new one
- **Validation**: Ensure exit directions align with existing room entrances

### Invalid Navigation Attempts
- **Adjacency Validation**: Check for orthogonally adjacent crossed squares before allowing exit navigation
- **User Feedback**: Return clear error messages for failed navigation attempts
- **State Consistency**: Prevent client-server state desynchronization

### Room Connection Failures
- **Misaligned Exits**: Handle cases where adjacent rooms have incompatible exit/entrance positions
- **Missing Rooms**: Gracefully handle references to non-existent rooms
- **Circular Dependencies**: Prevent infinite loops in room generation

## Testing Strategy

### Unit Tests
- **GridManager**: Test coordinate assignment, room lookup, and adjacency calculations
- **NavigationValidator**: Test adjacency detection with various room layouts and crossed square patterns
- **Room Connection Logic**: Test exit-entrance alignment and connection establishment

### Integration Tests
- **Room Generation Flow**: Test complete flow from exit click to new room creation with proper grid placement
- **Multi-Room Navigation**: Test navigation between multiple connected rooms in various grid arrangements
- **State Synchronization**: Test that grid changes propagate correctly to all connected clients

### End-to-End Tests
- **Player Navigation**: Test complete player journey through multiple connected rooms
- **Multiplayer Scenarios**: Test grid consistency when multiple players explore simultaneously
- **Edge Cases**: Test boundary conditions like grid edges and maximum room limits

## Implementation Phases

### Phase 1: Grid Infrastructure
- Implement GridManager for coordinate tracking
- Add grid position properties to Room and DungeonState schemas
- Create basic room placement logic with coordinate assignment

### Phase 2: Connection System
- Implement exit-entrance alignment validation
- Add logic to connect existing rooms instead of always creating new ones
- Update room generation to respect grid constraints

### Phase 3: Navigation Validation
- Implement NavigationValidator for adjacency checking
- Add exit click validation on both client and server
- Provide user feedback for invalid navigation attempts

### Phase 4: Visual Enhancements
- Update DungeonMap to show room connections visually
- Add exit highlighting based on navigability
- Implement consistent grid-based room positioning

### Phase 5: Testing and Polish
- Comprehensive testing of all grid scenarios
- Performance optimization for large grid layouts
- User experience improvements and error handling