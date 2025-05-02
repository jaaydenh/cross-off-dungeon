'use client';
// @ts-nocheck

import * as Colyseus from 'colyseus.js';

import { useEffect, useState, useRef } from 'react';
import { Room } from 'colyseus.js';
import { DungeonState } from '@/types/DungeonState';
import { Player } from '@/types/Player';
import Grid from './grid';
import { Room as DungeonRoom } from '@/types/Room';

export const dynamic = 'force-dynamic';

interface DungeonRoomState extends DungeonState {}

export default function Room1() {
  const [name, setName] = useState('');
  const [inRoom, setInRoom] = useState(false);
  const [players, setPlayers] = useState([]);
  const [currentRoom, setCurrentRoom] = useState<DungeonRoom | null>(null);
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
      });
    }
  }, [inRoom]); // Only re-run when room connection status changes

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
          {currentRoom && (
            <>
              <p className="mb-4">
                Room size: {currentRoom.width}x{currentRoom.height}, 
                Update counter: {updateCounter}
              </p>
              <Grid 
                room={currentRoom} 
                handleSquareClick={handleSquareClick}
              />
            </>
          )}
        </>
      )}
    </main>
  );
}
