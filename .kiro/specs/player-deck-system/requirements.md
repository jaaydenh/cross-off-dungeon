# Requirements Document

## Introduction

This feature introduces a turn-based card system to the multiplayer dungeon exploration game. Each player will start with a shuffled deck of 10 cards that they can draw and play during their turns. The system includes turn management, card actions, and player status tracking to create structured gameplay rounds.

## Requirements

### Requirement 1

**User Story:** As a player, I want to start each game with a deck of 10 cards, so that I have strategic options during gameplay.

#### Acceptance Criteria

1. WHEN a player joins a game THEN the system SHALL create a deck of 10 cards for that player
2. WHEN the deck is created THEN the system SHALL shuffle the cards randomly
3. WHEN the game starts THEN each player's deck SHALL appear face down in their player area
4. WHEN a player views their deck THEN the system SHALL display a glow effect until the first card is drawn

### Requirement 2

**User Story:** As a player, I want to draw cards from my deck during my turn, so that I can access new actions.

#### Acceptance Criteria

1. WHEN it is a player's turn THEN the player SHALL be able to click their deck to draw the top card
2. WHEN a player draws a card THEN the system SHALL flip the card face up and place it next to the deck
3. WHEN a card is drawn THEN the deck glow effect SHALL be removed
4. WHEN a player draws a card THEN their status SHALL change to "playing turn"

### Requirement 3

**User Story:** As a player, I want to play cards that allow me to cross connected squares, so that I can strategically explore the dungeon.

#### Acceptance Criteria

1. WHEN a player clicks a drawn card THEN the system SHALL activate the card's action
2. WHEN a "Cross 3 connected squares" card is activated THEN the player SHALL be able to click 3 orthogonally connected squares in a single room
3. WHEN a player clicks the first square THEN a cancel button will appear next to the room, clicking the cancel button will remove crossed squares from this card action
4. WHEN selecting squares THEN the first square SHALL be adjacent to a room entrance or an existing crossed square
5. WHEN a player clicks an invalid square THEN the system SHALL briefly highlight the square in red
6. WHEN 3 valid squares are selected THEN the system SHALL mark all selected squares as crossed and remove the cancel button
7. WHEN 3 valid squares are selection THEN the system SHALL move the card to a discard pile, to the left of the deck.


### Requirement 4

**User Story:** As a player, I want to end my turn when I'm finished, so that other players can take their turns.

#### Acceptance Criteria

1. WHEN a player is taking their turn THEN the system SHALL display a large red "End Turn" button in the Players section
2. WHEN a player clicks "End Turn" THEN their status SHALL change to "turn complete"
3. WHEN all players have clicked "End Turn" THEN the system SHALL advance to the next turn round
4. WHEN a new turn round begins THEN all player statuses SHALL reset appropriately

### Requirement 5

**User Story:** As a player, I want to see the status of all players during turns, so that I know the current game state.

#### Acceptance Criteria

1. WHEN viewing the Players section THEN each player name SHALL display their current status
2. WHEN a player has not drawn a card THEN their status SHALL show "not started"
3. WHEN a player has drawn a card but not ended their turn THEN their status SHALL show "playing turn"
4. WHEN a player has clicked "End Turn" THEN their status SHALL show "turn complete"
5. WHEN all players complete their turns THEN the system SHALL reset statuses for the next round