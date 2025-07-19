// 
// THIS FILE HAS BEEN GENERATED AUTOMATICALLY
// DO NOT CHANGE IT MANUALLY UNLESS YOU KNOW WHAT YOU'RE DOING
// 
// GENERATED USING @colyseus/schema 2.0.32
// 

import { Schema, type, ArraySchema, MapSchema, SetSchema, DataChange } from '@colyseus/schema';


export class Card extends Schema {
    @type("string") public id!: string;
    @type("string") public type!: string;
    @type("string") public description!: string;
    @type("boolean") public isActive!: boolean;
}
