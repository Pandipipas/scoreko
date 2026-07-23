# Contributing to scoreko

First off, thank you for considering contributing to **scoreko**! It's people like you that make open source tools better for everyone in the fighting game community.

## Getting Started

1. Install [Node.js](https://nodejs.org) (v22+).
2. Clone this repository:
   ```bash
   git clone https://github.com/Pandipipas/scoreko.git
   ```
3. Install dependencies and build the bundle:
   ```bash
   cd scoreko
   npm ci
   npm run build
   ```

## Development Workflow

- `npm run watch`: Starts Vite and TypeScript in watch mode for rapid development.
- `npm run lint`: Validates project linting using ESLint.
- `npm run autofix`: Automatically fixes lint errors.
- `npm run schema-types`: Generates types from JSON schemas.
- `npx nodecg start`: Starts NodeCG.

## Making a Pull Request

1. Fork the repository and create your feature branch from `main`.
2. Write clean, readable code and follow the existing Quasar/Vue3 patterns.
3. Ensure your code passes all lint checks (`npm run lint`).
4. Update the documentation if you are adding a new feature.
5. Create a Pull Request using our standard template.
