// 
// THIS FILE HAS BEEN GENERATED AUTOMATICALLY
// DO NOT CHANGE IT MANUALLY UNLESS YOU KNOW WHAT YOU'RE DOING
// 
// GENERATED USING @colyseus/schema 2.0.32
// 

import { Schema, type, ArraySchema, MapSchema, SetSchema, DataChange } from '@colyseus/schema';
import { Player } from './Player'
import { DungeonSquare } from './DungeonSquare'
import { Room } from './Room'
import { MonsterCard } from './MonsterCard'

export class DungeonState extends Schema {
    @type({ map: Player }) public players: MapSchema<Player> = new MapSchema<Player>();
    @type({ map: DungeonSquare }) public board: MapSchema<DungeonSquare> = new MapSchema<DungeonSquare>();
    @type([ Room ]) public rooms: ArraySchema<Room> = new ArraySchema<Room>();
    @type("number") public currentRoomIndex!: number;
    @type([ "number" ]) public displayedRoomIndices: ArraySchema<number> = new ArraySchema<number>();
    @type([ "number" ]) public roomPositionsX: ArraySchema<number> = new ArraySchema<number>();
    @type([ "number" ]) public roomPositionsY: ArraySchema<number> = new ArraySchema<number>();
    @type("number") public gridOriginX!: number;
    @type("number") public gridOriginY!: number;
    @type({ map: "number" }) public roomGridPositions: MapSchema<number> = new MapSchema<number>();
    @type("number") public currentTurn!: number;
    @type("boolean") public turnInProgress!: boolean;
    @type([ "string" ]) public turnOrder: ArraySchema<string> = new ArraySchema<string>();
    @type({ map: "string" }) public activeCardPlayers: MapSchema<string> = new MapSchema<string>();
    @type({ map: "string" }) public selectedSquares: MapSchema<string> = new MapSchema<string>();
    @type({ map: "number" }) public selectedSquareCount: MapSchema<number> = new MapSchema<number>();
    @type([ MonsterCard ]) public monsterDeck: ArraySchema<MonsterCard> = new ArraySchema<MonsterCard>();
    @type([ MonsterCard ]) public activeMonsters: ArraySchema<MonsterCard> = new ArraySchema<MonsterCard>();
}
