// 
// THIS FILE HAS BEEN GENERATED AUTOMATICALLY
// DO NOT CHANGE IT MANUALLY UNLESS YOU KNOW WHAT YOU'RE DOING
// 
// GENERATED USING @colyseus/schema 2.0.32
// 

import { Schema, type, ArraySchema, MapSchema, SetSchema, DataChange } from '@colyseus/schema';
import { Player } from './Player';
import { Room } from './Room';
import { DungeonSquare } from './DungeonSquare';

export class DungeonState extends Schema {
    @type({ map: Player }) players = new MapSchema<Player>();
    @type({ map: DungeonSquare }) board = new MapSchema<DungeonSquare>();
    @type([Room]) rooms = new ArraySchema<Room>();
    @type("number") currentRoomIndex = 0;
}
