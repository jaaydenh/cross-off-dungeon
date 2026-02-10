"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Card = void 0;
const schema_1 = require("@colyseus/schema");
class Card extends schema_1.Schema {
    constructor(id, type, description, selectionTarget, selectionMode, minSelections, maxSelections, requiresConnected, requiresRoomStartAdjacency, requiresMonsterStartAdjacency, defenseSymbol = "empty", drawCardsOnResolve = 0) {
        super();
        this.minSelections = 1;
        this.maxSelections = 0;
        this.requiresConnected = false;
        this.requiresRoomStartAdjacency = false;
        this.requiresMonsterStartAdjacency = false;
        this.defenseSymbol = "empty"; // empty, block, counter
        this.drawCardsOnResolve = 0;
        this.isActive = false;
        this.id = id;
        this.type = type;
        this.description = description;
        this.selectionTarget = selectionTarget;
        this.selectionMode = selectionMode;
        this.minSelections = minSelections;
        this.maxSelections = maxSelections;
        this.requiresConnected = requiresConnected;
        this.requiresRoomStartAdjacency = requiresRoomStartAdjacency;
        this.requiresMonsterStartAdjacency = requiresMonsterStartAdjacency;
        this.defenseSymbol = defenseSymbol;
        this.drawCardsOnResolve = Math.max(0, Math.floor(drawCardsOnResolve || 0));
        this.isActive = false;
    }
}
exports.Card = Card;
__decorate([
    (0, schema_1.type)("string")
], Card.prototype, "id", void 0);
__decorate([
    (0, schema_1.type)("string")
], Card.prototype, "type", void 0);
__decorate([
    (0, schema_1.type)("string")
], Card.prototype, "description", void 0);
__decorate([
    (0, schema_1.type)("string")
], Card.prototype, "selectionTarget", void 0);
__decorate([
    (0, schema_1.type)("string")
], Card.prototype, "selectionMode", void 0);
__decorate([
    (0, schema_1.type)("number")
], Card.prototype, "minSelections", void 0);
__decorate([
    (0, schema_1.type)("number")
], Card.prototype, "maxSelections", void 0);
__decorate([
    (0, schema_1.type)("boolean")
], Card.prototype, "requiresConnected", void 0);
__decorate([
    (0, schema_1.type)("boolean")
], Card.prototype, "requiresRoomStartAdjacency", void 0);
__decorate([
    (0, schema_1.type)("boolean")
], Card.prototype, "requiresMonsterStartAdjacency", void 0);
__decorate([
    (0, schema_1.type)("string")
], Card.prototype, "defenseSymbol", void 0);
__decorate([
    (0, schema_1.type)("number")
], Card.prototype, "drawCardsOnResolve", void 0);
__decorate([
    (0, schema_1.type)("boolean")
], Card.prototype, "isActive", void 0);
