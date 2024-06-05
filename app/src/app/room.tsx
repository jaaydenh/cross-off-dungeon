'use client';
// @ts-nocheck

import * as Colyseus from 'colyseus.js';

import { useEffect, useState, useRef } from 'react';
import { Client, Room } from 'colyseus.js';
import { DungeonState } from '@/types/DungeonState';
import { Player } from '@/types/Player';
import Grid from './grid';

export const dynamic = 'force-dynamic';

interface DungeonRoomState extends DungeonState {}

export default function Room1() {
  const [name, setName] = useState('');
  const [inRoom, setInRoom] = useState(false);
  const [players, setPlayers] = useState([]);

  const [squares, setSquares] = useState(
    new Array(4).fill(0).map(() => new Array(4).fill(0))
  );

  let roomRef = useRef<Room>();

  const handleSquareClick = (x, y) => {
    roomRef.current?.send('crossSquare', { x: x, y: y });
  };

  const setGridSquares = (x, y, value) => {
    setSquares((prevSquares) => {
      const newSquares = prevSquares.map((row, i) =>
        row.map((square, j) => {
          if (i === x && j === y) {
            return value;
          } else {
            return square;
          }
        })
      );
      return newSquares;
    });
  };

  async function joinRoom() {
    // var client = new Colyseus.Client('ws://localhost:2567');
    var client = new Colyseus.Client(
      'https://us-ewr-120d3744.colyseus.cloud:2567'
    );

    try {
      roomRef.current = await client.joinOrCreate('dungeon', { name: name });

      setInRoom(true);
      console.log('joined successfully', roomRef);

      roomRef.current.state.players.onAdd((player, sessionId) => {
        console.log(`Player added: ${player.name} (sessionId: ${sessionId})`);
        setInRoom(true);
        setPlayers((players) => [...players, player.name]);
      });

      roomRef.current.state.board.onChange((value: number, index) => {
        const x = index % 4;
        const y = Math.floor(index / 4);
        setGridSquares(x, y, value);
      });

      roomRef.current.state.players.onChange = (
        player: Player,
        sessionId: string
      ) => {
        console.log(`Player changed: ${player.name} (sessionId: ${sessionId})`);
      };

      roomRef.current.onStateChange((state) => {
        // console.log('state changed2', state);
      });
    } catch (e) {
      console.error('join error', e);
    }
  }

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
          <Grid squares={squares} handleSquareClick={handleSquareClick} />
        </>
      )}
    </main>
  );
}
