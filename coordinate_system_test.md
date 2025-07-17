# Coordinate System Fix Verification

## Problem
There was a bug where clicking a down exit opened a room up and clicking an up exit opened a room down.

## Root Cause
The coordinate system was inverted. In the server code:
- "north" was increasing Y coordinate (`targetY = y + 1`)
- "south" was decreasing Y coordinate (`targetY = y - 1`)

However, in screen coordinates, Y increases downward, so:
- "north" should decrease Y (move up on screen)
- "south" should increase Y (move down on screen)

## Fix Applied
Updated the coordinate system in:
1. `server/src/rooms/schema/DungeonState.ts` - `addNewRoomFromExit` method
2. `server/src/rooms/schema/DungeonState.ts` - `findOrCreateAdjacentRoom` method  
3. `server/src/rooms/GridManager.ts` - `getAdjacentRoom` method

Changed from:
```typescript
case "north":
  targetY = y + 1; // OLD - wrong direction
case "south":
  targetY = y - 1; // OLD - wrong direction
```

To:
```typescript
case "north":
  targetY = y - 1; // NEW - correct (up on screen)
case "south":
  targetY = y + 1; // NEW - correct (down on screen)
```

## Tests Updated
Updated all test files to match the corrected coordinate system:
- `server/test/GridRoomGeneration_test.ts`
- `server/test/GridManager_test.ts`
- `server/test/DungeonRoom_test.ts`

## Verification
- All 101 server tests pass
- All 7 frontend tests pass
- Coordinate system now correctly maps:
  - North exits → rooms positioned above (negative Y)
  - South exits → rooms positioned below (positive Y)
  - East exits → rooms positioned right (positive X)
  - West exits → rooms positioned left (negative X)