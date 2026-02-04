import React, { useRef, useEffect, useState, useCallback } from 'react';
import Grid from './grid';
import { Room } from '@/types/Room';
import { Player } from '@/types/Player';
import { MonsterCard as MonsterCardType } from '@/types/MonsterCard';
import { DungeonState } from '@/types/DungeonState';
import MonsterCard from './MonsterCard';

interface DungeonMapProps {
  rooms: {
    room: Room;
    x: number;
    y: number;
  }[];
  handleSquareClick: (x: number, y: number, roomIndex?: number) => void;
  player: Player | null;
  colyseusRoom: any; // Colyseus room instance
  invalidSquareHighlight?: {roomIndex: number, x: number, y: number} | null;
  selectedSquares?: Array<{roomIndex: number, x: number, y: number}>;
  gameState: DungeonState | null;
  onMonsterDragStart?: () => void;
  onMonsterDragEnd?: () => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
  bottomOverlayRef?: React.RefObject<HTMLElement>;
}

interface GridConnection {
  fromRoom: number;
  toRoom: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  direction: string;
}

const DungeonMap: React.FC<DungeonMapProps> = ({
  rooms,
  handleSquareClick,
  player,
  colyseusRoom,
  invalidSquareHighlight,
  selectedSquares,
  gameState,
  onMonsterDragStart,
  onMonsterDragEnd,
  scrollContainerRef,
  bottomOverlayRef
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [showDebug, setShowDebug] = useState(false);
  const hasCenteredInitialRoom = useRef(false);

  // Calculate the bounds of the dungeon using actual grid coordinates from Room schema
  const calculateBounds = () => {
    if (rooms.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    rooms.forEach(({ room }) => {
      // Use actual grid coordinates from the Room schema
      const gridX = room.gridX;
      const gridY = room.gridY;

      minX = Math.min(minX, gridX);
      maxX = Math.max(maxX, gridX);
      minY = Math.min(minY, gridY);
      maxY = Math.max(maxY, gridY);
    });

    return { minX, maxX, minY, maxY };
  };

  const { minX, maxX, minY, maxY } = calculateBounds();

  // Calculate the size of the grid in cells
  const gridWidth = maxX - minX + 1;
  const gridHeight = maxY - minY + 1;

  // Dynamic room dimensions to fit content
  const ROOM_HEIGHT = 310; // Fixed height for all rooms
  
  // Function to calculate room width based on content
  const calculateRoomWidth = (room: Room, monster?: MonsterCardType | null): number => {
    // Base room grid width: room.width * 42px (40px squares + 2px margin)
    const roomGridWidth = room.width * 42;
    
    // Monster card width if present
    let monsterWidth = 0;
    if (monster) {
      // In-room monster cards are scaled down without shrinking text.
      const monsterScale = 0.7;
      const squareSize = Math.round(40 * monsterScale);
      const gridCellSize = squareSize + 2;
      const monsterGridWidth = monster.width * gridCellSize;
      const gridPadding = Math.round(4 * monsterScale);
      const gridBorder = 2; // 1px each side
      const cardPadding = Math.round(12 * monsterScale);
      const cardBorder = 4; // border-2
      const headerWidth = 150; // typical header content width
      const minCardWidth = Math.max(120, Math.round(200 * monsterScale));
      
      const contentWidth = Math.max(monsterGridWidth + gridPadding * 2 + gridBorder, headerWidth);
      const fullCardWidth = Math.max(minCardWidth, contentWidth + cardPadding * 2 + cardBorder);
      monsterWidth = Math.ceil(fullCardWidth) + 8; // Safety margin
    }
    
    // Total width: room grid + gap + monster + container padding
    const gap = monster ? 12 : 0; // gap-3 = 12px
    const containerPadding = 16; // p-2 = 8px each side
    
    return roomGridWidth + gap + monsterWidth + containerPadding;
  };

  // Add spacing between rooms for better visibility
  const roomSpacing = 60;

  // Significantly increased padding to ensure rooms can be scrolled into view
  const contentPadding = {
    top: 300,
    right: 300,
    bottom: 500, // Extra padding at bottom for rooms below starting point
    left: 300
  };

  // Update container size on resize
  useEffect(() => {
    if (containerRef.current) {
      const updateSize = () => {
        setContainerSize({
          width: containerRef.current?.clientWidth || 0,
          height: containerRef.current?.clientHeight || 0
        });
      };

      updateSize();
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
    }
  }, []);

  // Use a reasonable default maximum width for layout calculation
  // Individual rooms will size themselves dynamically
  const DEFAULT_MAX_ROOM_WIDTH = 600;
  
  // Calculate total dimensions needed for all rooms plus padding
  const totalWidth = gridWidth * (DEFAULT_MAX_ROOM_WIDTH + roomSpacing) + contentPadding.left + contentPadding.right;
  const totalHeight = gridHeight * (ROOM_HEIGHT + roomSpacing) + contentPadding.top + contentPadding.bottom;

  const getMonsterForRoom = useCallback((roomIndex: number): MonsterCardType | null => {
    if (!gameState?.activeMonsters) return null;

    // Find the actual room index in the displayed rooms
    const actualRoomIndex = gameState.displayedRoomIndices[roomIndex];

    const monster = gameState.activeMonsters.find(monster =>
      monster.connectedToRoomIndex === actualRoomIndex && monster.playerOwnerId === ""
    );

    return monster || null;
  }, [gameState]);

  // Center the first room in the viewport on initial display
  useEffect(() => {
    if (hasCenteredInitialRoom.current) return;
    if (rooms.length === 0) return;
    if (!containerRef.current) return;

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
    const firstMonster = getMonsterForRoom(0);
    const roomWidth = calculateRoomWidth(firstRoom, firstMonster);

    const posX = normalizedX * (DEFAULT_MAX_ROOM_WIDTH + roomSpacing) + contentPadding.left;
    const posY = normalizedY * (ROOM_HEIGHT + roomSpacing) + contentPadding.top;

    const targetLeft = posX + roomWidth / 2 - viewportWidth / 2;
    const targetTop = posY + ROOM_HEIGHT / 2 - viewportHeight / 2;

    const maxScrollLeft = Math.max(0, scrollContainer.scrollWidth - scrollContainer.clientWidth);
    const maxScrollTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);

    scrollContainer.scrollLeft = Math.min(Math.max(0, targetLeft), maxScrollLeft);
    scrollContainer.scrollTop = Math.min(Math.max(0, targetTop), maxScrollTop);

    hasCenteredInitialRoom.current = true;
  }, [
    rooms,
    minX,
    minY,
    contentPadding.left,
    contentPadding.top,
    containerSize.width,
    containerSize.height,
    scrollContainerRef,
    bottomOverlayRef,
    getMonsterForRoom,
    gameState
  ]);

  // Detect connections between rooms with aligned exits
  const detectConnections = (): GridConnection[] => {
    const connections: GridConnection[] = [];

    rooms.forEach((roomData, fromIndex) => {
      const { room: fromRoom } = roomData;

      // Check each exit of this room
      for (let exitIndex = 0; exitIndex < fromRoom.exitDirections.length; exitIndex++) {
        const exitDirection = fromRoom.exitDirections[exitIndex];
        const connectedRoomIndex = fromRoom.connectedRoomIndices[exitIndex];
        const isConnected = fromRoom.exitConnected[exitIndex];

        // Only show connections for connected exits
        if (isConnected && connectedRoomIndex >= 0) {
          // Find the connected room in our displayed rooms by matching the room's global index
          // connectedRoomIndex is the global room index from the server, not the displayed rooms array index
          let toRoomData = null;
          let toIndex = -1;

          for (let i = 0; i < rooms.length; i++) {
            // We need to check if this displayed room corresponds to the connected room
            // Since we don't have direct access to the global room index, we need to find it by grid coordinates
            // or other identifying properties. For now, let's check if this room has a reverse connection
            const candidateRoom = rooms[i].room;

            // Check if this candidate room has an exit that connects back to our fromRoom
            for (let candidateExitIndex = 0; candidateExitIndex < candidateRoom.connectedRoomIndices.length; candidateExitIndex++) {
              if (candidateRoom.exitConnected[candidateExitIndex] &&
                candidateRoom.connectedRoomIndices[candidateExitIndex] >= 0) {

                // Check if the grid coordinates match what we expect for the connection direction
                const expectedToX = exitDirection === 'east' ? fromRoom.gridX + 1 :
                  exitDirection === 'west' ? fromRoom.gridX - 1 : fromRoom.gridX;
                const expectedToY = exitDirection === 'north' ? fromRoom.gridY - 1 :
                  exitDirection === 'south' ? fromRoom.gridY + 1 : fromRoom.gridY;

                if (candidateRoom.gridX === expectedToX && candidateRoom.gridY === expectedToY) {
                  toRoomData = rooms[i];
                  toIndex = i;
                  break;
                }
              }
            }
            if (toRoomData) break;
          }

          if (toRoomData && toIndex >= 0) {
            connections.push({
              fromRoom: fromIndex,
              toRoom: toIndex,
              fromX: fromRoom.gridX,
              fromY: fromRoom.gridY,
              toX: toRoomData.room.gridX,
              toY: toRoomData.room.gridY,
              direction: exitDirection
            });
          }
        }
      }
    });

    return connections;
  };

  const connections = detectConnections();

  // Monster helper functions
  const handleMonsterSquareClick = (monsterId: string, x: number, y: number) => {
    if (!colyseusRoom) return;
    colyseusRoom.send('crossMonsterSquare', { monsterId, x, y });
  };

  const canPlayerDragMonster = (monster: MonsterCardType): boolean => {
    return monster.connectedToRoomIndex !== -1 && 
           monster.playerOwnerId === "" && 
           player !== null;
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-slate-900 relative"
    >
      <div
        className="relative"
        style={{
          width: `${totalWidth}px`,
          height: `${totalHeight}px`,
        }}
      >
        {/* Render connection lines between rooms */}
        {connections.map((connection, index) => {
          const fromRoom = rooms[connection.fromRoom];
          const toRoom = rooms[connection.toRoom];

          if (!fromRoom || !toRoom) return null;

          // Calculate positions using actual grid coordinates
          const fromNormalizedX = fromRoom.room.gridX - minX;
          const fromNormalizedY = fromRoom.room.gridY - minY;
          const toNormalizedX = toRoom.room.gridX - minX;
          const toNormalizedY = toRoom.room.gridY - minY;

          const fromPosX = fromNormalizedX * (DEFAULT_MAX_ROOM_WIDTH + roomSpacing) + contentPadding.left + DEFAULT_MAX_ROOM_WIDTH / 2;
          const fromPosY = fromNormalizedY * (ROOM_HEIGHT + roomSpacing) + contentPadding.top + ROOM_HEIGHT / 2;
          const toPosX = toNormalizedX * (DEFAULT_MAX_ROOM_WIDTH + roomSpacing) + contentPadding.left + DEFAULT_MAX_ROOM_WIDTH / 2;
          const toPosY = toNormalizedY * (ROOM_HEIGHT + roomSpacing) + contentPadding.top + ROOM_HEIGHT / 2;

          // Calculate line properties
          const deltaX = toPosX - fromPosX;
          const deltaY = toPosY - fromPosY;
          const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

          return (
            <div
              key={`connection-${index}`}
              className="absolute bg-green-400 opacity-60"
              style={{
                left: `${fromPosX}px`,
                top: `${fromPosY - 2}px`,
                width: `${length}px`,
                height: '4px',
                transformOrigin: '0 50%',
                transform: `rotate(${angle}deg)`,
                zIndex: 1,
              }}
            />
          );
        })}

        {/* Render rooms using actual grid coordinates */}
        {rooms.map((roomData, index) => {
          const { room } = roomData;

          // Use actual grid coordinates from the Room schema
          const normalizedX = room.gridX - minX;
          const normalizedY = room.gridY - minY;

          // Calculate pixel position with consistent spacing (using default width for positioning)
          const posX = normalizedX * (DEFAULT_MAX_ROOM_WIDTH + roomSpacing) + contentPadding.left;
          const posY = normalizedY * (ROOM_HEIGHT + roomSpacing) + contentPadding.top;

          // Get monster for this room
          const monster = getMonsterForRoom(index);
          
          // Calculate dynamic width for this specific room
          const roomWidth = calculateRoomWidth(room, monster);

          return (
            <div
              key={`room-${index}`}
              className="absolute border-2 border-slate-600 rounded-lg bg-slate-800 flex flex-col"
              style={{
                left: `${posX}px`,
                top: `${posY}px`,
                width: `${roomWidth}px`,
                height: `${ROOM_HEIGHT}px`,
                zIndex: 2,
              }}
            >
              <div className="text-xs text-slate-400 p-2 text-center">
                Room ({room.gridX}, {room.gridY})
              </div>
              
              {/* Room content area with grid and monster side by side */}
              <div className="flex-1 flex items-start justify-center p-2 gap-3">
                {/* Room Grid */}
                <div className="flex items-center justify-center">
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
                  />
                </div>
                
                {/* Monster Card */}
                {monster && (
                  <div className="flex items-start">
                    <MonsterCard
                      monster={monster}
                      isOwnedByPlayer={false}
                      canDrag={canPlayerDragMonster(monster)}
                      onDragStart={onMonsterDragStart}
                      onDragEnd={onMonsterDragEnd}
                      className="monster-in-room"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DungeonMap; 
