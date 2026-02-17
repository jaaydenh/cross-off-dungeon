# Fantasy Room Design Research (Map Creator References)

## Reference tools reviewed

1. Watabou One Page Dungeon (your example):  
   https://watabou.github.io/one-page-dungeon/?seed=190303108
2. Watabou procedural generation notes/FAQ:  
   https://watabou.github.io/
3. Dungeon Scrawl (simple map drawing workflow + styles):  
   https://www.dungeonscrawl.com/
4. Donjon random dungeon generator internals (algorithmic generation):  
   https://donjon.bin.sh/code/dungeon/dungeon.pl
5. Inkarnate (colored fantasy map style references):  
   https://inkarnate.com/
6. DungeonFog (production-style fantasy map editor references):  
   https://www.dungeonfog.com/

## Common visual patterns across tools

- Strong readability first: clear square/edge boundaries and minimal icon set.
- Subtle texture overlay: low-contrast hatch/grain to avoid flat fills.
- Limited fantasy palette: mostly stone/slate base, with selective accent colors.
- Hierarchy by saturation: primary gameplay states get brighter colors, background stays muted.
- Handcrafted feel with procedural speed: random generation plus preset/template support.

## Design direction selected for this project

- Keep room/square UI simple and grid-first (no cluttered decorations).
- Add subtle per-square texture overlays to avoid flat-color cells.
- Keep existing semantic color states (entrance/exit/selected/wall) for gameplay clarity.
- Shift map container/room tile framing toward restrained fantasy tones.
- Support room generation from:
  - random dimensions/walls, and
  - data-file templates that define room size + wall shape masks.

## Generation strategy

- Mode `random`: original randomized dimensions and interior walls.
- Mode `template`: choose from data-file templates (size + shape rows).
- Mode `hybrid` (default): probabilistic mix of template and random generation.
- Configuration via environment variable: `ROOM_GENERATION_MODE=random|template|hybrid`.

