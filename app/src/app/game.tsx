'use client';
// @ts-nocheck

import * as Colyseus from 'colyseus.js';

import { useEffect, useState, useRef } from 'react';
import { Room } from 'colyseus.js';
import { DungeonState } from '@/types/DungeonState';
import { Player } from '@/types/Player';
import { Room as DungeonRoom } from '@/types/Room';
import DungeonMap from './DungeonMap';

export const dynamic = 'force-dynamic';

interface DungeonRoomState extends DungeonState {}

export default function Game() {
  const [name, setName] = useState('');
  const [inRoom, setInRoom] = useState(false);
  const [players, setPlayers] = useState([]);
  const [currentRoom, setCurrentRoom] = useState<DungeonRoom | null>(null);
  const [displayedRooms, setDisplayedRooms] = useState<{room: DungeonRoom, x: number, y: number}[]>([]);
  // Add a state update counter to force re-renders
  const [updateCounter, setUpdateCounter] = useState(0);

  let roomRef = useRef<Room>();

  const handleSquareClick = (x, y, roomIndex?) => {
    console.log(`Clicked square at ${x}, ${y} in room index: ${roomIndex !== undefined ? roomIndex : 'current'}`);
    
    // If a room index is provided, find the correct room from displayedRooms
    if (roomIndex !== undefined && displayedRooms[roomIndex]) {
      const { room, x: roomX, y: roomY } = displayedRooms[roomIndex];
      // Send the click to the server with the room information
      roomRef.current?.send('crossSquare', { 
        x, 
        y, 
        roomIndex: roomRef.current.state.displayedRoomIndices[roomIndex] 
      });
    } else {
      // Default behavior for current room
      roomRef.current?.send('crossSquare', { x, y });
    }
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
          <div className="w-64 flex-none bg-slate-800 p-4 overflow-y-auto border-r border-slate-700" >
            <h2 className="text-xl font-bold mb-4">Players</h2>
            <ul className="space-y-2">
              {players.map((player, index) => (
                <li key={index} className="p-2 bg-slate-700 rounded">{player}</li>
              ))}
            </ul>
          </div>
          
          {/* Main content area for dungeon map */}
          <div className="flex-1 bg-slate-900 overflow-auto" >
            {displayedRooms.length > 0 && (
              <DungeonMap 
                rooms={displayedRooms} 
                handleSquareClick={handleSquareClick}
              />
            )}
          </div>
          
          {/* Bottom drawer for player's area */}
          <div className="fixed bottom-0 left-0 right-0 h-60 bg-slate-800 border-t border-slate-700 p-4">
            <h2 className="text-xl font-bold mb-2">Player Area</h2>
            <div className="flex gap-4">
              <div className="bg-slate-700 p-2 rounded flex-1">
                <p>Cards (Coming Soon)</p>
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
