# NEON STREETS / 霓虹街区

A browser-based third-person street-fighting prototype built with Three.js and Vite.

## Current prototype
- Procedurally generated compact city block
- Third-person camera and keyboard movement
- Five basic enemy AI fighters
- Light combo attacks, dodge, block and health/XP HUD
- Touch joystick and action buttons for mobile browsers
- GitHub Actions workflow for GitHub Pages

## Controls
- `W A S D` / arrow keys: move
- `Shift`: sprint
- Mouse: rotate camera (click the game to lock pointer)
- Left mouse / `J` / `Enter`: attack
- `Space`: dodge
- `K`: hold to block
- `Esc`: release pointer lock

On touch devices, use the virtual joystick and on-screen buttons.

## Run locally
Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Build
```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages
1. Push this repository to GitHub with the default branch named `main`.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, select **GitHub Actions** as the source.
4. Push to `main` or run the workflow manually from **Actions**.
5. The deployment job publishes the `dist/` folder.

The Vite `base: './'` setting supports GitHub project-site paths.

## Roadmap
1. Replace procedural placeholder fighters/buildings with licensed or original high-quality assets.
2. Add animation state machine, hit reactions, lock-on targeting and combat balancing.
3. Add missions, dialogue, inventory, shops and multiple connected districts.
4. Add graphics settings, quality presets, audio and save slots.
5. Profile and optimize desktop/mobile performance.

## Credits and licenses
The prototype code is MIT-licensed. Third-party models, textures and audio must be added only with compatible licenses and credited individually.