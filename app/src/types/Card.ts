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
    @type("string") public selectionTarget!: string;
    @type("string") public selectionMode!: string;
    @type("number") public minSelections!: number;
    @type("number") public maxSelections!: number;
    @type("boolean") public requiresConnected!: boolean;
    @type("boolean") public requiresRoomStartAdjacency!: boolean;
    @type("boolean") public requiresMonsterStartAdjacency!: boolean;
    @type("boolean") public isActive!: boolean;
}
