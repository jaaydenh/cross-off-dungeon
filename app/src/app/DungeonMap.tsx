import React, { useRef, useEffect, useState } from 'react';
import Grid from './grid';
import { Room } from '@/types/Room';

interface DungeonMapProps {
  rooms: {
    room: Room;
    x: number;
    y: number;
  }[];
  handleSquareClick: (x: number, y: number, roomIndex?: number) => void;
}

const DungeonMap: React.FC<DungeonMapProps> = ({ 
  rooms, 
  handleSquareClick 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  
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
  const maxRoomWidth = Math.max(...rooms.map(r => r.room.width * 42), 100);
  const maxRoomHeight = Math.max(...rooms.map(r => r.room.height * 42), 100);
  
  // Add spacing between rooms
  const roomSpacing = 30; // pixels
  
  // Calculate the total width and height needed for all rooms
  const totalWidth = gridWidth * (maxRoomWidth + roomSpacing);
  const totalHeight = gridHeight * (maxRoomHeight + roomSpacing);
  
  // Ensure the content area is large enough for all rooms
  const contentWidth = Math.max(totalWidth, 800); // Minimum width to ensure scrolling works
  const contentHeight = Math.max(totalHeight, 600);
  
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
  
  // Calculate centering offsets for the initial room
  const centeringOffsetX = containerSize.width ? 
    (containerSize.width - maxRoomWidth) / 2 : 
    (700 - maxRoomWidth) / 2; // Fallback to container width specified in className
  
  const centeringOffsetY = containerSize.height ? 
    (containerSize.height - maxRoomHeight) / 2 : 
    (700 - maxRoomHeight) / 2;
  
  return (
    <div 
      ref={containerRef}
      className="relative bg-gray-900 p-4 overflow-auto h-[700px] w-[700px] overscroll-none"
    >
      <div 
        className="relative"
        style={{
          width: `${contentWidth}px`,
          height: `${contentHeight}px`,
        }}
      >
        {rooms.map((roomData, index) => {
          const { room, x, y } = roomData;
          
          // Calculate position relative to the grid
          const normalizedX = x - minX;
          const normalizedY = y - minY;
          
          // Calculate pixel position with spacing and centering offset
          const posX = normalizedX * (maxRoomWidth + roomSpacing) + centeringOffsetX;
          const posY = normalizedY * (maxRoomHeight + roomSpacing) + centeringOffsetY;
          
          return (
            <div 
              key={index}
              className="absolute transition duration-300"
              style={{
                left: `${posX}px`,
                top: `${posY}px`,
              }}
            >
              <Grid 
                room={room} 
                handleSquareClick={(x, y) => handleSquareClick(x, y, index)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DungeonMap; 