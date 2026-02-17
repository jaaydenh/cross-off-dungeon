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
  cunningStepPreviewLength?: 1 | 2 | 3 | null;
  spreadOutPreviewEnabled?: boolean;
}

interface ExitHighlightInfo {
  exitIndex: number;
  isNavigable: boolean;
  isConnected: boolean;
  adjacentCrossedSquares: { x: number; y: number }[];
}

type DoorwayDirection = 'north' | 'east' | 'south' | 'west';
interface DoorwayPlacement {
  x: number;
  y: number;
  direction: DoorwayDirection;
}

const ROOM_BORDER_COLOR = '#0b0b0b';
const ROOM_DOORWAY_FILL_COLOR = '#e8dfcf';

const Grid: FC<GridProps> = ({
  room,
  handleSquareClick,
  invalidSquareHighlight,
  selectedSquares,
  roomIndex,
  cellSizePx = 42,
  horizontalPairPreviewEnabled = false,
  cunningStepPreviewLength = null,
  spreadOutPreviewEnabled = false
}) => {
  const [hoveredExit, setHoveredExit] = useState<number | null>(null);
  const [hoveredSquare, setHoveredSquare] = useState<{ x: number; y: number } | null>(null);
  const gridWidthPx = room.width * cellSizePx;
  const gridHeightPx = room.height * cellSizePx;
  const borderWidthPx = Math.max(6, Math.round(cellSizePx * 0.14));
  const extendedBorderWidthPx = gridWidthPx + borderWidthPx * 2;
  const extendedBorderHeightPx = gridHeightPx + borderWidthPx * 2;
  const doorwayOpeningPx = Math.max(18, Math.round(cellSizePx * 0.66));
  const doorwayDepthPx = Math.max(10, Math.round(cellSizePx * 0.3));
  const doorwayRailPx = Math.max(3, Math.round(borderWidthPx * 0.72));

  const asDoorwayDirection = (direction?: string): DoorwayDirection | null => {
    if (
      direction === 'north' ||
      direction === 'east' ||
      direction === 'south' ||
      direction === 'west'
    ) {
      return direction;
    }
    return null;
  };

  const inferEdgeDirection = (x: number, y: number): DoorwayDirection | null => {
    if (y === 0) return 'north';
    if (x === room.width - 1) return 'east';
    if (y === room.height - 1) return 'south';
    if (x === 0) return 'west';
    return null;
  };

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

  const isOrthAdjacent = (ax: number, ay: number, bx: number, by: number) =>
    (Math.abs(ax - bx) === 1 && ay === by) || (Math.abs(ay - by) === 1 && ax === bx);

  const isAdjacentToEntranceOrCrossed = (
    x: number,
    y: number,
    pendingSquares: Array<{ x: number; y: number }> = []
  ): boolean => {
    const pendingKeySet = new Set(pendingSquares.map((square) => `${square.x},${square.y}`));

    if (room.entranceX !== -1 && room.entranceY !== -1) {
      if (isOrthAdjacent(x, y, room.entranceX, room.entranceY)) {
        return true;
      }
    }

    for (let checkY = 0; checkY < room.height; checkY++) {
      for (let checkX = 0; checkX < room.width; checkX++) {
        if (pendingKeySet.has(`${checkX},${checkY}`) && isOrthAdjacent(x, y, checkX, checkY)) {
          return true;
        }
        const square = getSquareAt(checkX, checkY);
        if (square?.checked && isOrthAdjacent(x, y, checkX, checkY)) {
          return true;
        }
      }
    }

    return false;
  };

  const previewCells = (() => {
    if (!horizontalPairPreviewEnabled || !hoveredSquare) return { cells: [], invalid: false };
    const left = getSquareAt(hoveredSquare.x, hoveredSquare.y);
    const rightX = hoveredSquare.x + 1;
    const rightY = hoveredSquare.y;
    const right = getSquareAt(rightX, rightY);

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
  const cunningPreview = (() => {
    if (!cunningStepPreviewLength || !hoveredSquare) {
      return { cells: [] as Array<{ x: number; y: number }>, invalid: false };
    }

    const cells: Array<{ x: number; y: number }> = [];
    let invalid = false;
    const pendingSquaresInRoom = (selectedSquares || [])
      .filter((pos) => pos.roomIndex === roomIndex)
      .map((pos) => ({ x: pos.x, y: pos.y }));

    for (let offset = 0; offset < cunningStepPreviewLength; offset++) {
      const x = hoveredSquare.x + offset;
      const y = hoveredSquare.y;
      const square = getSquareAt(x, y);
      if (!square || square.wall || square.checked) {
        invalid = true;
      }
      cells.push({ x, y });
    }

    if (!invalid) {
      const hasRequiredAdjacency = cells.some((cell) =>
        isAdjacentToEntranceOrCrossed(cell.x, cell.y, pendingSquaresInRoom)
      );
      if (!hasRequiredAdjacency) {
        invalid = true;
      }
    }

    return { cells, invalid };
  })();
  const cunningPreviewOverlayCells = cunningPreview.cells.filter(
    (pos) => pos.x >= 0 && pos.x < room.width && pos.y >= 0 && pos.y < room.height
  );
  const spreadOutPreviewCells = (() => {
    if (!spreadOutPreviewEnabled || !hoveredSquare) {
      return [] as Array<{
        x: number;
        y: number;
        inBounds: boolean;
        valid: boolean;
        isCenter: boolean;
      }>;
    }

    const cells: Array<{
      x: number;
      y: number;
      inBounds: boolean;
      valid: boolean;
      isCenter: boolean;
    }> = [];

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = hoveredSquare.x + dx;
        const y = hoveredSquare.y + dy;
        const inBounds = x >= 0 && x < room.width && y >= 0 && y < room.height;
        const square = getSquareAt(x, y);
        const valid = !!square && !square.wall && !square.checked;

        cells.push({
          x,
          y,
          inBounds,
          valid,
          isCenter: dx === 0 && dy === 0
        });
      }
    }

    return cells;
  })();

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

  const doorwayPlacements = (() => {
    const placements: DoorwayPlacement[] = [];
    const seen = new Set<string>();

    const addDoorway = (x: number, y: number, direction?: string) => {
      if (x < 0 || y < 0 || x >= room.width || y >= room.height) {
        return;
      }

      const doorwayDirection = asDoorwayDirection(direction) || inferEdgeDirection(x, y);
      if (!doorwayDirection) {
        return;
      }

      const key = `${x},${y},${doorwayDirection}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      placements.push({
        x,
        y,
        direction: doorwayDirection
      });
    };

    if (room.entranceX >= 0 && room.entranceY >= 0) {
      addDoorway(room.entranceX, room.entranceY, room.entranceDirection);
    }

    for (let i = 0; i < room.exitX.length; i++) {
      addDoorway(room.exitX[i], room.exitY[i], room.exitDirections[i]);
    }

    return placements;
  })();

  const renderDoorwayBorder = (doorway: DoorwayPlacement, index: number): JSX.Element[] => {
    const centerX = doorway.x * cellSizePx + cellSizePx / 2;
    const centerY = doorway.y * cellSizePx + cellSizePx / 2;
    const openingOffset = doorwayOpeningPx / 2;
    const openingKey = `door-opening-${index}-${doorway.direction}-${doorway.x}-${doorway.y}`;
    const frameKey = `door-frame-${index}-${doorway.direction}-${doorway.x}-${doorway.y}`;

    if (doorway.direction === 'north') {
      return [
        <div
          key={openingKey}
          style={{
            position: 'absolute',
            left: `${centerX - openingOffset}px`,
            top: `${-borderWidthPx}px`,
            width: `${doorwayOpeningPx}px`,
            height: `${borderWidthPx + 2}px`,
            backgroundColor: ROOM_DOORWAY_FILL_COLOR
          }}
        />,
        <div
          key={frameKey}
          style={{
            position: 'absolute',
            left: `${centerX - openingOffset}px`,
            top: `${-(doorwayDepthPx + borderWidthPx)}px`,
            width: `${doorwayOpeningPx}px`,
            height: `${doorwayDepthPx + borderWidthPx}px`,
            boxSizing: 'border-box',
            backgroundColor: ROOM_DOORWAY_FILL_COLOR,
            borderLeft: `${doorwayRailPx}px solid ${ROOM_BORDER_COLOR}`,
            borderRight: `${doorwayRailPx}px solid ${ROOM_BORDER_COLOR}`,
            borderTop: `${doorwayRailPx}px solid ${ROOM_BORDER_COLOR}`
          }}
        />
      ];
    }

    if (doorway.direction === 'south') {
      return [
        <div
          key={openingKey}
          style={{
            position: 'absolute',
            left: `${centerX - openingOffset}px`,
            top: `${gridHeightPx - 1}px`,
            width: `${doorwayOpeningPx}px`,
            height: `${borderWidthPx + 2}px`,
            backgroundColor: ROOM_DOORWAY_FILL_COLOR
          }}
        />,
        <div
          key={frameKey}
          style={{
            position: 'absolute',
            left: `${centerX - openingOffset}px`,
            top: `${gridHeightPx}px`,
            width: `${doorwayOpeningPx}px`,
            height: `${doorwayDepthPx + borderWidthPx}px`,
            boxSizing: 'border-box',
            backgroundColor: ROOM_DOORWAY_FILL_COLOR,
            borderLeft: `${doorwayRailPx}px solid ${ROOM_BORDER_COLOR}`,
            borderRight: `${doorwayRailPx}px solid ${ROOM_BORDER_COLOR}`,
            borderBottom: `${doorwayRailPx}px solid ${ROOM_BORDER_COLOR}`
          }}
        />
      ];
    }

    if (doorway.direction === 'west') {
      return [
        <div
          key={openingKey}
          style={{
            position: 'absolute',
            left: `${-borderWidthPx}px`,
            top: `${centerY - openingOffset}px`,
            width: `${borderWidthPx + 2}px`,
            height: `${doorwayOpeningPx}px`,
            backgroundColor: ROOM_DOORWAY_FILL_COLOR
          }}
        />,
        <div
          key={frameKey}
          style={{
            position: 'absolute',
            left: `${-(doorwayDepthPx + borderWidthPx)}px`,
            top: `${centerY - openingOffset}px`,
            width: `${doorwayDepthPx + borderWidthPx}px`,
            height: `${doorwayOpeningPx}px`,
            boxSizing: 'border-box',
            backgroundColor: ROOM_DOORWAY_FILL_COLOR,
            borderTop: `${doorwayRailPx}px solid ${ROOM_BORDER_COLOR}`,
            borderBottom: `${doorwayRailPx}px solid ${ROOM_BORDER_COLOR}`,
            borderLeft: `${doorwayRailPx}px solid ${ROOM_BORDER_COLOR}`
          }}
        />
      ];
    }

    return [
      <div
        key={openingKey}
        style={{
          position: 'absolute',
          left: `${gridWidthPx - 1}px`,
          top: `${centerY - openingOffset}px`,
          width: `${borderWidthPx + 2}px`,
          height: `${doorwayOpeningPx}px`,
          backgroundColor: ROOM_DOORWAY_FILL_COLOR
        }}
      />,
      <div
        key={frameKey}
        style={{
          position: 'absolute',
          left: `${gridWidthPx}px`,
          top: `${centerY - openingOffset}px`,
          width: `${doorwayDepthPx + borderWidthPx}px`,
          height: `${doorwayOpeningPx}px`,
          boxSizing: 'border-box',
          backgroundColor: ROOM_DOORWAY_FILL_COLOR,
          borderTop: `${doorwayRailPx}px solid ${ROOM_BORDER_COLOR}`,
          borderBottom: `${doorwayRailPx}px solid ${ROOM_BORDER_COLOR}`,
          borderRight: `${doorwayRailPx}px solid ${ROOM_BORDER_COLOR}`
        }}
      />
    ];
  };

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
                horizontalPairPreviewEnabled ||
                spreadOutPreviewEnabled ||
                !!cunningStepPreviewLength
                  ? (hoverX, hoverY) => setHoveredSquare({ x: hoverX, y: hoverY })
                  : undefined
              }
              onHoverEnd={
                horizontalPairPreviewEnabled ||
                spreadOutPreviewEnabled ||
                !!cunningStepPreviewLength
                  ? () => setHoveredSquare(null)
                  : undefined
              }
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
    <div className="relative" style={{ width: `${gridWidthPx}px`, height: `${gridHeightPx}px` }}>
      <div
        className="grid relative z-0"
        style={{
          gridTemplateColumns: `repeat(${room.width}, ${cellSizePx}px)`,
          gridTemplateRows: `repeat(${room.height}, ${cellSizePx}px)`,
        }}
      >
        {renderSquares()}
      </div>
      <div
        className="pointer-events-none absolute z-20"
        style={{
          left: 0,
          top: 0,
          width: `${gridWidthPx}px`,
          height: `${gridHeightPx}px`
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: `${-borderWidthPx}px`,
            top: `${-borderWidthPx}px`,
            width: `${extendedBorderWidthPx}px`,
            height: `${borderWidthPx}px`,
            backgroundColor: ROOM_BORDER_COLOR
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: `${-borderWidthPx}px`,
            top: `${gridHeightPx}px`,
            width: `${extendedBorderWidthPx}px`,
            height: `${borderWidthPx}px`,
            backgroundColor: ROOM_BORDER_COLOR
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: `${-borderWidthPx}px`,
            top: `${-borderWidthPx}px`,
            width: `${borderWidthPx}px`,
            height: `${extendedBorderHeightPx}px`,
            backgroundColor: ROOM_BORDER_COLOR
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: `${gridWidthPx}px`,
            top: `${-borderWidthPx}px`,
            width: `${borderWidthPx}px`,
            height: `${extendedBorderHeightPx}px`,
            backgroundColor: ROOM_BORDER_COLOR
          }}
        />
        {doorwayPlacements.flatMap((doorway, index) => renderDoorwayBorder(doorway, index))}
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
      {!!cunningStepPreviewLength && cunningPreviewOverlayCells.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-30">
          {cunningPreviewOverlayCells.map((cell) => (
            <div
              key={`cunning-preview-${cell.x}-${cell.y}`}
              className={`absolute border-2 ${
                cunningPreview.invalid
                  ? 'bg-red-500/45 border-red-300'
                  : 'bg-green-500/45 border-green-300'
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
      {spreadOutPreviewEnabled && spreadOutPreviewCells.length > 0 && (
        <div className="pointer-events-none absolute inset-0 z-30">
          {spreadOutPreviewCells
            .filter((cell) => cell.inBounds)
            .map((cell) => (
              <div
                key={`spread-out-preview-${cell.x}-${cell.y}`}
                className={`absolute border ${
                  cell.isCenter
                    ? cell.valid
                      ? 'bg-green-600/55 border-green-300'
                      : 'bg-red-500/35 border-dashed border-red-300/80'
                    : cell.valid
                      ? 'bg-green-300/45 border-dashed border-green-400'
                      : 'bg-stone-500/10 border-dashed border-stone-400/60'
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
