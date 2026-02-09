// 
// THIS FILE HAS BEEN GENERATED AUTOMATICALLY
// DO NOT CHANGE IT MANUALLY UNLESS YOU KNOW WHAT YOU'RE DOING
// 
// GENERATED USING @colyseus/schema 2.0.32
// 

import { Schema, type, ArraySchema } from '@colyseus/schema';
import { MonsterSquare } from './MonsterSquare';

export class MonsterCard extends Schema {
    @type("string") public id!: string;
    @type("string") public name!: string;
    @type("number") public width!: number;
    @type("number") public height!: number;
    @type("number") public attackRating!: number;
    @type([MonsterSquare]) public squares!: ArraySchema<MonsterSquare>;
    @type("string") public playerOwnerId!: string;
    @type("number") public connectedToRoomIndex!: number;
}
