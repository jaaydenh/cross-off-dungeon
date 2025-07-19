# Implementation Plan

- [x] 1. Create Card schema and extend Player schema with deck properties
  - Create new Card schema class with id, type, description, and isActive properties
  - Extend Player schema to include deck, drawnCards, discardPile, turnStatus, and hasDrawnCard properties
  - Add card initialization logic to create shuffled deck of 10 cards for new players
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Implement turn management in DungeonState
  - Add turn-related properties to DungeonState schema (turnStatus) 
  - Create methods to initialize turn state for each player when the game starts
  - Implement turn advancement logic when all players complete their turns
  - Add player status tracking and validation methods
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 3. Create card drawing functionality in Dungeon room
  - Add message handler for "drawCard" action in Dungeon room
  - Implement deck drawing logic that moves top card from deck to drawnCards
  - Update player turnStatus to "playing_turn" when card is drawn
  - Add validation to prevent drawing multiple cards per turn
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 4. Implement card-based square selection system
  - Create message handler for "playCard" action that activates a drawn card
  - Extend crossSquare functionality to support card-based multi-square selection
  - Add validation for 3 connected orthogonal squares starting from entrance or existing X
  - Implement square highlighting for invalid selections (red highlight with timeout)
  - Add logic to move completed cards to discardPile after 3 squares are selected
  - Create message handler for "cancelCardAction" to clear selected squares and deactivate card
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 5. Create turn completion functionality
  - Add message handler for "endTurn" action in Dungeon room
  - Update player turnStatus to "turn_complete" when end turn is clicked
  - Implement logic to advance turn when all players have completed their turns
  - Reset player statuses appropriately for new turn rounds
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 6. Generate client-side type definitions
  - Run schema generation to create updated TypeScript types for frontend
  - Ensure Card and updated Player types are available in app/src/types/
  - Verify DungeonState includes new turn management properties
  - _Requirements: All requirements (supporting infrastructure)_

- [x] 7. Create CardDeck React component
  - Build component to display face-down deck with card count
  - Implement glow effect CSS that appears until first card is drawn
  - Add click handler to send "drawCard" message to server
  - Handle deck state updates from server (card count, glow visibility)
  - _Requirements: 1.4, 2.1_

- [x] 8. Create DrawnCard React component
  - Build component to display face-up drawn card with description
  - Add click handler to send "playCard" message to server
  - Show card activation state and disable interaction when card is active
  - Handle card state updates from server
  - _Requirements: 2.2, 3.1_

- [x] 9. Create TurnControls React component
  - Build component with large red "End Turn" button
  - Add click handler to send "endTurn" message to server
  - Show/hide button based on current turn state and player status
  - Handle turn state updates from server
  - _Requirements: 4.1, 4.2_

- [x] 10. Create DiscardPile React component
  - Build component to display face-up discard pile to the left of the deck
  - Show the top card of the discard pile when cards are present
  - Handle discard pile state updates from server
  - Style component to match deck appearance but show face-up cards
  - _Requirements: 3.7_

- [x] 11. Create CancelButton React component
  - Build component that appears next to rooms during card-based square selection
  - Add click handler to send "cancelCardAction" message to server
  - Show/hide button based on card activation state and selected squares
  - Position button appropriately relative to room layout
  - _Requirements: 3.3_

- [x] 12. Enhance PlayerList component with status display
  - Modify existing player list to show status next to each player name
  - Display "not started", "playing turn", or "turn complete" status
  - Update status display in real-time based on server state changes
  - Style status indicators with appropriate colors/icons
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 13. Integrate card components into main Game component
  - Replace "Cards (Coming Soon)" placeholder with CardDeck and DrawnCard components
  - Add TurnControls component to player area
  - Set up state listeners for card and turn-related server updates
  - Handle card drawing, playing, and turn management user interactions
  - _Requirements: 1.3, 2.1, 2.2, 3.1, 4.1_

- [x] 14. Implement square selection validation and visual feedback
  - Enhance handleSquareClick to support card-based multi-square selection mode
  - Add client-side validation for connected square selection
  - Implement red highlight animation for invalid square clicks (500ms duration)
  - Track selected squares during card play and validate connectivity rules
  - _Requirements: 3.2, 3.3, 3.4, 3.5_

- [x] 15. Add CSS animations and styling for card system
  - Create glow effect animation for undrawn deck
  - Add card flip animation for drawing cards
  - Style turn controls and status indicators
  - Implement red highlight animation for invalid square selection
  - Ensure responsive design for card components in player area
  - _Requirements: 1.4, 3.4 (visual feedback)_

- [x] 16. Write comprehensive tests for card and turn system
  - Create unit tests for Card schema and Player schema extensions
  - Test turn management logic and state transitions
  - Test card drawing, playing, and turn completion functionality
  - Create integration tests for multi-player turn scenarios
  - Test error handling for invalid actions and edge cases
  - _Requirements: All requirements (validation and quality assurance)_