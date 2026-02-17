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
  cunningStepPreviewLength?: 1 | 2 | 3 | null;
  spreadOutPreviewEnabled?: boolean;
}

const ROOM_TILE_SIZE = 320;
const HALLWAY_LENGTH = 28;
const HALLWAY_THICKNESS = 24;
const BASE_CONTENT_PADDING = 200;
const ROOM_TILE_INNER_PADDING = 12;
const ROOM_TITLE_SAFE_HEIGHT = 28;
const ROOM_TITLE_BADGE_GUTTER = 88;
const PENCIL_ROOM_TEXTURE =
  'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2728%27 height=%2728%27 viewBox=%270 0 28 28%27%3E%3Cg fill=%27%23000000%27 fill-opacity=%270.14%27%3E%3Ccircle cx=%274%27 cy=%276%27 r=%270.7%27/%3E%3Ccircle cx=%2713%27 cy=%275%27 r=%270.6%27/%3E%3Ccircle cx=%2722%27 cy=%279%27 r=%270.65%27/%3E%3Ccircle cx=%278%27 cy=%2717%27 r=%270.6%27/%3E%3Ccircle cx=%2718%27 cy=%2715%27 r=%270.7%27/%3E%3Ccircle cx=%2725%27 cy=%2722%27 r=%270.55%27/%3E%3Ccircle cx=%2710%27 cy=%2724%27 r=%270.65%27/%3E%3C/g%3E%3C/svg%3E")';

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

const ROOM_NAME_PREFIXES = [
  'Ancient',
  'Forgotten',
  'Moonlit',
  'Shadowed',
  'Runed',
  'Grim',
  'Gilded',
  'Dread',
  'Sunken',
  'Whispering',
  'Ember',
  'Iron',
  'Frostbound',
  'Stormcarved',
  'Twilight',
  'Bloodstone'
];

const ROOM_NAME_CORES = [
  'Crypt',
  'Sanctum',
  'Vault',
  'Keep',
  'Hollow',
  'Labyrinth',
  'Catacombs',
  'Bastion',
  'Chamber',
  'Hall',
  'Reliquary',
  'Warrens',
  'Cavern',
  'Citadel',
  'Grotto',
  'Archive'
];

const ROOM_NAME_SUFFIXES = [
  'of Echoes',
  'of Embers',
  'of Thorns',
  'of Night',
  'of Chains',
  'of Ash',
  'of Serpents',
  'of Bones',
  'of Lanterns',
  'of Ruin',
  'of Mists',
  'of Cinders',
  'of Wolves',
  'of Oaths',
  'of Sorrows',
  'of Kings'
];

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const getFantasyRoomName = (seed: string): string => {
  const prefix = ROOM_NAME_PREFIXES[hashString(`${seed}:prefix`) % ROOM_NAME_PREFIXES.length];
  const core = ROOM_NAME_CORES[hashString(`${seed}:core`) % ROOM_NAME_CORES.length];
  const suffix = ROOM_NAME_SUFFIXES[hashString(`${seed}:suffix`) % ROOM_NAME_SUFFIXES.length];
  return `${prefix} ${core} ${suffix}`;
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
  horizontalPairPreviewEnabled = false,
  cunningStepPreviewLength = null,
  spreadOutPreviewEnabled = false
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
              className="rounded-md"
              style={{
                ...(delta.orientation === 'horizontal'
                  ? { width: '100%', height: `${HALLWAY_THICKNESS}px` }
                  : { width: `${HALLWAY_THICKNESS}px`, height: '100%' }),
                backgroundColor: '#d9d1c0',
                backgroundImage: PENCIL_ROOM_TEXTURE,
                backgroundSize: '24px 24px',
                border: '1px solid rgba(0, 0, 0, 0.75)',
                boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.08)'
              }}
            />
          </div>
        );
      }
    });

    return hallways;
  };

  return (
    <div
      ref={containerRef}
      className="min-w-full min-h-full relative pencil-map-surface"
    >
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
            const roomSeed = `${room.gridX},${room.gridY}:${gameState?.displayedRoomIndices?.[index] ?? index}`;
            const roomTitle = getFantasyRoomName(roomSeed);

            const normalizedX = room.gridX - minX;
            const normalizedY = room.gridY - minY;

            const gridColumnStart = normalizedX * 2 + 1;
            const gridRowStart = normalizedY * 2 + 1;

            const gridAvailableWidth = ROOM_TILE_SIZE - ROOM_TILE_INNER_PADDING * 2;
            const gridAvailableHeight =
              ROOM_TILE_SIZE - ROOM_TILE_INNER_PADDING * 2 - ROOM_TITLE_SAFE_HEIGHT;
            const cellSizePx = Math.max(
              1,
              Math.floor(
                Math.min(
                  gridAvailableWidth / Math.max(1, room.width),
                  gridAvailableHeight / Math.max(1, room.height)
                )
              )
            );

            const monster = getMonsterForRoom(index);

            return (
              <div
                key={`room-${index}`}
                data-testid={`room-tile-${room.gridX}-${room.gridY}`}
                className="relative border-2 border-black rounded-lg overflow-visible"
                style={{
                  width: `${ROOM_TILE_SIZE}px`,
                  height: `${ROOM_TILE_SIZE}px`,
                  gridColumnStart,
                  gridRowStart,
                  zIndex: 2,
                  backgroundColor: '#e2dac9',
                  backgroundImage: PENCIL_ROOM_TEXTURE,
                  backgroundSize: '28px 28px',
                  boxShadow:
                    'inset 0 0 0 1px rgba(0, 0, 0, 0.08), 0 4px 0 rgba(0, 0, 0, 0.32)'
                }}
              >
                <div
                  className="absolute top-2 left-2 text-xs text-black select-none pointer-events-none whitespace-nowrap overflow-hidden text-ellipsis"
                  style={{ right: `${ROOM_TITLE_BADGE_GUTTER}px` }}
                  title={roomTitle}
                >
                  {roomTitle}
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

                <div
                  className="w-full h-full flex items-start justify-center"
                  style={{
                    paddingLeft: `${ROOM_TILE_INNER_PADDING}px`,
                    paddingRight: `${ROOM_TILE_INNER_PADDING}px`,
                    paddingBottom: `${ROOM_TILE_INNER_PADDING}px`,
                    paddingTop: `${ROOM_TILE_INNER_PADDING + ROOM_TITLE_SAFE_HEIGHT}px`
                  }}
                >
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
                    cunningStepPreviewLength={cunningStepPreviewLength}
                    spreadOutPreviewEnabled={spreadOutPreviewEnabled}
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
