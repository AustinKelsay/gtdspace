# Repository Guidelines

## Project Structure & Module Organization

GTD Space is split between a React frontend in `src/` and a Tauri desktop backend in `src-tauri/`. The frontend organizes UI code into `components/`, stateful hooks in `hooks/`, shared logic in `utils/`, data contracts in `types/`, and Tailwind helpers in `styles/`. Desktop-specific Rust code, commands, and capability configs live under `src-tauri/src/` with project metadata in `Cargo.toml` and runtime settings in `tauri.conf.json`. Shared assets sit in `public/`, while production builds land in `dist/`. End-to-end and exploratory docs belong in `docs/`, and automation scripts (e.g., `icons-generate.mjs`) stay inside `scripts/`.

## Build, Test, and Development Commands

Use `npm run dev` for the Vite frontend and `npm run tauri:dev` when you need the full desktop shell. Run `npm run build` to type-check and emit optimized assets to `dist/`, and `npm run preview` to inspect that output. Desktop installers ship via `npm run tauri:build`. Lint with `npm run lint` or auto-fix via `npm run lint:fix`; `npm run type-check` validates pure TypeScript without bundling.

## Coding Style & Naming Conventions

Author React 18 components with TypeScript, two-space indentation, and semicolons. Component files in `src/components` use PascalCase, hooks in `src/hooks` use the `useThing` pattern, and utilities in `src/utils` adopt kebab-case filenames. Tailwind is the default styling approach; global overrides live in `src/styles`. ESLint (configured in `eslint.config.js`) governs formatting and React Hooks rules—there is no Prettier step.

## Testing Guidelines

Vitest with React Testing Library underpins unit and component coverage. Place specs in `/tests` with the `*.test.ts` or `*.test.tsx` suffix. Run suites through `npm run vitest` (watch) or `npm run test` (CI modes). Before opening a PR, pair automated tests with `npm run lint` and `npm run type-check`, and spot-check new UI through `npm run tauri:dev`.

## Commit & Pull Request Guidelines

Write imperative, scope-focused commit messages referencing issues when applicable, e.g., `feat: add GTD calendar week view (#123)`. Pull requests should outline motivation, include screenshots for UI-facing updates, note test coverage, and link issues. Confirm linting, type-checks, and relevant Vitest suites pass, and update `docs/` when behavior or workflows change.

## Security & Configuration Tips

Guard credentials: store API keys in `.env` and exclude from Git. Review any changes to `src-tauri/capabilities/` carefully, and avoid relaxing the default Tauri CSP without consultation. When integrating remote content, prefer local bundling to preserve offline operation and security posture.
