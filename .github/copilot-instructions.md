# Copilot instructions for ai-game-dev-hub

## Build, test, and lint commands

- Install JS dependencies with `npm install`.
- Run the Electron + Vite dev app with `npm run dev`.
- Preview a built app with `npm run start`.
- Lint the repository with `npm run lint`.
- Format the repository with `npm run format`.
- Build renderer/main/preload bundles with `npm run build`.
- Create packaged builds with `npm run build:win`, `npm run build:mac`, `npm run build:linux`, or unpacked output with `npm run build:unpack`.
- Python helpers used by animation live in `python\`; install MediaPipe/OpenCV deps with `pip install -r python\requirements.txt`.
- There is currently no automated test script or test directory in this repository, so there is no full-suite or single-test command to run.

## High-level architecture

- This repo is an Electron app split across three layers: `src\main\index.js` owns native windows, filesystem access, external HTTP calls, browser automation, and Python subprocesses; `src\preload\index.js` exposes a curated `window.api`; `src\renderer\src\**` contains the React UI.
- The renderer is organized as workflow modules, not route-based screens. `src\renderer\src\App.jsx` switches between `animation`, `modeling`, `playground`, `sfx`, and `vfx`, and keeps a shared `workflowState` object so generated motion, character parts, and environment parts can move between modules without a separate state library.
- Animation is a hybrid cloud/local pipeline. `animation:textToMotion` in the main process calls Gradio / Hugging Face motion backends and downloads a BVH file, while `animation:videoToMotion` and `animation:exportFBX` run `python\pose_extractor.py` and `python\retargeter.py` to convert video into BVH and BVH into Roblox-ready FBX.
- Modeling is centered on Tripo website automation from the main process. `src\renderer\src\modules\Modeling\index.jsx` collects part prompts in the renderer, while `src\main\index.js` drives the Tripo browser session, captures downloads, and normalizes the resulting files for preview/import.
- Tripo website automation is a first-class architecture path, not a one-off helper. `src\main\index.js` keeps a dedicated persistent Electron session partition (`persist:tripo-web`), opens Tripo-specific `BrowserWindow` instances, inspects the DOM to detect login/generation surfaces, submits prompts, and captures downloads back into the app flow.
- `src\renderer\src\modules\Playground\index.jsx` is the integration surface for the product: it loads the shared animation result plus generated accessories/environment parts into a Three.js scene, retargets BVH motion onto the bundled R15 rig in `src\renderer\public\r15_rig.glb`, and uses `src\renderer\src\modules\Modeling\r15Utils.js` to attach accessories to Roblox-style anchor points.
- Python scripts are part of the application contract. The main process resolves them from `python\` in development and from `process.resourcesPath\python` in production, and long-running scripts report progress back over stdout so the renderer can stay responsive.

## Key conventions

- Keep privileged work behind IPC. Renderer code should call `window.api.*` from the preload bridge rather than importing Node APIs, spawning processes, or calling external services directly.
- Preserve the shared workflow handoff in `App`. Cross-module state belongs in `workflowState` and is updated through `setWorkflowState`; avoid introducing Redux, context-heavy indirection, or module-local copies for data that must flow into Playground.
- Treat Tripo browser-session automation as the only supported modeling path. Modeling changes should preserve the persistent Tripo web session flow instead of reintroducing alternate providers.
- Persist Tripo browser settings through `config:get` / `config:set`, which read and write `config.json` under Electron `userData`.
- Follow the existing long-running task pattern: main-process handlers emit `animation:progress` or `modeling:progress`, preload exposes subscription helpers, and renderer modules subscribe with cleanup in `useEffect`.
- Modeling outputs are previewed as data URLs, not by reading arbitrary files directly in the renderer. After generation, the renderer typically keeps both `outputPath` and a `dataUrl` created through `window.api.readFileAsDataURL`, and viewers / Playground consume that shape.
- Match the current renderer style before introducing abstractions. Most module screens are single JSX files with local state, inline style objects, and direct composition; there is no routing layer, component library, or centralized styling system beyond the global CSS entrypoint.
