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
  
  // Add more spacing between rooms for better visibility
  const roomSpacing = 20;
  
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
  const totalWidth = gridWidth * (maxRoomWidth + roomSpacing) + contentPadding.left + contentPadding.right;
  const totalHeight = gridHeight * (maxRoomHeight + roomSpacing) + contentPadding.top + contentPadding.bottom;
  
  // Get the center of the displayed area for initial positioning
  const centerX = (contentPadding.left + (containerSize.width ? 
    Math.max((containerSize.width - maxRoomWidth) / 2, 0) : 0));
  
  const centerY = (contentPadding.top + (containerSize.height ? 
    Math.max((containerSize.height - maxRoomHeight) / 2, 0) : 0));
  
  
  return (
    <div 
      ref={containerRef}
      className="w-full h-full bg-slate-900"
    >
      <div 
        className="relative"
        style={{
          width: `${totalWidth}px`,
          height: `${totalHeight}px`,
        }}
      >
        {rooms.map((roomData, index) => {
          const { room, x, y } = roomData;
          
          // Calculate position relative to the grid
          const normalizedX = x - minX;
          const normalizedY = y - minY;
          
          // Calculate pixel position with spacing
          const posX = normalizedX * (maxRoomWidth + roomSpacing) + contentPadding.left;
          const posY = normalizedY * (maxRoomHeight + roomSpacing) + contentPadding.top;
          
          return (
            <div 
              key={index}
              className="absolute"
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