import { FC, useState, useCallback } from 'react';
import Square from './square';
import { Room } from '@/types/Room';

interface GridProps {
  room: Room;
  handleSquareClick: (x: number, y: number) => void;
  invalidSquareHighlight?: {x: number, y: number} | null;
  selectedSquares?: Array<{roomIndex: number, x: number, y: number}>;
  roomIndex: number;
  cellSizePx?: number;
  horizontalPairPreviewEnabled?: boolean;
}

interface ExitHighlightInfo {
  exitIndex: number;
  isNavigable: boolean;
  isConnected: boolean;
  adjacentCrossedSquares: { x: number; y: number }[];
}

const Grid: FC<GridProps> = ({
  room,
  handleSquareClick,
  invalidSquareHighlight,
  selectedSquares,
  roomIndex,
  cellSizePx = 42,
  horizontalPairPreviewEnabled = false
}) => {
  const [hoveredExit, setHoveredExit] = useState<number | null>(null);
  const [hoveredSquare, setHoveredSquare] = useState<{ x: number; y: number } | null>(null);

  // Helper function to get square at coordinates
  const getSquareAt = useCallback((x: number, y: number) => {
    if (x < 0 || x >= room.width || y < 0 || y >= room.height) {
      return undefined;
    }
    return room.squares[y * room.width + x];
  }, [room]);

  // Navigation validation logic (client-side mirror of server logic)
  const findAdjacentCrossedSquares = useCallback((x: number, y: number): { x: number; y: number }[] => {
    const adjacentCrossedSquares: { x: number; y: number }[] = [];

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
      if (adjacentX >= 0 && adjacentX < room.width && adjacentY >= 0 && adjacentY < room.height) {
        const adjacentSquare = getSquareAt(adjacentX, adjacentY);

        // If the adjacent square exists and is crossed (checked = true), add it to results
        if (adjacentSquare && adjacentSquare.checked) {
          adjacentCrossedSquares.push({ x: adjacentX, y: adjacentY });
        }
      }
    }

    return adjacentCrossedSquares;
  }, [room, getSquareAt]);

  // Calculate exit highlight information
  const getExitHighlightInfo = useCallback((): ExitHighlightInfo[] => {
    const exitInfo: ExitHighlightInfo[] = [];

    for (let i = 0; i < room.exitX.length; i++) {
      const exitX = room.exitX[i];
      const exitY = room.exitY[i];
      const adjacentCrossedSquares = findAdjacentCrossedSquares(exitX, exitY);
      const isNavigable = adjacentCrossedSquares.length > 0;
      const isConnected = room.exitConnected[i] || false;

      exitInfo.push({
        exitIndex: i,
        isNavigable,
        isConnected,
        adjacentCrossedSquares
      });
    }

    return exitInfo;
  }, [room, findAdjacentCrossedSquares]);

  const exitHighlightInfo = getExitHighlightInfo();

  const previewCells = (() => {
    if (!horizontalPairPreviewEnabled || !hoveredSquare) return { cells: [], invalid: false };
    const left = getSquareAt(hoveredSquare.x, hoveredSquare.y);
    const rightX = hoveredSquare.x + 1;
    const rightY = hoveredSquare.y;
    const right = getSquareAt(rightX, rightY);

    const isOrthAdjacent = (ax: number, ay: number, bx: number, by: number) =>
      (Math.abs(ax - bx) === 1 && ay === by) || (Math.abs(ay - by) === 1 && ax === bx);

    const isAdjacentToEntranceOrCrossed = (x: number, y: number): boolean => {
      if (room.entranceX !== -1 && room.entranceY !== -1) {
        if (isOrthAdjacent(x, y, room.entranceX, room.entranceY)) {
          return true;
        }
      }

      for (let checkY = 0; checkY < room.height; checkY++) {
        for (let checkX = 0; checkX < room.width; checkX++) {
          const square = getSquareAt(checkX, checkY);
          if (square?.checked && isOrthAdjacent(x, y, checkX, checkY)) {
            return true;
          }
        }
      }

      return false;
    };

    const invalid =
      !left ||
      !right ||
      left.wall ||
      right.wall ||
      left.checked ||
      right.checked ||
      !(isAdjacentToEntranceOrCrossed(hoveredSquare.x, hoveredSquare.y) || isAdjacentToEntranceOrCrossed(rightX, rightY));

    return {
      cells: [
        { x: hoveredSquare.x, y: hoveredSquare.y },
        { x: rightX, y: rightY }
      ],
      invalid
    };
  })();

  const previewOverlayCells = previewCells.cells.filter(
    (pos) => pos.x >= 0 && pos.x < room.width && pos.y >= 0 && pos.y < room.height
  );

  // Check if a square is adjacent to any exit
  const getSquareAdjacentToExitInfo = useCallback((x: number, y: number) => {
    for (const exitInfo of exitHighlightInfo) {
      const exitX = room.exitX[exitInfo.exitIndex];
      const exitY = room.exitY[exitInfo.exitIndex];

      // Check if this square is orthogonally adjacent to the exit
      const deltaX = Math.abs(x - exitX);
      const deltaY = Math.abs(y - exitY);

      if ((deltaX === 1 && deltaY === 0) || (deltaX === 0 && deltaY === 1)) {
        return {
          isAdjacentToExit: true,
          exitInfo,
          exitX,
          exitY
        };
      }
    }

    return { isAdjacentToExit: false };
  }, [exitHighlightInfo, room]);

  const renderSquares = () => {
    const squares = [];

    for (let y = 0; y < room.height; y++) {
      for (let x = 0; x < room.width; x++) {
        const index = y * room.width + x;
        const square = room.squares[index];

        if (square) {
          // Check if this square is an exit and get its highlight info
          let exitInfo: ExitHighlightInfo | null = null;
          if (square.exit) {
            const exitIndex = room.exitX.findIndex((ex, i) => ex === x && room.exitY[i] === y);
            if (exitIndex >= 0) {
              exitInfo = exitHighlightInfo[exitIndex];
            }
          }

          // Check if this square is adjacent to an exit
          const adjacentInfo = getSquareAdjacentToExitInfo(x, y);

          // Check if this square should show invalid highlight
          const shouldShowInvalidHighlight = invalidSquareHighlight && 
            invalidSquareHighlight.x === x && invalidSquareHighlight.y === y;

          // Check if this square is selected for card-based action
          const isSelected = selectedSquares?.some(pos => 
            pos.roomIndex === roomIndex && pos.x === x && pos.y === y
          ) || false;

          squares.push(
            <Square
              key={`${x}-${y}`}
              x={x}
              y={y}
              square={square}
              onClick={handleSquareClick}
              onHover={
                horizontalPairPreviewEnabled
                  ? (hoverX, hoverY) => setHoveredSquare({ x: hoverX, y: hoverY })
                  : undefined
              }
              onHoverEnd={horizontalPairPreviewEnabled ? () => setHoveredSquare(null) : undefined}
              sizePx={cellSizePx}
              exitInfo={exitInfo}
              isAdjacentToExit={adjacentInfo.isAdjacentToExit}
              adjacentExitInfo={adjacentInfo.exitInfo}
              onExitHover={setHoveredExit}
              isExitHovered={hoveredExit !== null && exitInfo?.exitIndex === hoveredExit}
              showInvalidHighlight={shouldShowInvalidHighlight}
              isSelected={isSelected}
            />
          );
        }
      }
    }

    return squares;
  };

  return (
    <div className="relative" style={{ width: `${room.width * cellSizePx}px`, height: `${room.height * cellSizePx}px` }}>
      <div
        className="grid relative z-0"
        style={{
          gridTemplateColumns: `repeat(${room.width}, ${cellSizePx}px)`,
          gridTemplateRows: `repeat(${room.height}, ${cellSizePx}px)`,
        }}
      >
        {renderSquares()}
      </div>
      {horizontalPairPreviewEnabled && previewOverlayCells.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-30">
          {previewOverlayCells.map((cell) => (
            <div
              key={`preview-${cell.x}-${cell.y}`}
              className={`absolute border-2 ${
                previewCells.invalid
                  ? 'bg-red-500/45 border-red-300'
                  : 'bg-sky-500/45 border-sky-300'
              }`}
              style={{
                left: `${cell.x * cellSizePx}px`,
                top: `${cell.y * cellSizePx}px`,
                width: `${cellSizePx}px`,
                height: `${cellSizePx}px`,
                boxSizing: 'border-box'
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Grid;
