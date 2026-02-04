// 
// THIS FILE HAS BEEN GENERATED AUTOMATICALLY
// DO NOT CHANGE IT MANUALLY UNLESS YOU KNOW WHAT YOU'RE DOING
// 
// GENERATED USING @colyseus/schema 2.0.32
// 

import { Schema, type } from '@colyseus/schema';

export class MonsterSquare extends Schema {
    @type("number") public x!: number;
    @type("number") public y!: number;
    @type("boolean") public filled!: boolean;
    @type("boolean") public checked!: boolean;
}