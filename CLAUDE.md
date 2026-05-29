# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install                          # Install JS dependencies
npm run dev                          # Start Electron + Vite dev server
npm run start                        # Preview built app
npm run lint                         # ESLint on src/, config files
npm run format                       # Prettier format
npm run build                        # Vite bundle (renderer/main/preload)
npm run build:win                    # Package Windows installer
npm run build:unpack                 # Unpacked build (useful for quick testing)
pip install -r python/requirements.txt  # Python deps (MediaPipe, OpenCV, NumPy, SciPy)
```

There is no test suite or test directory yet.

## Architecture

**Three-layer Electron app** using `electron-vite`:
- `src/main/index.js` (~4800 lines) — Main process: window management, IPC handlers, filesystem access, external HTTP calls, browser automation (Tripo, Manus, ChatGPT, ElevenLabs), Python subprocess spawning
- `src/preload/index.js` — Context bridge exposing `window.api` and `window.electron` to the renderer
- `src/renderer/src/` — React 19 + Tailwind CSS 4 + Three.js renderer

**Workflow modules, not routes.** `App.jsx` switches between these modules via `activeModule` state and shares `workflowState` across all of them:
- `Animation` — Text-to-motion (Gradio/Hugging Face backends → BVH) and video-to-motion (Python `pose_extractor.py` + `retargeter.py` → FBX)
- `Modeling` — 3D asset generation via Tripo web automation; parts list with reference images
- `Clothing` — Classic Roblox clothing texture generation (Replicate / GPT image APIs)
- `Playground` — Integration surface: loads animation results + generated parts into a Three.js scene with R15 rig (`src/renderer/public/r15_rig.glb`), retargets BVH motion, attaches accessories via `r15Utils.js`
- `SFX` — Audio generation (ElevenLabs TTS, Stable Audio)
- `VFX` — Roblox particle effect sequences, exports studio plugin bundle
- `UI` — UI asset generation
- `Settings` — Provider API keys and configuration

**Workflow state** is persisted via `config:get`/`config:set` IPC to `config.json` in Electron `userData`. `App.jsx` serializes/deserializes it, stripping non-serializable values (data URLs, Blobs). Cross-module state belongs in `workflowState`, not in a separate state library.

**Python scripts** are part of the application contract. Main process finds them at `python/` in dev, `process.resourcesPath/python` in production. Long-running scripts use a JSON-line protocol (`{type: "progress"|"result", ...}`) over stdout so the renderer stays responsive.

**Browser automation** is a first-class architecture path for Tripo, Manus, ChatGPT, and ElevenLabs. The main process uses dedicated persistent `session` partitions, opens separate `BrowserWindow` instances per service, inspects DOM to detect login/generation surfaces, and captures downloads back into the app flow.

## Conventions

- Renderer code must use `window.api.*` from the preload bridge — never import Node APIs, spawn processes, or call external services directly
- Module screens are single JSX files with local state and inline styles. No routing library, no component library, no centralized styling system beyond `globals.css`
- Keep the shared workflow handoff in `App`. Avoid introducing Redux or context-heavy indirection
- Tripo browser-session automation is the only supported modeling path
- Config keys are defined in `src/shared/configKeys.js` and persisted via `config:get`/`config:set`
- Long-running tasks follow the progress-event pattern: main emits `channel:progress`, preload exposes subscription helpers, renderer subscribes with cleanup in `useEffect`
- Modeling outputs are previewed as data URLs (created via `window.api.readFileAsDataURL`), not by reading files directly in the renderer
- Code style: single quotes, no semicolons, 100-char print width, trailing commas omitted (see `.prettierrc.yaml`)
- ESLint 9 flat config with React and Prettier plugins
