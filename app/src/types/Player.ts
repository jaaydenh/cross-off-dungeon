// 
// THIS FILE HAS BEEN GENERATED AUTOMATICALLY
// DO NOT CHANGE IT MANUALLY UNLESS YOU KNOW WHAT YOU'RE DOING
// 
// GENERATED USING @colyseus/schema 2.0.32
// 

import { Schema, type, ArraySchema, MapSchema, SetSchema, DataChange } from '@colyseus/schema';
import { Card } from './Card'

export class Player extends Schema {
    @type("string") public name!: string;
    @type([ Card ]) public deck: ArraySchema<Card> = new ArraySchema<Card>();
    @type([ Card ]) public drawnCards: ArraySchema<Card> = new ArraySchema<Card>();
    @type([ Card ]) public discardPile: ArraySchema<Card> = new ArraySchema<Card>();
    @type("string") public turnStatus!: string;
    @type("boolean") public hasDrawnCard!: boolean;
}
