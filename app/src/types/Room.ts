// 
// THIS FILE HAS BEEN GENERATED AUTOMATICALLY
// DO NOT CHANGE IT MANUALLY UNLESS YOU KNOW WHAT YOU'RE DOING
// 
// GENERATED USING @colyseus/schema 2.0.32
// 

import { Schema, type, ArraySchema, MapSchema, SetSchema, DataChange } from '@colyseus/schema';
import { DungeonSquare } from './DungeonSquare'

export class Room extends Schema {
    @type("number") public width!: number;
    @type("number") public height!: number;
    @type("boolean") public isBossRoom!: boolean;
    @type([ DungeonSquare ]) public squares: ArraySchema<DungeonSquare> = new ArraySchema<DungeonSquare>();
    @type("string") public entranceDirection!: string;
    @type("number") public entranceX!: number;
    @type("number") public entranceY!: number;
    @type([ "string" ]) public exitDirections: ArraySchema<string> = new ArraySchema<string>();
    @type([ "number" ]) public exitX: ArraySchema<number> = new ArraySchema<number>();
    @type([ "number" ]) public exitY: ArraySchema<number> = new ArraySchema<number>();
    @type("number") public gridX!: number;
    @type("number") public gridY!: number;
    @type([ "number" ]) public connectedRoomIndices: ArraySchema<number> = new ArraySchema<number>();
    @type([ "boolean" ]) public exitConnected: ArraySchema<boolean> = new ArraySchema<boolean>();
}
