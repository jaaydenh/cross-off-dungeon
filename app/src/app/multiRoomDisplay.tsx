import React from 'react';
import Grid from './grid';
import { Room } from '@/types/Room';

interface MultiRoomDisplayProps {
  rooms: {
    room: Room;
    x: number;
    y: number;
  }[];
  currentRoomIndex: number;
  handleSquareClick: (x: number, y: number) => void;
}

const MultiRoomDisplay: React.FC<MultiRoomDisplayProps> = ({ 
  rooms, 
  currentRoomIndex,
  handleSquareClick 
}) => {
  // Calculate the bounds of the dungeon
  const calculateBounds = () => {
    if (rooms.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    
    rooms.forEach(({ x, y, room }) => {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });
    
    return { minX, maxX, minY, maxY };
  };
  
  const { minX, maxX, minY, maxY } = calculateBounds();
  
  // Calculate the size of the grid in cells
  const gridWidth = maxX - minX + 1;
  const gridHeight = maxY - minY + 1;
  
  // Calculate the maximum room dimensions to determine spacing
  const maxRoomWidth = Math.max(...rooms.map(r => r.room.width * 42));
  const maxRoomHeight = Math.max(...rooms.map(r => r.room.height * 42));
  
  // Add some spacing between rooms
  const roomSpacing = 50; // pixels
  
  return (
    <div 
      className="relative bg-gray-900 p-4 overflow-auto"
      style={{ 
        width: '100%',
        height: '80vh',
        maxWidth: '100%',
        position: 'relative'
      }}
    >
      {rooms.map((roomData, index) => {
        const { room, x, y } = roomData;
        
        // Calculate position relative to the grid
        const normalizedX = x - minX;
        const normalizedY = y - minY;
        
        // Calculate pixel position with spacing
        const posX = normalizedX * (maxRoomWidth + roomSpacing);
        const posY = normalizedY * (maxRoomHeight + roomSpacing);
        
        // Determine if this is the current room
        const isCurrentRoom = rooms.findIndex(r => 
          r.room === rooms[currentRoomIndex]?.room
        ) === index;
        
        return (
          <div 
            key={index}
            className={`absolute transition-all duration-300 ${isCurrentRoom ? 'border-2 border-yellow-400' : ''}`}
            style={{
              left: `${posX}px`,
              top: `${posY}px`,
              zIndex: isCurrentRoom ? 10 : 1,
            }}
          >
            <Grid 
              room={room} 
              handleSquareClick={handleSquareClick}
            />
            
            {/* Direction indicators */}
            {room.entranceDirection !== "none" && (
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-white font-bold">
                {room.entranceDirection === "north" && "⬇️"}
                {room.entranceDirection === "south" && "⬆️"}
                {room.entranceDirection === "east" && "⬅️"}
                {room.entranceDirection === "west" && "➡️"}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MultiRoomDisplay;

