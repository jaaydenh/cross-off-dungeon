// 
// THIS FILE HAS BEEN GENERATED AUTOMATICALLY
// DO NOT CHANGE IT MANUALLY UNLESS YOU KNOW WHAT YOU'RE DOING
// 
// GENERATED USING @colyseus/schema 2.0.32
// 

import { Schema, type, ArraySchema, MapSchema, SetSchema, DataChange } from '@colyseus/schema';


export class DungeonSquare extends Schema {
    @type("boolean") public checked!: boolean;
    @type("boolean") public entrance!: boolean;
    @type("boolean") public exit!: boolean;
    @type("boolean") public treasure!: boolean;
    @type("boolean") public monster!: boolean;
    @type("boolean") public wall!: boolean;
}
