import { Room } from "./schema/Room";
import { DungeonSquare } from "./schema/DungeonSquare";

/**
 * NavigationValidator handles validation of exit navigation based on adjacency requirements.
 * Players can only navigate through exits if they have crossed squares (X) orthogonally adjacent to the exit.
 */
export class NavigationValidator {
  /**
   * Check if a player can navigate to a specific exit based on adjacency requirements.
   * @param room The room containing the exit
   * @param exitIndex The index of the exit in the room's exit arrays
   * @returns true if navigation is allowed, false otherwise
   */
  canNavigateToExit(room: Room, exitIndex: number): boolean {
    // Validate exit index
    if (exitIndex < 0 || exitIndex >= room.exitX.length) {
      return false;
    }

    const exitX = room.exitX[exitIndex];
    const exitY = room.exitY[exitIndex];

    // Find all crossed squares adjacent to this exit
    const adjacentCrossedSquares = this.findAdjacentCrossedSquares(room, exitX, exitY);
    
    // Navigation is allowed if there's at least one crossed square orthogonally adjacent to the exit
    return adjacentCrossedSquares.length > 0;
  }

  /**
   * Find all crossed squares (checked = true) that are orthogonally adjacent to the given coordinates.
   * @param room The room to search in
   * @param x The x coordinate to check adjacency to
   * @param y The y coordinate to check adjacency to
   * @returns Array of DungeonSquare objects that are crossed and orthogonally adjacent
   */
  findAdjacentCrossedSquares(room: Room, x: number, y: number): DungeonSquare[] {
    const adjacentCrossedSquares: DungeonSquare[] = [];

    // Check all four orthogonal directions: north, east, south, west
    const directions = [
      { dx: 0, dy: -1 }, // North
      { dx: 1, dy: 0 },  // East
      { dx: 0, dy: 1 },  // South
      { dx: -1, dy: 0 }  // West
    ];

    for (const direction of directions) {
      const adjacentX = x + direction.dx;
      const adjacentY = y + direction.dy;

      // Check if the adjacent position is valid and within room bounds
      if (room.isValidPosition(adjacentX, adjacentY)) {
        const adjacentSquare = room.getSquare(adjacentX, adjacentY);
        
        // If the adjacent square exists and is crossed (checked = true), add it to results
        if (adjacentSquare && adjacentSquare.checked) {
          adjacentCrossedSquares.push(adjacentSquare);
        }
      }
    }

    return adjacentCrossedSquares;
  }

  /**
   * Check if two coordinates are orthogonally adjacent (not diagonally).
   * Two coordinates are orthogonally adjacent if they differ by exactly 1 in either x or y (but not both).
   * @param x1 First coordinate x
   * @param y1 First coordinate y
   * @param x2 Second coordinate x
   * @param y2 Second coordinate y
   * @returns true if coordinates are orthogonally adjacent, false otherwise
   */
  isOrthogonallyAdjacent(x1: number, y1: number, x2: number, y2: number): boolean {
    const deltaX = Math.abs(x1 - x2);
    const deltaY = Math.abs(y1 - y2);

    // Orthogonally adjacent means exactly one coordinate differs by 1, the other by 0
    return (deltaX === 1 && deltaY === 0) || (deltaX === 0 && deltaY === 1);
  }
}