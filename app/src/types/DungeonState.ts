// 
// THIS FILE HAS BEEN GENERATED AUTOMATICALLY
// DO NOT CHANGE IT MANUALLY UNLESS YOU KNOW WHAT YOU'RE DOING
// 
// GENERATED USING @colyseus/schema 2.0.32
// 

import { Schema, type, ArraySchema, MapSchema, SetSchema, DataChange } from '@colyseus/schema';
import { Player } from './Player'

export class DungeonState extends Schema {
    // @type({ map: Player }) players: MapSchema<Player> = new MapSchema<Player>();
    @type({ map: "boolean" }) players = new MapSchema<boolean>();
}
