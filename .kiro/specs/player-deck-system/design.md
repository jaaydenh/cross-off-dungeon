# Design Document

## Overview

The player deck system introduces turn-based card gameplay to the existing multiplayer dungeon exploration game. Each player will have a personal deck of 10 cards that they can draw and play during structured turns. The system integrates with the existing Colyseus real-time architecture and extends the current Player schema to include card and turn management.

## Architecture

### Data Flow
1. **Game Initialization**: When players join, each receives a shuffled deck of 10 cards
2. **Turn Management**: Server tracks turn state and player statuses across all clients
3. **Card Actions**: Players draw cards, activate them, and perform grid-based actions
4. **State Synchronization**: All card states, turn progress, and player actions sync in real-time

### Card Action Workflow
1. **Card Drawing**: Player clicks deck → card moves from deck to drawnCards → glow effect removed
2. **Card Activation**: Player clicks drawn card → card.isActive = true → square selection mode begins
3. **Square Selection**: Player selects 3 connected squares → cancel button appears after first selection
4. **Action Completion**: After 3 valid squares → card moves to discardPile → cancel button disappears
5. **Turn Completion**: Player clicks "End Turn" → status updates → turn advances when all players complete

### Integration Points
- Extends existing `Player` schema with card and turn properties
- Integrates with current `crossSquare` functionality for card-based square selection
- Enhances the existing UI player area with card display and turn controls

## Components and Interfaces

### Server-Side Components

#### Enhanced Player Schema
```typescript
export class Player extends Schema {
  @type("string") name: string;
  @type([Card]) deck = new ArraySchema<Card>();
  @type([Card]) drawnCards = new ArraySchema<Card>();
  @type([Card]) discardPile = new ArraySchema<Card>();
  @type("string") turnStatus: "not_started" | "playing_turn" | "turn_complete" = "not_started";
  @type("boolean") hasDrawnCard: boolean = false;
}
```

#### New Card Schema
```typescript
export class Card extends Schema {
  @type("string") id: string;
  @type("string") type: string;
  @type("string") description: string;
  @type("boolean") isActive: boolean = false;
}
```

#### Turn Management in DungeonState
```typescript
export class DungeonState extends Schema {
  // ... existing properties
  @type("number") currentTurn: number = 1;
  @type("boolean") turnInProgress: boolean = false;
  @type(["string"]) turnOrder = new ArraySchema<string>(); // Player session IDs
}
```

### Client-Side Components

#### CardDeck Component
- Displays face-down deck with glow effect
- Handles deck clicking for card drawing
- Shows remaining card count

#### DrawnCard Component  
- Displays face-up drawn card
- Handles card activation clicks
- Shows card description and actions

#### TurnControls Component
- Displays "End Turn" button
- Shows current turn status
- Manages turn progression

#### DiscardPile Component
- Displays face-up discard pile to the left of the deck
- Shows the top card of the discard pile
- Updates when cards are played and discarded

#### CancelButton Component
- Appears next to rooms during card-based square selection
- Allows players to cancel current card action and clear selected squares
- Removes itself when card action is completed or cancelled

#### Enhanced PlayerList Component
- Shows player names with status indicators in the Players section
- Displays turn completion states ("not started", "playing turn", "turn complete")
- Updates in real-time based on server state changes

## Data Models

### Card Types
Initially, all cards will be of type "cross_connected_squares" with the description "Cross any 3 connected squares".

### Card Structure
```typescript
interface Card {
  id: string;           // Unique identifier
  type: string;         // "cross_connected_squares"
  description: string;  // "Cross any 3 connected squares"
  isActive: boolean;    // Whether card is currently being played
}
```

### Turn State
```typescript
interface TurnState {
  currentTurn: number;
  turnInProgress: boolean;
  playersReady: string[]; // Session IDs of players who ended turn
}
```

### Player Status Types
- `"not_started"`: Player hasn't drawn a card this turn
- `"playing_turn"`: Player has drawn a card but hasn't ended turn
- `"turn_complete"`: Player has clicked "End Turn"

## Error Handling

### Invalid Square Selection
- **Detection**: Validate square connectivity and adjacency rules
- **Response**: Briefly highlight invalid squares in red (500ms duration)
- **Recovery**: Allow player to continue selecting valid squares

### Turn State Conflicts
- **Detection**: Server validates turn actions against current turn state
- **Response**: Reject invalid actions with error messages
- **Recovery**: Client refreshes turn state from server

### Card State Synchronization
- **Detection**: Monitor for card state mismatches between client/server
- **Response**: Server state takes precedence, client updates accordingly
- **Recovery**: Automatic state reconciliation on next server update

## Testing Strategy

### Unit Tests
- Card deck initialization and shuffling
- Turn state transitions and validation
- Square selection validation for card actions
- Player status updates

### Integration Tests
- Multi-player turn progression
- Card drawing and playing across clients
- Real-time state synchronization
- Error handling for invalid actions

### End-to-End Tests
- Complete turn cycle with multiple players
- Card action execution and square crossing
- UI responsiveness and visual feedback
- Turn completion and advancement

## Implementation Considerations

### Performance
- Minimize state updates by batching card actions
- Use efficient array operations for deck management
- Optimize UI re-renders with React.memo for card components

### User Experience
- Smooth animations for card drawing and playing
- Clear visual feedback for turn states and valid actions
- Responsive design for different screen sizes

### Scalability
- Card system designed to support future card types
- Turn management scales with room player limits (currently 4 players)
- Extensible architecture for additional game mechanics