'use client';
// @ts-nocheck

import * as Colyseus from 'colyseus.js';

import { useEffect, useState, useRef } from 'react';
import { Room } from 'colyseus.js';
import { DungeonState } from '@/types/DungeonState';
import { Player } from '@/types/Player';
import Grid from './grid';
import { Room as DungeonRoom } from '@/types/Room';
import MultiRoomDisplay from './multiRoomDisplay';

export const dynamic = 'force-dynamic';

interface DungeonRoomState extends DungeonState {}

export default function Room1() {
  const [name, setName] = useState('');
  const [inRoom, setInRoom] = useState(false);
  const [players, setPlayers] = useState([]);
  const [currentRoom, setCurrentRoom] = useState<DungeonRoom | null>(null);
  const [displayedRooms, setDisplayedRooms] = useState<{room: DungeonRoom, x: number, y: number}[]>([]);
  // Add a state update counter to force re-renders
  const [updateCounter, setUpdateCounter] = useState(0);

  let roomRef = useRef<Room>();

  const handleSquareClick = (x, y) => {
    console.log(`Clicked square at ${x}, ${y}`);
    roomRef.current?.send('crossSquare', { x: x, y: y });
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
        
        // Update displayed rooms
        updateDisplayedRooms(state);
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
          console.log(`Square changed at index ${squareIndex}`);
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

      roomRef.current.onStateChange.once((state) => {
        setInitialState(state);
      });
    } catch (e) {
      console.error('join error', e);
    }
  }

  const setInitialState = (state: DungeonState) => {
    console.log('setInitalState', state);
    if (state.rooms && state.rooms.length > 0) {
      setCurrentRoom(state.rooms[state.currentRoomIndex]);
      updateDisplayedRooms(state);
    }
  };

  return (
    <main className="flex min-h-screen flex-col p-24">
      {!inRoom && (
        <div className="flex flex-col items-center justify-center w-full h-full gap-4">
          <div>Character Name</div>
          <input type="text" onChange={(e) => setName(e.target.value)} />
          <button
            onClick={joinRoom}
            className="outline-none bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Join
          </button>
        </div>
      )}
      {inRoom && (
        <>
          <p>Players</p>
          <ul>
            {players.map((player, index) => (
              <li key={index}>{player}</li>
            ))}
          </ul>
          
          {/* Display all rooms */}
          {displayedRooms.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-bold mb-4">Dungeon Map</h2>
              <MultiRoomDisplay 
                rooms={displayedRooms} 
                currentRoomIndex={roomRef.current?.state.currentRoomIndex || 0}
                handleSquareClick={handleSquareClick}
              />
            </div>
          )}
          
          {/* Display only the current room (for backward compatibility) */}
          {currentRoom && (
            <div className="mt-8 hidden">
              <p className="mb-4">
                Room size: {currentRoom.width}x{currentRoom.height}, 
                Update counter: {updateCounter}
              </p>
              <Grid 
                room={currentRoom} 
                handleSquareClick={handleSquareClick}
              />
            </div>
          )}
        </>
      )}
    </main>
  );
}
