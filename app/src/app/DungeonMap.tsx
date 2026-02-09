import React, { useRef, useEffect, useState, useCallback } from 'react';
import Grid from './grid';
import { Room } from '@/types/Room';
import { Player } from '@/types/Player';
import { MonsterCard as MonsterCardType } from '@/types/MonsterCard';
import { DungeonState } from '@/types/DungeonState';
import MonsterBadge from './MonsterBadge';

interface DungeonMapProps {
  rooms: {
    room: Room;
    x: number;
    y: number;
  }[];
  handleSquareClick: (x: number, y: number, roomIndex?: number) => void;
  player: Player | null;
  colyseusRoom: any; // Colyseus room instance
  invalidSquareHighlight?: { roomIndex: number; x: number; y: number } | null;
  selectedSquares?: Array<{ roomIndex: number; x: number; y: number }>;
  gameState: DungeonState | null;
  onMonsterDragStart?: () => void;
  onMonsterDragEnd?: () => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
  bottomOverlayRef?: React.RefObject<HTMLElement>;
  horizontalPairPreviewEnabled?: boolean;
}

const ROOM_TILE_SIZE = 320;
const HALLWAY_LENGTH = 28;
const HALLWAY_THICKNESS = 24;
const BASE_CONTENT_PADDING = 200;
const ROOM_TILE_INNER_PADDING = 12;

const buildInterleavedTracks = (count: number, roomSizePx: number, hallwaySizePx: number): string => {
  const sizes: string[] = [];
  for (let i = 0; i < count; i++) {
    sizes.push(`${roomSizePx}px`);
    if (i < count - 1) sizes.push(`${hallwaySizePx}px`);
  }
  return sizes.join(' ');
};

const getDirectionDelta = (
  direction: string
): { dx: number; dy: number; orientation: 'horizontal' | 'vertical' } | null => {
  switch (direction) {
    case 'north':
      return { dx: 0, dy: -1, orientation: 'vertical' };
    case 'south':
      return { dx: 0, dy: 1, orientation: 'vertical' };
    case 'east':
      return { dx: 1, dy: 0, orientation: 'horizontal' };
    case 'west':
      return { dx: -1, dy: 0, orientation: 'horizontal' };
    default:
      return null;
  }
};

const DungeonMap: React.FC<DungeonMapProps> = ({
  rooms,
  handleSquareClick,
  player,
  invalidSquareHighlight,
  selectedSquares,
  gameState,
  onMonsterDragStart,
  onMonsterDragEnd,
  scrollContainerRef,
  bottomOverlayRef,
  horizontalPairPreviewEnabled = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const hasCenteredInitialRoom = useRef(false);

  const calculateBounds = () => {
    if (rooms.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    rooms.forEach(({ room }) => {
      minX = Math.min(minX, room.gridX);
      maxX = Math.max(maxX, room.gridX);
      minY = Math.min(minY, room.gridY);
      maxY = Math.max(maxY, room.gridY);
    });

    return { minX, maxX, minY, maxY };
  };

  const { minX, maxX, minY, maxY } = calculateBounds();

  const gridWidth = Math.max(1, maxX - minX + 1);
  const gridHeight = Math.max(1, maxY - minY + 1);

  const columnTracks = buildInterleavedTracks(gridWidth, ROOM_TILE_SIZE, HALLWAY_LENGTH);
  const rowTracks = buildInterleavedTracks(gridHeight, ROOM_TILE_SIZE, HALLWAY_LENGTH);

  const innerGridWidth =
    gridWidth * ROOM_TILE_SIZE + Math.max(0, gridWidth - 1) * HALLWAY_LENGTH;
  const innerGridHeight =
    gridHeight * ROOM_TILE_SIZE + Math.max(0, gridHeight - 1) * HALLWAY_LENGTH;

  // Use dynamic padding so the first room can be centered even when the dungeon is smaller
  // than the viewport (still scrollable/pannable).
  const contentPaddingX = Math.max(BASE_CONTENT_PADDING, Math.ceil(containerSize.width / 2));
  const contentPaddingY = Math.max(BASE_CONTENT_PADDING, Math.ceil(containerSize.height / 2));

  const contentWidth = innerGridWidth + contentPaddingX * 2;
  const contentHeight = innerGridHeight + contentPaddingY * 2;

  const getMonsterForRoom = useCallback(
    (roomIndex: number): MonsterCardType | null => {
      if (!gameState?.activeMonsters || !gameState?.displayedRoomIndices) return null;

      const actualRoomIndex = gameState.displayedRoomIndices[roomIndex];
      if (actualRoomIndex === undefined) return null;

      const monster = gameState.activeMonsters.find(
        (m) => m.connectedToRoomIndex === actualRoomIndex && m.playerOwnerId === ''
      );
      return monster || null;
    },
    [gameState]
  );

  const canPlayerDragMonster = (monster: MonsterCardType): boolean => {
    return monster.connectedToRoomIndex !== -1 && monster.playerOwnerId === '' && player !== null;
  };

  // Track viewport size (for initial centering + resize)
  useEffect(() => {
    const scrollContainer = scrollContainerRef?.current ?? containerRef.current?.parentElement ?? containerRef.current;
    if (!scrollContainer) return;

    const updateSize = () => {
      setContainerSize({
        width: scrollContainer?.clientWidth || 0,
        height: scrollContainer?.clientHeight || 0
      });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [scrollContainerRef]);

  // Center the first room in the viewport on initial display
  useEffect(() => {
    if (hasCenteredInitialRoom.current) return;
    if (rooms.length === 0) return;
    if (!containerRef.current) return;
    if (containerSize.width === 0 || containerSize.height === 0) return;

    const scrollContainer = scrollContainerRef?.current ?? containerRef.current.parentElement;
    if (!scrollContainer) return;
    if (bottomOverlayRef && !bottomOverlayRef.current) return;

    const viewportWidth = scrollContainer.clientWidth;
    const bottomOverlayHeight = bottomOverlayRef?.current?.offsetHeight ?? 0;
    const viewportHeight = Math.max(0, scrollContainer.clientHeight - bottomOverlayHeight);
    if (viewportWidth === 0 || viewportHeight === 0) return;

    const firstRoom = rooms[0].room;
    const normalizedX = firstRoom.gridX - minX;
    const normalizedY = firstRoom.gridY - minY;

    const centerX =
      contentPaddingX +
      normalizedX * (ROOM_TILE_SIZE + HALLWAY_LENGTH) +
      ROOM_TILE_SIZE / 2;
    const centerY =
      contentPaddingY +
      normalizedY * (ROOM_TILE_SIZE + HALLWAY_LENGTH) +
      ROOM_TILE_SIZE / 2;

    const targetLeft = centerX - viewportWidth / 2;
    const targetTop = centerY - viewportHeight / 2;

    const maxScrollLeft = Math.max(0, contentWidth - viewportWidth);
    const maxScrollTop = Math.max(0, contentHeight - scrollContainer.clientHeight);

    scrollContainer.scrollLeft = Math.min(Math.max(0, targetLeft), maxScrollLeft);
    scrollContainer.scrollTop = Math.min(Math.max(0, targetTop), maxScrollTop);

    hasCenteredInitialRoom.current = true;
	  }, [
	    rooms,
	    minX,
	    minY,
	    containerSize.width,
	    containerSize.height,
	    scrollContainerRef,
	    bottomOverlayRef,
	    contentPaddingX,
	    contentPaddingY,
	    contentWidth,
	    contentHeight
	  ]);

  const roomCoords = new Set<string>();
  rooms.forEach(({ room }) => {
    roomCoords.add(`${room.gridX},${room.gridY}`);
  });

  const renderHallways = () => {
    const hallways: React.ReactNode[] = [];

    rooms.forEach(({ room }) => {
      for (let exitIndex = 0; exitIndex < room.exitDirections.length; exitIndex++) {
        const direction = room.exitDirections[exitIndex];
        const isConnected = room.exitConnected?.[exitIndex];
        const connectedRoomIndex = room.connectedRoomIndices?.[exitIndex] ?? -1;

        // Only show hallways for connected exits.
        if (!isConnected || connectedRoomIndex < 0) continue;

        const delta = getDirectionDelta(direction);
        if (!delta) continue;

        const targetKey = `${room.gridX + delta.dx},${room.gridY + delta.dy}`;
        if (!roomCoords.has(targetKey)) continue;

        const normalizedX = room.gridX - minX;
        const normalizedY = room.gridY - minY;

        const roomCol = normalizedX * 2 + 1;
        const roomRow = normalizedY * 2 + 1;

        const hallwayCol = roomCol + delta.dx;
        const hallwayRow = roomRow + delta.dy;

        hallways.push(
          <div
            key={`hallway-${room.gridX},${room.gridY}-${exitIndex}`}
            data-testid={`hallway-${room.gridX}-${room.gridY}-${direction}`}
            className="relative flex items-center justify-center"
            style={{
              gridColumnStart: hallwayCol,
              gridRowStart: hallwayRow,
              zIndex: 1
            }}
          >
            <div
              className="bg-slate-700 border border-slate-600 rounded-md shadow-inner"
              style={
                delta.orientation === 'horizontal'
                  ? { width: '100%', height: `${HALLWAY_THICKNESS}px` }
                  : { width: `${HALLWAY_THICKNESS}px`, height: '100%' }
              }
            />
          </div>
        );
      }
    });

    return hallways;
  };

  return (
    <div ref={containerRef} className="min-w-full min-h-full bg-slate-900 relative">
      <div className="relative" style={{ width: `${contentWidth}px`, height: `${contentHeight}px` }}>
        <div
          className="absolute"
          style={{
            left: `${contentPaddingX}px`,
            top: `${contentPaddingY}px`,
            width: `${innerGridWidth}px`,
            height: `${innerGridHeight}px`,
            display: 'grid',
            gridTemplateColumns: columnTracks,
            gridTemplateRows: rowTracks
          }}
        >
          {renderHallways()}

          {rooms.map((roomData, index) => {
            const { room } = roomData;

            const normalizedX = room.gridX - minX;
            const normalizedY = room.gridY - minY;

            const gridColumnStart = normalizedX * 2 + 1;
            const gridRowStart = normalizedY * 2 + 1;

            const maxDim = Math.max(1, Math.max(room.width, room.height));
            const usableSize = ROOM_TILE_SIZE - ROOM_TILE_INNER_PADDING * 2;
            const cellSizePx = Math.max(1, Math.floor(usableSize / maxDim));

            const monster = getMonsterForRoom(index);

            return (
              <div
                key={`room-${index}`}
                data-testid={`room-tile-${room.gridX}-${room.gridY}`}
                className="relative border-2 border-slate-600 rounded-lg bg-slate-800 overflow-visible"
                style={{
                  width: `${ROOM_TILE_SIZE}px`,
                  height: `${ROOM_TILE_SIZE}px`,
                  gridColumnStart,
                  gridRowStart,
                  zIndex: 2
                }}
              >
                <div className="absolute top-1 left-2 text-[10px] text-slate-400 select-none pointer-events-none">
                  Room ({room.gridX}, {room.gridY})
                </div>

                {monster && (
                  <div className="absolute top-2 right-2 z-20">
                    <MonsterBadge
                      monster={monster}
                      canDrag={canPlayerDragMonster(monster)}
                      onDragStart={onMonsterDragStart}
                      onDragEnd={onMonsterDragEnd}
                    />
                  </div>
                )}

                <div className="w-full h-full flex items-center justify-center" style={{ padding: `${ROOM_TILE_INNER_PADDING}px` }}>
                  <Grid
                    room={room}
                    handleSquareClick={(x, y) => handleSquareClick(x, y, index)}
                    invalidSquareHighlight={
                      invalidSquareHighlight && invalidSquareHighlight.roomIndex === index
                        ? { x: invalidSquareHighlight.x, y: invalidSquareHighlight.y }
                        : null
                    }
                    selectedSquares={selectedSquares}
                    roomIndex={index}
                    cellSizePx={cellSizePx}
                    horizontalPairPreviewEnabled={horizontalPairPreviewEnabled}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DungeonMap;
