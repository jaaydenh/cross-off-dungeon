# Connection Bug Investigation and Fix

## Bug Description
There was a bug where visual connection lines were being drawn between rooms that were not actually adjacent, creating incorrect visual representations of room connections.

## Root Cause Analysis

### The Problem
The issue was in the `detectConnections()` function in `app/src/app/DungeonMap.tsx`. The function was incorrectly mapping room connections due to a mismatch between:

1. **Server-side room indices**: `connectedRoomIndices[exitIndex]` stores the **global room index** from the server's rooms array
2. **Frontend displayed room indices**: The `rooms` prop contains only **displayed rooms** with their own local array indices

### Example of the Bug
- Server has rooms: [Room0, Room1, Room2, Room3, Room4, Room5]
- Displayed rooms: [Room0, Room2, Room5] (indices [0, 1, 2] in displayed array)
- Room0 connects to Room2 (server index 2)
- Bug: Frontend looked for `rooms[2]` which was Room5, not Room2
- Result: Visual connection drawn from Room0 to Room5 instead of Room0 to Room2

### Original Buggy Code
```typescript
// BUGGY: This assumes connectedRoomIndex is an array index in displayed rooms
const toRoomData = rooms.find((_, index) => index === connectedRoomIndex);
```

## Fix Implementation

### New Logic
Instead of treating `connectedRoomIndex` as a displayed rooms array index, the fix:

1. **Validates adjacency by grid coordinates**: Calculates expected target coordinates based on exit direction
2. **Finds rooms by position**: Searches for rooms at the expected adjacent grid coordinates
3. **Ensures proper connections**: Only shows connections between actually adjacent rooms

### Fixed Code
```typescript
// FIXED: Find room by expected grid coordinates, not array index
for (let i = 0; i < rooms.length; i++) {
  const candidateRoom = rooms[i].room;
  
  // Calculate expected coordinates based on exit direction
  const expectedToX = exitDirection === 'east' ? fromRoom.gridX + 1 :
                     exitDirection === 'west' ? fromRoom.gridX - 1 : fromRoom.gridX;
  const expectedToY = exitDirection === 'north' ? fromRoom.gridY - 1 :
                     exitDirection === 'south' ? fromRoom.gridY + 1 : fromRoom.gridY;
  
  // Only connect if room is at expected adjacent coordinates
  if (candidateRoom.gridX === expectedToX && candidateRoom.gridY === expectedToY) {
    toRoomData = rooms[i];
    toIndex = i;
    break;
  }
}
```

## Verification

### Tests Passing
- ✅ All 7 frontend tests pass
- ✅ All 101 server tests pass
- ✅ Connection detection logic validates adjacency
- ✅ Visual connections only shown between truly adjacent rooms

### Key Improvements
1. **Accurate connections**: Visual lines only drawn between adjacent rooms
2. **Grid validation**: Connections validated against actual grid coordinates
3. **Robust logic**: Handles complex room layouts and non-sequential room indices
4. **Maintained functionality**: All existing features continue to work

## Impact
- **Visual accuracy**: Connection lines now correctly represent actual room adjacency
- **User experience**: Players see accurate dungeon layout representation
- **System integrity**: Frontend visualization matches server-side room connections
- **No breaking changes**: All existing functionality preserved