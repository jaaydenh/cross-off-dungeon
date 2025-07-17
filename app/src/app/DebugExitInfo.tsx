import React from 'react';
import { Room } from '@/types/Room';

interface DebugExitInfoProps {
  room: Room;
}

const DebugExitInfo: React.FC<DebugExitInfoProps> = ({ room }) => {
  // Helper function to get square at coordinates
  const getSquareAt = (x: number, y: number) => {
    if (x < 0 || x >= room.width || y < 0 || y >= room.height) {
      return undefined;
    }
    return room.squares[y * room.width + x];
  };

  // Find adjacent crossed squares for debugging
  const findAdjacentCrossedSquares = (x: number, y: number) => {
    const adjacentCrossedSquares: { x: number; y: number; square: any }[] = [];
    
    const directions = [
      { dx: 0, dy: -1, name: 'North' },
      { dx: 1, dy: 0, name: 'East' },
      { dx: 0, dy: 1, name: 'South' },
      { dx: -1, dy: 0, name: 'West' }
    ];

    for (const direction of directions) {
      const adjacentX = x + direction.dx;
      const adjacentY = y + direction.dy;

      if (adjacentX >= 0 && adjacentX < room.width && adjacentY >= 0 && adjacentY < room.height) {
        const adjacentSquare = getSquareAt(adjacentX, adjacentY);
        
        adjacentCrossedSquares.push({
          x: adjacentX,
          y: adjacentY,
          square: adjacentSquare,
          direction: direction.name,
          checked: adjacentSquare?.checked || false
        } as any);
      }
    }

    return adjacentCrossedSquares;
  };

  // Find all squares marked as exits in the grid
  const findSquareBasedExits = () => {
    const squareExits: { x: number; y: number; square: any }[] = [];
    
    for (let y = 0; y < room.height; y++) {
      for (let x = 0; x < room.width; x++) {
        const square = getSquareAt(x, y);
        if (square && square.exit) {
          squareExits.push({ x, y, square });
        }
      }
    }
    
    return squareExits;
  };

  const squareBasedExits = findSquareBasedExits();

  return (
    <div className="bg-slate-800 p-4 rounded-lg text-white text-sm max-h-96 overflow-y-auto">
      <h3 className="text-lg font-bold mb-3">Exit Debug Info</h3>
      
      {/* Show coordinate-based exits (from room.exitX/exitY arrays) */}
      <div className="mb-4">
        <h4 className="font-semibold text-yellow-300 mb-2">Coordinate-Based Exits (room.exitX/exitY):</h4>
        {room.exitX.length === 0 ? (
          <div className="text-red-400">No exits found in coordinate arrays!</div>
        ) : (
          room.exitX.map((exitX, i) => {
        const exitY = room.exitY[i];
        const adjacentSquares = findAdjacentCrossedSquares(exitX, exitY);
        const crossedAdjacent = adjacentSquares.filter(sq => sq.checked);
        const isNavigable = crossedAdjacent.length > 0;
        const isConnected = room.exitConnected[i] || false;
        
        return (
          <div key={i} className="mb-4 p-3 bg-slate-700 rounded">
            <div className="font-semibold">
              Exit {i} at ({exitX}, {exitY}) - Direction: {room.exitDirections[i]}
            </div>
            <div className="mt-1">
              <span className={`px-2 py-1 rounded text-xs ${isNavigable ? 'bg-green-600' : 'bg-red-600'}`}>
                {isNavigable ? 'NAVIGABLE' : 'BLOCKED'}
              </span>
              <span className={`ml-2 px-2 py-1 rounded text-xs ${isConnected ? 'bg-blue-600' : 'bg-gray-600'}`}>
                {isConnected ? 'CONNECTED' : 'UNCONNECTED'}
              </span>
            </div>
            
            <div className="mt-2">
              <div className="text-xs text-gray-300">Adjacent Squares:</div>
              {adjacentSquares.map((adj, idx) => (
                <div key={idx} className="text-xs ml-2">
                  {adj.direction}: ({adj.x}, {adj.y}) - 
                  <span className={adj.checked ? 'text-green-400' : 'text-red-400'}>
                    {adj.checked ? ' CROSSED (X)' : ' EMPTY'}
                  </span>
                  {adj.square?.wall && <span className="text-yellow-400"> [WALL]</span>}
                  {adj.square?.entrance && <span className="text-green-400"> [ENTRANCE]</span>}
                  {adj.square?.exit && <span className="text-blue-400"> [EXIT]</span>}
                </div>
              ))}
            </div>
            
            <div className="mt-2 text-xs">
              Crossed Adjacent Count: {crossedAdjacent.length}
            </div>
          </div>
        );
      }))}
      </div>

      {/* Show square-based exits (squares with exit=true) */}
      <div className="mb-4">
        <h4 className="font-semibold text-green-300 mb-2">Square-Based Exits (square.exit=true):</h4>
        {squareBasedExits.length === 0 ? (
          <div className="text-red-400">No squares found with exit=true!</div>
        ) : (
          squareBasedExits.map((exitSquare, i) => {
            const adjacentSquares = findAdjacentCrossedSquares(exitSquare.x, exitSquare.y);
            const crossedAdjacent = adjacentSquares.filter(sq => sq.checked);
            const isNavigable = crossedAdjacent.length > 0;
            
            return (
              <div key={i} className="mb-3 p-2 bg-slate-600 rounded">
                <div className="font-semibold">
                  Square Exit at ({exitSquare.x}, {exitSquare.y})
                </div>
                <div className="mt-1">
                  <span className={`px-2 py-1 rounded text-xs ${isNavigable ? 'bg-green-600' : 'bg-red-600'}`}>
                    {isNavigable ? 'NAVIGABLE' : 'BLOCKED'}
                  </span>
                </div>
                
                <div className="mt-2">
                  <div className="text-xs text-gray-300">Adjacent Squares:</div>
                  {adjacentSquares.map((adj, idx) => (
                    <div key={idx} className="text-xs ml-2">
                      {adj.direction}: ({adj.x}, {adj.y}) - 
                      <span className={adj.checked ? 'text-green-400' : 'text-red-400'}>
                        {adj.checked ? ' CROSSED (X)' : ' EMPTY'}
                      </span>
                      {adj.square?.wall && <span className="text-yellow-400"> [WALL]</span>}
                      {adj.square?.entrance && <span className="text-green-400"> [ENTRANCE]</span>}
                      {adj.square?.exit && <span className="text-blue-400"> [EXIT]</span>}
                    </div>
                  ))}
                </div>
                
                <div className="mt-2 text-xs">
                  Crossed Adjacent Count: {crossedAdjacent.length}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Show comparison summary */}
      <div className="mt-4 p-3 bg-slate-900 rounded">
        <h4 className="font-semibold text-red-300 mb-2">Summary:</h4>
        <div className="text-xs">
          <div>Coordinate-based exits: {room.exitX.length}</div>
          <div>Square-based exits: {squareBasedExits.length}</div>
          {room.exitX.length !== squareBasedExits.length && (
            <div className="text-red-400 font-bold mt-1">
              ⚠️ MISMATCH: Different number of exits detected!
            </div>
          )}
        </div>
        
        {/* Show which exits are missing from coordinate arrays */}
        {squareBasedExits.length > room.exitX.length && (
          <div className="mt-3">
            <h5 className="font-semibold text-orange-300 mb-1">Missing from Coordinate Arrays:</h5>
            {squareBasedExits.map((squareExit, i) => {
              // Check if this square exit exists in coordinate arrays
              const existsInCoordinates = room.exitX.some((exitX, j) => 
                exitX === squareExit.x && room.exitY[j] === squareExit.y
              );
              
              if (!existsInCoordinates) {
                return (
                  <div key={i} className="text-xs text-orange-400 ml-2">
                    • Exit at ({squareExit.x}, {squareExit.y}) - Missing from navigation data
                  </div>
                );
              }
              return null;
            })}
            
            {/* Temporary Fix Button */}
            <button
              onClick={() => {
                // Client-side workaround: sync missing exits to coordinate arrays
                squareBasedExits.forEach((squareExit) => {
                  const existsInCoordinates = room.exitX.some((exitX, j) => 
                    exitX === squareExit.x && room.exitY[j] === squareExit.y
                  );
                  
                  if (!existsInCoordinates) {
                    // Add missing exit to coordinate arrays
                    room.exitX.push(squareExit.x);
                    room.exitY.push(squareExit.y);
                    room.exitDirections.push('unknown'); // Default direction
                    room.connectedRoomIndices.push(-1);
                    room.exitConnected.push(false);
                    console.log(`Fixed missing exit at (${squareExit.x}, ${squareExit.y})`);
                  }
                });
                
                // Force re-render
                window.location.reload();
              }}
              className="mt-2 px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded"
            >
              🔧 Fix Missing Exits (Temporary)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugExitInfo;