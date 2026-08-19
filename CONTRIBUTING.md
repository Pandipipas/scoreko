# Contributing to scoreko

First off, thank you for considering contributing to **scoreko**! It's people like you that make open source tools better for everyone in the fighting game community.

## 1. Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js**: v24 or later.
- **NodeCG**: v2.8 or later (installed globally via `npm install -g nodecg-cli`).
- **Git**: For version control.

## 2. Development Setup

Follow these steps to set up the project locally:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Pandipipas/scoreko.git
   ```

2. **Install dependencies:**
   Navigate into the project directory and install the necessary dependencies:
   ```bash
   cd scoreko
   npm ci
   ```

3. **Build the bundle (initial setup):**
   Run the initial build to generate types and compile assets:
   ```bash
   npm run build
   ```

4. **Running in Development Mode:**
   Start Vite and TypeScript in watch mode for rapid development:
   ```bash
   npm run watch
   ```
   Start NodeCG server:
   ```bash
   npx nodecg start
   ```

## 3. Project Structure

Scoreko is strictly divided into three environments, communicating via **Replicants** (state) and **Messages** (RPC):

- **`src/extension/` (Backend):** Node.js environment. Handles API calls (start.gg, challonge) and business logic.
- **`src/dashboard/` (UI Control):** Broadcaster interface. Built with Vue 3 + Quasar Framework.
- **`src/graphics/` (Overlays):** Overlays injected into OBS. Built with Vue 3 without Quasar (lightweight).
- **`src/shared/` & `src/browser_shared/`:** Shared TypeScript utilities and types.

## 4. Creating a New Skin

To create a new skin (overlay theme):

1. **Create the graphic file:** Add a new entry point and a `.vue` file in `src/graphics/` (e.g., `src/graphics/my-skin/main.vue` and `main.ts`).
2. **Register the graphic:** Edit `nodecg.json` to add your new graphic to the `graphics` array:
   ```json
   {
     "file": "my-skin.html",
     "width": 1920,
     "height": 1080
   }
   ```
3. **Build and test:** Restart your `npm run watch` process to compile the new graphic and test it in OBS or your browser.

## 5. Adding a New Game

To add a new game to the registry:
1. Define the game's metadata, characters, and assets in the `scoreko-packs` repository structure.
2. The scoreko wrapper will read from these packs. Ensure the game's `id` and character lists are correctly mapped in the JSON files within the pack.

## 6. Adding a New Bracket Integration

1. Create a new module in `src/extension/` or related integration folder.
2. Implement the required API calls to fetch bracket data (e.g., from start.gg or Challonge).
3. Update the Replicants related to bracket information so the dashboard and graphics can react to the new data source.
4. Add the necessary UI components in `src/dashboard/` to allow users to input API keys or tournament URLs.

## 7. Code Style

We follow strict coding conventions to maintain quality:
- **ESModules in Backend:** The backend runs in pure Node ESM mode (`NodeNext`). Any relative imports between TypeScript files in `src/extension/` MUST use the `.js` extension (e.g., `import { helper } from './util/helper.js';`).
- **Vue Composition API:** Use `<script setup lang="ts">` extensively.
- **Entry Points:** Main Vue entry points in NodeCG should be named `main.vue` and `main.ts`.
- **State Management:** Use NodeCG Replicants as the base state. Use Pinia stores (in `stores/`) for complex data derivation or actions in the frontend.
- **Formatting & Linting:** Run `npm run lint` and `npm run autofix` before submitting code.

## 8. Submitting Changes

1. **Branch Naming:** Create your feature branch from `dev` (e.g., `feature/my-new-feature` or `fix/issue-description`).
2. **Commit Format:** We strictly follow **Conventional Commits** (`feat(scope): ...`, `fix(scope): ...`, `docs: ...`, etc.).
3. **Pull Requests:** Open a Pull Request against the `dev` branch. Fill out the provided PR template.

Thank you for contributing!
