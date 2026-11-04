# Little Island

A small, peaceful 3D island game built with Three.js and React. Walk around a grassy island, explore its beach and little village, and collect twelve optional coins. There are no enemies, timers, or penalties.

## Features

- A visible character with a smooth following camera.
- Grassy terrain, a sandy beach, trees, rocks, and three little houses.
- Solid-object collisions and a forgiving shoreline boundary.
- Twelve collectible coins, with a reset option for a fresh adventure.
- Keyboard controls and on-screen movement buttons for smaller or touch screens.
- Reduced-motion support and clear loading/error messages.

## Controls

| Action | Control |
| --- | --- |
| Move | WASD or arrow keys |
| Jog | Hold Shift while moving |
| Reset the island and coins | R or **Reset island** |

The camera follows automatically. Houses are exterior scenery; their interiors are not enterable. Progress lasts for the current session and resets when the page reloads.

## Run locally

Install Node.js 22.13 or later, then run these commands in the project folder:

```sh
npm ci
npm run dev
```

Open the local URL printed in the terminal, normally `http://localhost:3000/`. Use a browser with WebGL 2 support and hardware acceleration enabled.

## Verify and build

```sh
node --test game.test.mjs
npx tsc --noEmit
npm run build
```

After building, `npm start` serves the production build locally through Wrangler.

The automated checks cover movement directions, diagonal speed, jogging, stopping, collisions, shoreline limits, frame-rate independence, paths to every coin, collection/reset state, and camera following. Desktop browser checks also verified rendering, movement, coin collection, house collisions, and both reset controls.

## Project structure

```text
app/world.mjs        Three.js scene, animation, input, and rendering
app/game-model.mjs   Movement, collision detection, coins, and camera logic
app/island-game.tsx  Game interface and controls
app/globals.css      Responsive interface styles
game.test.mjs       Gameplay checks using Node's built-in test runner
```

Built with Three.js, React, TypeScript, Vinext/Vite, Tailwind CSS, and shadcn/Base UI controls. The scenery is generated from geometry; no external artwork or game-asset downloads are needed.

The `.openai/hosting.json` file contains only a neutral hosting configuration. This source copy does not contain the original owner's Site identifier, login credentials, or runtime secrets. The existing hosted version has private access; publishing this repository does not change that access.
