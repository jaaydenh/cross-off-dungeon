"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonsterSquare = void 0;
const schema_1 = require("@colyseus/schema");
class MonsterSquare extends schema_1.Schema {
    constructor(x = 0, y = 0, filled = false) {
        super();
        this.filled = false; // Whether this square is part of the monster pattern
        this.checked = false; // Whether player has crossed this square
        this.x = x;
        this.y = y;
        this.filled = filled;
        this.checked = false;
    }
}
exports.MonsterSquare = MonsterSquare;
__decorate([
    (0, schema_1.type)("number")
], MonsterSquare.prototype, "x", void 0);
__decorate([
    (0, schema_1.type)("number")
], MonsterSquare.prototype, "y", void 0);
__decorate([
    (0, schema_1.type)("boolean")
], MonsterSquare.prototype, "filled", void 0);
__decorate([
    (0, schema_1.type)("boolean")
], MonsterSquare.prototype, "checked", void 0);
