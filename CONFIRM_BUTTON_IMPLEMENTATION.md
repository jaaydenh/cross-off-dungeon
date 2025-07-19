# Confirm Button Implementation

## Overview
Implemented a confirm button system for card-based square crossing that allows players to commit moves with any number of selected squares (1-3) instead of automatically committing on the 3rd selection.

## Changes Made

### 1. New Component: ConfirmMoveButton
- **File**: `app/src/app/ConfirmMoveButton.tsx`
- **Purpose**: Displays a confirm button when player has selected at least 1 square during card play
- **Features**:
  - Shows number of selected squares
  - Styled with green color and hover effects
  - Only visible when player has an active card and selected squares

### 2. Server-Side Changes

#### DungeonState.ts
- **Modified `selectSquareForCard` method**: Removed auto-commit on 3rd square selection
- **Added `confirmCardAction` method**: New method to manually commit selected squares
- **Updated messages**: Changed card activation message to reflect new behavior

#### Dungeon.ts
- **Added message handler**: `confirmCardAction` message handler to process confirm requests

#### Player.ts
- **Updated card description**: Changed from "Cross any 3 connected squares" to "Cross up to 3 connected squares"

### 3. Client-Side Changes

#### game.tsx
- **Added message handler**: `confirmCardActionResult` to handle server responses
- **Fixed room index handling**: Corrected selectedSquares tracking to use display room indices
- **Updated validation logic**: Fixed connectivity validation for multi-room scenarios

#### DungeonMap.tsx
- **Added ConfirmMoveButton**: Integrated confirm button component
- **Button positioning**: Shows confirm button only on first room to avoid duplicates
- **Conditional visibility**: Button appears when player has active card and selected squares

## How It Works

1. **Card Activation**: Player draws and activates a card as before
2. **Square Selection**: Player clicks on squares to select them (visual feedback with blue X)
3. **Confirm Button**: Button appears after first square selection showing count
4. **Manual Commit**: Player clicks confirm button to commit the move with any number of squares (1-3)
5. **Completion**: Selected squares are crossed, card moves to discard pile

## Key Features

- **Flexible Selection**: Can commit with 1, 2, or 3 squares
- **Visual Feedback**: Selected squares show blue X before confirmation
- **Clear UI**: Confirm button shows number of selected squares
- **Consistent Behavior**: Maintains all existing validation rules (connectivity, adjacency, etc.)

## Testing

The implementation compiles successfully on both server and client. The changes maintain backward compatibility with existing game mechanics while adding the new confirm functionality.

## Files Modified

### Server
- `server/src/rooms/Dungeon.ts`
- `server/src/rooms/schema/DungeonState.ts`
- `server/src/rooms/schema/Player.ts`

### Client
- `app/src/app/game.tsx`
- `app/src/app/DungeonMap.tsx`
- `app/src/app/ConfirmMoveButton.tsx` (new)