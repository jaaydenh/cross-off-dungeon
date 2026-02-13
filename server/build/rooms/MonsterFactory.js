"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonsterFactory = void 0;
const MonsterCard_1 = require("./schema/MonsterCard");
class MonsterFactory {
    /**
     * Create a bat monster card
     * Pattern: Flying creature with wings spread
     *   □■□
     *  ■■■■■
     *   ■■■
     *    ■
     */
    static createBat(id) {
        const bat = new MonsterCard_1.MonsterCard(id, "bat", 5, 4);
        // Wings and body pattern
        bat.setSquareFilled(1, 0, true); // Top center
        bat.setSquareFilled(0, 1, true); // Left wing
        bat.setSquareFilled(1, 1, true); // Body center
        bat.setSquareFilled(2, 1, true); // Body center
        bat.setSquareFilled(3, 1, true); // Body center
        bat.setSquareFilled(4, 1, true); // Right wing
        bat.setSquareFilled(1, 2, true); // Lower body
        bat.setSquareFilled(2, 2, true); // Lower body
        bat.setSquareFilled(3, 2, true); // Lower body
        bat.setSquareFilled(2, 3, true); // Tail
        return bat;
    }
    /**
     * Create a goblin monster card
     * Pattern: Humanoid creature
     *   ■■■
     *   ■■■
     *    ■
     *   ■■■
     */
    static createGoblin(id) {
        const goblin = new MonsterCard_1.MonsterCard(id, "goblin", 3, 4);
        // Head
        goblin.setSquareFilled(0, 0, true);
        goblin.setSquareFilled(1, 0, true);
        goblin.setSquareFilled(2, 0, true);
        // Body
        goblin.setSquareFilled(0, 1, true);
        goblin.setSquareFilled(1, 1, true);
        goblin.setSquareFilled(2, 1, true);
        // Waist
        goblin.setSquareFilled(1, 2, true);
        // Legs
        goblin.setSquareFilled(0, 3, true);
        goblin.setSquareFilled(1, 3, true);
        goblin.setSquareFilled(2, 3, true);
        return goblin;
    }
    /**
     * Create a rat monster card
     * Pattern: Small rodent
     *  ■■■■
     *   ■■
     *    ■
     */
    static createRat(id) {
        const rat = new MonsterCard_1.MonsterCard(id, "rat", 4, 3);
        // Body and head
        rat.setSquareFilled(0, 0, true); // Head
        rat.setSquareFilled(1, 0, true); // Body
        rat.setSquareFilled(2, 0, true); // Body
        rat.setSquareFilled(3, 0, true); // Tail
        // Middle section
        rat.setSquareFilled(1, 1, true);
        rat.setSquareFilled(2, 1, true);
        // Feet
        rat.setSquareFilled(2, 2, true);
        return rat;
    }
    /**
     * Create a troll monster card
     * Pattern: Large humanoid
     *  ■■■■■
     *  ■■■■■
     *   ■■■
     *  ■■■■■
     *  ■■■■■
     */
    static createTroll(id) {
        const troll = new MonsterCard_1.MonsterCard(id, "troll", 5, 5);
        // Head
        for (let x = 0; x < 5; x++) {
            troll.setSquareFilled(x, 0, true);
        }
        // Shoulders/Arms
        for (let x = 0; x < 5; x++) {
            troll.setSquareFilled(x, 1, true);
        }
        // Torso
        for (let x = 1; x < 4; x++) {
            troll.setSquareFilled(x, 2, true);
        }
        // Hips
        for (let x = 0; x < 5; x++) {
            troll.setSquareFilled(x, 3, true);
        }
        // Legs
        for (let x = 0; x < 5; x++) {
            troll.setSquareFilled(x, 4, true);
        }
        return troll;
    }
    /**
     * Create a slime monster card
     * Pattern: Blob-like creature
     *   ■■■
     *  ■■■■■
     *   ■■■
     */
    static createSlime(id) {
        const slime = new MonsterCard_1.MonsterCard(id, "slime", 5, 3);
        // Top blob
        slime.setSquareFilled(1, 0, true);
        slime.setSquareFilled(2, 0, true);
        slime.setSquareFilled(3, 0, true);
        // Middle (widest part)
        for (let x = 0; x < 5; x++) {
            slime.setSquareFilled(x, 1, true);
        }
        // Bottom blob
        slime.setSquareFilled(1, 2, true);
        slime.setSquareFilled(2, 2, true);
        slime.setSquareFilled(3, 2, true);
        return slime;
    }
    /**
     * Create a boss monster card.
     * Pattern: large fortress-like body intended to take many turns to clear.
     */
    static createBoss(id) {
        const boss = new MonsterCard_1.MonsterCard(id, "ancient_wyrm", 7, 7, 3, true);
        for (let y = 0; y < boss.height; y++) {
            for (let x = 0; x < boss.width; x++) {
                // Hollow corners to keep the silhouette readable but still dense.
                const isCorner = (x === 0 && y === 0) ||
                    (x === boss.width - 1 && y === 0) ||
                    (x === 0 && y === boss.height - 1) ||
                    (x === boss.width - 1 && y === boss.height - 1);
                if (!isCorner) {
                    boss.setSquareFilled(x, y, true);
                }
            }
        }
        return boss;
    }
    /**
     * Create a shuffled deck of monster cards
     */
    static createMonsterDeck() {
        const monsters = [];
        // Create multiple instances of each monster type for variety
        const monsterTypes = [
            { name: 'bat', factory: this.createBat },
            { name: 'goblin', factory: this.createGoblin },
            { name: 'rat', factory: this.createRat },
            { name: 'troll', factory: this.createTroll },
            { name: 'slime', factory: this.createSlime }
        ];
        // Create 3 of each monster type (15 total monsters)
        monsterTypes.forEach(({ name, factory }, typeIndex) => {
            for (let i = 0; i < 3; i++) {
                const monsterId = `${name}_${typeIndex}_${i}`;
                const monster = factory.call(this, monsterId);
                monsters.push(monster);
            }
        });
        // Shuffle the deck using Fisher-Yates algorithm
        for (let i = monsters.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [monsters[i], monsters[j]] = [monsters[j], monsters[i]];
        }
        return monsters;
    }
}
exports.MonsterFactory = MonsterFactory;
