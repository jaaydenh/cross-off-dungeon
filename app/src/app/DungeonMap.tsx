import React, { useRef, useEffect, useState } from 'react';
import Grid from './grid';
import { Room } from '@/types/Room';
import { Player } from '@/types/Player';

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
  selectedSquares
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [showDebug, setShowDebug] = useState(false);

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

  // Fixed room dimensions for consistent grid layout (Requirement 5.5)
  const ROOM_WIDTH = 350;  // Fixed width for all rooms
  const ROOM_HEIGHT = 310; // Fixed height for all rooms

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

  // Calculate total dimensions needed for all rooms plus padding
  const totalWidth = gridWidth * (ROOM_WIDTH + roomSpacing) + contentPadding.left + contentPadding.right;
  const totalHeight = gridHeight * (ROOM_HEIGHT + roomSpacing) + contentPadding.top + contentPadding.bottom;

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

          const fromPosX = fromNormalizedX * (ROOM_WIDTH + roomSpacing) + contentPadding.left + ROOM_WIDTH / 2;
          const fromPosY = fromNormalizedY * (ROOM_HEIGHT + roomSpacing) + contentPadding.top + ROOM_HEIGHT / 2;
          const toPosX = toNormalizedX * (ROOM_WIDTH + roomSpacing) + contentPadding.left + ROOM_WIDTH / 2;
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

          // Calculate pixel position with consistent spacing
          const posX = normalizedX * (ROOM_WIDTH + roomSpacing) + contentPadding.left;
          const posY = normalizedY * (ROOM_HEIGHT + roomSpacing) + contentPadding.top;


          return (
            <div
              key={`room-${index}`}
              className="absolute border-2 border-slate-600 rounded-lg bg-slate-800 flex flex-col"
              style={{
                left: `${posX}px`,
                top: `${posY}px`,
                width: `${ROOM_WIDTH}px`,
                height: `${ROOM_HEIGHT}px`,
                zIndex: 2,
              }}
            >
              <div className="text-xs text-slate-400 p-2 text-center">
                Room ({room.gridX}, {room.gridY})
              </div>
              <div className="flex-1 flex items-center justify-center">
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
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DungeonMap; 