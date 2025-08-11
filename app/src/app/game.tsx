'use client';
// @ts-nocheck

import * as Colyseus from 'colyseus.js';

import { useEffect, useState, useRef } from 'react';
import { Room } from 'colyseus.js';
import { DungeonState } from '@/types/DungeonState';
import { Player } from '@/types/Player';
import { Room as DungeonRoom } from '@/types/Room';
import DungeonMap from './DungeonMap';
import CardDeck from './CardDeck';
import DrawnCard from './DrawnCard';
import DiscardPile from './DiscardPile';
import TurnControls from './TurnControls';
import CancelButton from './CancelButton';
import ConfirmMoveButton from './ConfirmMoveButton';

export const dynamic = 'force-dynamic';

interface DungeonRoomState extends DungeonState { }

export default function Game() {
  const [name, setName] = useState('');
  const [inRoom, setInRoom] = useState(false);
  const [players, setPlayers] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [currentRoom, setCurrentRoom] = useState<DungeonRoom | null>(null);
  const [displayedRooms, setDisplayedRooms] = useState<{ room: DungeonRoom, x: number, y: number }[]>([]);
  const [gameState, setGameState] = useState<DungeonState | null>(null);
  // Add a state update counter to force re-renders
  const [updateCounter, setUpdateCounter] = useState(0);

  // Card-based square selection state
  const [selectedSquares, setSelectedSquares] = useState<Array<{ roomIndex: number, x: number, y: number }>>([]);
  const [invalidSquareHighlight, setInvalidSquareHighlight] = useState<{ roomIndex: number, x: number, y: number } | null>(null);

  let roomRef = useRef<Room>();

  const handleSquareClick = (x, y, roomIndex?) => {
    console.log(`Clicked square at ${x}, ${y} in room index: ${roomIndex !== undefined ? roomIndex : 'current'}`);

    // Check if player has an active card for multi-square selection mode
    const hasActiveCard = currentPlayer?.drawnCards.some(card => card.isActive) || false;

    if (!hasActiveCard) {
      // No active card - squares cannot be crossed
      console.log('Cannot cross squares without an active card');
      return;
    }

    // Card-based multi-square selection mode
    const actualRoomIndex = roomIndex !== undefined ? roomRef.current?.state.displayedRoomIndices[roomIndex] : roomRef.current?.state.currentRoomIndex;

    if (actualRoomIndex !== undefined) {
      // Perform client-side validation before sending to server
      const validationResult = validateSquareSelection(x, y, roomIndex || 0, actualRoomIndex);

      if (!validationResult.valid) {
        // Show red highlight for invalid selection
        setInvalidSquareHighlight({ roomIndex: roomIndex || 0, x, y });

        // Remove highlight after 500ms
        setTimeout(() => {
          setInvalidSquareHighlight(null);
        }, 500);

        console.log('Invalid square selection:', validationResult.reason);
        return;
      }

      // Valid selection - add to selected squares for visual feedback
      // Store with display room index for visual feedback, but send actualRoomIndex to server
      setSelectedSquares(prev => [...prev, { roomIndex: roomIndex || 0, x, y }]);

      // Send to server
      roomRef.current?.send('crossSquare', {
        x,
        y,
        roomIndex: actualRoomIndex
      });
    }
  };

  // Client-side validation for card-based square selection
  const validateSquareSelection = (x: number, y: number, displayRoomIndex: number, actualRoomIndex: number): { valid: boolean; reason?: string } => {
    if (!displayedRooms[displayRoomIndex]) {
      return { valid: false, reason: 'Invalid room' };
    }

    const room = displayedRooms[displayRoomIndex].room;

    // Check if coordinates are valid
    if (x < 0 || x >= room.width || y < 0 || y >= room.height) {
      return { valid: false, reason: 'Invalid coordinates' };
    }

    const square = room.squares[y * room.width + x];

    // Cannot select walls
    if (square.wall) {
      return { valid: false, reason: 'Cannot select wall squares' };
    }

    // Cannot select already crossed squares
    if (square.checked) {
      return { valid: false, reason: 'Square already crossed' };
    }

    // Check if square is already selected (using actual room index for client-side tracking)
    const alreadySelected = selectedSquares.some(pos =>
      pos.roomIndex === actualRoomIndex && pos.x === x && pos.y === y
    );
    if (alreadySelected) {
      return { valid: false, reason: 'Square already selected' };
    }

    // Check maximum of 3 squares limit
    if (selectedSquares.length >= 3) {
      return { valid: false, reason: 'Maximum of 3 squares can be selected per card' };
    }

    // Validate connectivity for non-first squares
    if (selectedSquares.length > 0) {
      const isConnected = isSquareConnectedToSelection(actualRoomIndex, x, y, selectedSquares);
      if (!isConnected) {
        return { valid: false, reason: 'Square must be orthogonally connected to selected squares' };
      }
    } else {
      // First square must be adjacent to entrance or existing crossed square
      const isValidStart = isValidStartingSquare(room, x, y);
      if (!isValidStart) {
        return { valid: false, reason: 'First square must be adjacent to entrance or existing crossed square' };
      }
    }

    return { valid: true };
  };

  // Check if a square is connected to the current selection
  const isSquareConnectedToSelection = (
    roomIndex: number,
    x: number,
    y: number,
    selectedPositions: Array<{ roomIndex: number, x: number, y: number }>
  ): boolean => {
    // Check if the square is orthogonally adjacent to any selected square in the same room
    for (const pos of selectedPositions) {
      if (pos.roomIndex === roomIndex) {
        const dx = Math.abs(x - pos.x);
        const dy = Math.abs(y - pos.y);

        // Orthogonally adjacent means exactly one coordinate differs by 1
        if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
          return true;
        }
      }
    }

    return false;
  };

  // Check if a square is a valid starting position (adjacent to entrance or existing crossed square)
  const isValidStartingSquare = (room: DungeonRoom, x: number, y: number): boolean => {
    // Check if adjacent to entrance
    if (room.entranceX !== -1 && room.entranceY !== -1) {
      const dx = Math.abs(x - room.entranceX);
      const dy = Math.abs(y - room.entranceY);

      if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
        return true;
      }
    }

    // Check if adjacent to any existing crossed square
    for (let checkX = 0; checkX < room.width; checkX++) {
      for (let checkY = 0; checkY < room.height; checkY++) {
        const square = room.squares[checkY * room.width + checkX];
        if (square && square.checked) {
          const dx = Math.abs(x - checkX);
          const dy = Math.abs(y - checkY);

          if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
            return true;
          }
        }
      }
    }

    return false;
  };

  // Set up global listener for all state changes
  useEffect(() => {
    // Will run once after initial render and whenever inRoom changes
    const room = roomRef.current;
    if (room) {
      // Listen for ANY state changes from the server
      room.onStateChange((state) => {
        console.log("Full state update received");
        // Force a complete re-render when state changes
        setUpdateCounter(prev => prev + 1);

        // Update game state
        setGameState(state);

        // Update displayed rooms
        updateDisplayedRooms(state);

        // Update current player
        if (state.players && room.sessionId) {
          const player = state.players.get(room.sessionId);
          console.log('Updating current player:', player);
          if (player) {
            console.log('Player deck length:', player.deck.length);
            console.log('Player drawnCards length:', player.drawnCards.length);
            console.log('Player hasDrawnCard:', player.hasDrawnCard);
          }
          setCurrentPlayer(player || null);
        }
      });
    }
  }, [inRoom]); // Only re-run when room connection status changes

  // Function to update the displayed rooms based on the state
  const updateDisplayedRooms = (state) => {
    if (!state || !state.rooms || !state.displayedRoomIndices) return;

    const rooms = [];

    for (let i = 0; i < state.displayedRoomIndices.length; i++) {
      const roomIndex = state.displayedRoomIndices[i];
      const room = state.rooms[roomIndex];
      const x = state.roomPositionsX[i];
      const y = state.roomPositionsY[i];

      rooms.push({
        room,
        x,
        y
      });
    }

    setDisplayedRooms(rooms);

    // Also update the current room
    if (state.rooms[state.currentRoomIndex]) {
      setCurrentRoom(state.rooms[state.currentRoomIndex]);
    }
  };

  async function joinRoom() {
    var client = new Colyseus.Client('ws://localhost:2567');
    // var client = new Colyseus.Client('https://us-ewr-120d3744.colyseus.cloud');

    try {
      roomRef.current = await client.joinOrCreate('dungeon', { name: name });

      setInRoom(true);
      console.log('joined successfully', roomRef);

      roomRef.current.state.players.onAdd((player, sessionId) => {
        console.log(`Player added: ${player.name} (sessionId: ${sessionId})`);
        setInRoom(true);
        setPlayers((players) => [...players, player.name]);
      });

      roomRef.current.state.rooms.onAdd((room, index) => {
        console.log(`Room added at index ${index}, width: ${room.width}, height: ${room.height}`);

        // Listen for changes to the current room index
        roomRef.current.state.listen("currentRoomIndex", (currentIndex) => {
          console.log(`Current room index changed to ${currentIndex}`);
          setCurrentRoom(roomRef.current.state.rooms[currentIndex]);
          setUpdateCounter(prev => prev + 1);

          // Update displayed rooms when current room changes
          updateDisplayedRooms(roomRef.current.state);
        });

        // Set the initial current room
        if (index === roomRef.current.state.currentRoomIndex) {
          setCurrentRoom(room);
        }

        // Listen for changes to squares in the room
        room.squares.onChange((square, squareIndex) => {
          // console.log(`Square changed at index ${squareIndex}`);
        });
      });

      // Listen for changes to displayed room indices
      roomRef.current.state.displayedRoomIndices.onAdd((roomIndex, i) => {
        console.log(`Displayed room index added: ${roomIndex} at position ${i}`);
        updateDisplayedRooms(roomRef.current.state);
      });

      // Listen for changes to room positions
      roomRef.current.state.roomPositionsX.onChange((value, i) => {
        console.log(`Room position X changed at index ${i}: ${value}`);
        updateDisplayedRooms(roomRef.current.state);
      });

      roomRef.current.state.roomPositionsY.onChange((value, i) => {
        console.log(`Room position Y changed at index ${i}: ${value}`);
        updateDisplayedRooms(roomRef.current.state);
      });

      roomRef.current.state.players.onChange = (
        player: Player,
        sessionId: string
      ) => {
        console.log(`Player changed: ${player.name} (sessionId: ${sessionId})`);
      };

      // Add message handlers
      roomRef.current.onMessage('drawCardResult', (message) => {
        console.log('📨 Draw card result received:', message);
        console.log('  - Success:', message.success);
        console.log('  - Message:', message.message);
        console.log('  - Error:', message.error);

        if (message.success) {
          console.log('  ✅ Card draw was successful - state should update soon');
        } else {
          console.log('  ❌ Card draw failed:', message.error);
        }

        // The state will be updated automatically through onStateChange
        // This handler just acknowledges the message to prevent warnings
      });

      // Handle crossSquare results for card-based selection
      roomRef.current.onMessage('crossSquareResult', (message) => {
        console.log('Cross square result:', message);

        if (message.success && !message.completed) {
          // Square was successfully selected but card action not yet completed
          // We need to track this locally for visual feedback since the server doesn't 
          // immediately mark squares as checked during card selection
          // The actual coordinates should be extracted from the last sent message
          // For now, we'll rely on the client-side tracking in handleSquareClick
        } else if (message.completed) {
          // Card action completed - clear selected squares
          setSelectedSquares([]);
        } else if (message.invalidSquare) {
          // Server confirmed invalid square - visual feedback already shown
          console.log('Server confirmed invalid square selection');
        }
      });

      // Handle cancel card action results
      roomRef.current.onMessage('cancelCardActionResult', (message) => {
        console.log('Cancel card action result:', message);

        if (message.success) {
          // Card action was successfully cancelled - clear selected squares
          setSelectedSquares([]);
        }
      });

      // Handle confirm card action results
      roomRef.current.onMessage('confirmCardActionResult', (message) => {
        console.log('Confirm card action result:', message);

        if (message.success && message.completed) {
          // Card action was successfully completed - clear selected squares
          setSelectedSquares([]);
        }
      });

      // Handle play card results
      roomRef.current.onMessage('playCardResult', (message) => {
        console.log('Play card result:', message);
        // The state will be updated automatically through onStateChange
        // This handler just acknowledges the message to prevent warnings
      });

      // Handle turn advanced results
      roomRef.current.onMessage('turnAdvanced', (message) => {
        console.log('Turn advanced:', message);
        // The state will be updated automatically through onStateChange
        // This handler just acknowledges the message to prevent warnings
      });

      roomRef.current.onStateChange.once((state) => {
        setInitialState(state);
      });
    } catch (e) {
      console.error('join error', e);
    }
  }

  const setInitialState = (state: DungeonState) => {
    console.log('setInitalState', state);

    // Set initial game state
    setGameState(state);

    if (state.rooms && state.rooms.length > 0) {
      setCurrentRoom(state.rooms[state.currentRoomIndex]);
      updateDisplayedRooms(state);
    }

    // Set initial current player
    if (state.players && roomRef.current?.sessionId) {
      const player = state.players.get(roomRef.current.sessionId);
      setCurrentPlayer(player || null);
    }
  };

  return (
    <main className="fixed inset-0 h-screen w-screen overflow-hidden">
      {!inRoom && (
        <div className="flex flex-col items-center justify-center w-full h-full gap-4">
          <div>Character Name</div>
          <input className="border-2 border-gray-300 rounded-md p-2 text-black" type="text" onChange={(e) => setName(e.target.value)} />
          <button
            onClick={joinRoom}
            className="outline-hidden bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Join
          </button>
        </div>
      )}
      {inRoom && (
        <div className="flex h-screen w-full">
          {/* Left side panel for game information */}
          <div className="w-64 flex flex-col bg-slate-800 p-4 overflow-y-auto border-r border-slate-700" >
            <span>
              <h2 className="text-xl font-bold mb-4">Players</h2>
              <ul className="space-y-2">
                {gameState?.players && Array.from(gameState.players.entries()).map(([sessionId, player]) => {
                  const getStatusColor = (status: string) => {
                    switch (status) {
                      case 'not_started':
                        return 'status-not-started';
                      case 'playing_turn':
                        return 'status-playing';
                      case 'turn_complete':
                        return 'status-complete';
                      default:
                        return 'status-not-started';
                    }
                  };

                  const getStatusIcon = (status: string) => {
                    switch (status) {
                      case 'not_started':
                        return '⏸️';
                      case 'playing_turn':
                        return '▶️';
                      case 'turn_complete':
                        return '✅';
                      default:
                        return '⏸️';
                    }
                  };

                  const formatStatus = (status: string) => {
                    switch (status) {
                      case 'not_started':
                        return 'not started';
                      case 'playing_turn':
                        return 'playing turn';
                      case 'turn_complete':
                        return 'turn complete';
                      default:
                        return status;
                    }
                  };

                  return (
                    <li key={sessionId} className="p-2 bg-slate-700 rounded flex justify-between items-center">
                      <span className="font-medium">{player.name}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-sm">{getStatusIcon(player.turnStatus)}</span>
                        <span className={`status-indicator text-sm font-medium ${getStatusColor(player.turnStatus)}`}>
                          {formatStatus(player.turnStatus)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </span>
            <div className='space-y-10'>
              <TurnControls
                player={currentPlayer}
                gameState={gameState}
                room={roomRef.current}
              />
            </div>
          </div>

          {/* Main content area for dungeon map */}
          <div className="flex-1 bg-slate-900 overflow-auto relative" >
            {/* Card Action Buttons - Fixed position at top center */}
            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 flex gap-4">
              <ConfirmMoveButton
                player={currentPlayer}
                room={roomRef.current}
                selectedCount={selectedSquares?.length || 0}
                isVisible={currentPlayer?.drawnCards.some(card => card.isActive) && (selectedSquares?.length || 0) > 0}
              />
              <CancelButton
                player={currentPlayer}
                room={roomRef.current}
                isVisible={currentPlayer?.drawnCards.some(card => card.isActive)}
              />
            </div>

            {displayedRooms.length > 0 && (
              <DungeonMap
                rooms={displayedRooms}
                handleSquareClick={handleSquareClick}
                player={currentPlayer}
                colyseusRoom={roomRef.current}
                invalidSquareHighlight={invalidSquareHighlight}
                selectedSquares={selectedSquares}
              />
            )}
          </div>

          {/* Bottom drawer for player's area */}
          <div className="player-area fixed bottom-0 left-0 right-0 h-60 bg-slate-800 border-t border-slate-700 p-2 z-50">
            <div className="flex gap-4 h-full">
              <div className="bg-slate-700 p-4 rounded flex-1">
                <div className="flex justify-start gap-6">
                  <CardDeck player={currentPlayer} room={roomRef.current} />
                  <DrawnCard player={currentPlayer} room={roomRef.current} key={updateCounter} />
                  <DiscardPile player={currentPlayer} room={roomRef.current} />
                </div>
              </div>
              <div className="bg-slate-700 p-2 rounded flex-1">
                <p>Skills (Coming Soon)</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
