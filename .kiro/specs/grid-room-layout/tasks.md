# Implementation Plan

- [x] 1. Add grid coordinate properties to Room schema
  - Add gridX and gridY number properties to Room.ts schema with @type decorators
  - Add connectedRoomIndices ArraySchema to track which rooms connect to each exit
  - Add exitConnected boolean ArraySchema to track connection status of each exit
  - Write unit tests for new Room properties and their serialization
  - _Requirements: 1.1, 1.3, 2.1, 2.2, 2.3, 2.4_

- [x] 2. Enhance DungeonState with grid management properties
  - Add gridOriginX and gridOriginY number properties to track starting position
  - Add roomGridPositions MapSchema to map "x,y" coordinate strings to room indices
  - Add methods assignGridCoordinates, getGridCoordinates, and findOrCreateAdjacentRoom
  - Write unit tests for grid coordinate assignment and lookup functionality
  - _Requirements: 1.1, 1.2, 1.4, 6.1, 6.3_

- [x] 3. Create GridManager utility class
  - Implement GridManager class with roomGrid Map for coordinate-to-room mapping
  - Add methods getRoomAt, setRoomAt, getAdjacentRoom for grid operations
  - Add validateConnection method to check exit-entrance alignment between rooms
  - Write comprehensive unit tests for all GridManager methods
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4_

- [x] 4. Implement NavigationValidator for exit adjacency checking
  - Create NavigationValidator class with canNavigateToExit method
  - Add findAdjacentCrossedSquares method to find X squares orthogonally adjacent to exits
  - Add isOrthogonallyAdjacent helper method for coordinate adjacency checking
  - Write unit tests covering various room layouts and crossed square patterns
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 5. Update room generation to use grid coordinates
  - Modify addNewRoom method to assign proper grid coordinates based on exit direction
  - Update room placement logic to check for existing rooms at target coordinates
  - Implement connection logic to link exits with adjacent discovered rooms
  - Add logic to connect to existing rooms instead of always creating new ones
  - Write integration tests for room generation with grid constraints
  - _Requirements: 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 6.1_

- [x] 6. Implement exit navigation validation in crossSquare method
  - Add NavigationValidator usage to validate exit clicks before processing
  - Check for orthogonally adjacent crossed squares when exit is clicked
  - Return appropriate error responses for invalid navigation attempts
  - Update crossSquare to work with any room index, not just current room
  - Write integration tests for exit navigation validation scenarios
  - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4_

- [x] 7. Update frontend DungeonMap for consistent grid positioning
  - Modify room positioning calculation to use actual grid coordinates from server
  - Implement consistent spacing between rooms based on grid layout
  - Add visual connection indicators between rooms with aligned exits
  - Update room rendering to show grid-based relationships clearly
  - Write component tests for grid-based room positioning
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 8. Add exit highlighting and user feedback in Grid component
  - Implement exit highlighting based on navigation eligibility (adjacent X requirement)
  - Add visual indicators for squares adjacent to exits to guide user strategy
  - Show different visual states for connected vs unconnected exits
  - Add hover effects and click feedback for exit interaction
  - Write component tests for exit highlighting and user interaction
  - _Requirements: 4.4, 5.1, 5.2, 5.3_

- [ ] 9. Enhance room connection synchronization
  - Update room generation to properly sync connection status across all clients
  - Add real-time updates for exit connection status when new rooms are discovered
  - Implement proper state change notifications for grid updates
  - Ensure all players see consistent room connections and grid layout
  - Write integration tests for multiplayer grid synchronization
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 10. Add comprehensive error handling and user feedback
  - Implement client-side validation with clear error messages for invalid exit clicks
  - Add server-side error responses for navigation validation failures
  - Create user-friendly feedback for adjacency requirements
  - Add visual indicators when exits cannot be used due to adjacency constraints
  - Write end-to-end tests for error handling scenarios
  - _Requirements: 4.4, 3.1, 3.2, 3.3_

- [ ] 11. Optimize grid performance and add boundary handling
  - Implement efficient grid coordinate calculations for large dungeon layouts
  - Add boundary checking to prevent infinite grid expansion
  - Optimize room lookup performance for large numbers of discovered rooms
  - Add memory management for unused grid positions
  - Write performance tests for large grid scenarios
  - _Requirements: 1.1, 1.2, 5.4, 6.4_

- [ ] 12. Create comprehensive integration tests for complete grid system
  - Write end-to-end tests for complete player navigation through grid-based rooms
  - Test multiplayer scenarios with multiple players exploring simultaneously
  - Add tests for edge cases like grid boundaries and maximum room limits
  - Test room connection consistency across client disconnections and reconnections
  - Verify complete requirement coverage through integration test scenarios
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4_