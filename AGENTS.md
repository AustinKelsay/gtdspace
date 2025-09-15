# Repository Guidelines

## Project Structure & Module Organization
- App code in `src/` (React + TypeScript): `components/`, `hooks/`, `utils/`, `lib/`, `types/`, `styles/`.
- Desktop backend in `src-tauri/` (Tauri + Rust): `Cargo.toml`, `src/`, `tauri.conf.json`.
- Static assets in `public/`; built output in `dist/`.
- Developer docs in `docs/`; scripts in `scripts/` (e.g., `icons-generate.mjs`).

## Build, Test, and Development Commands
- `npm run tauri:dev` — Run the full desktop app with hot reload.
- `npm run dev` — Start Vite dev server for the frontend only.
- `npm run build` — Type-check then build frontend to `dist/`.
- `npm run preview` — Serve production build locally.
- `npm run tauri:build` — Build installers/bundles for desktop targets.
- `npm run type-check` — TypeScript type checking.
- `npm run lint` / `npm run lint:fix` — ESLint check/auto-fix.
- Release helpers: `npm run release[:major|:minor|:patch]`.

## Coding Style & Naming Conventions
- Language: TypeScript, React 18, Vite. Indentation: 2 spaces; use semicolons.
- Components: `PascalCase` in `src/components` (e.g., `GTDProjectList.tsx`).
- Hooks: `useCamelCase` in `src/hooks` (e.g., `useGTDSpace.ts`).
- Utilities: kebab-case filenames in `src/utils` (e.g., `date-formatting.ts`).
- Styling: Tailwind CSS; shared CSS in `src/styles/`.
- Linting: ESLint config in `eslint.config.js` (TypeScript + React Hooks rules). No Prettier—defer to ESLint and TS.

## Testing Guidelines
- No automated tests are configured yet. Validate changes with:
  - `npm run type-check` and `npm run lint`.
  - Manual runs via `npm run tauri:dev` across platforms if possible.
- If adding tests, prefer Vitest + React Testing Library under `src/__tests__/` with `*.test.ts(x)` naming.

## Commit & Pull Request Guidelines
- Commits: imperative mood, concise scope, reference issues (e.g., `feat: add GTD calendar week view (#123)`).
- PRs: include purpose, screenshots for UI changes, steps to reproduce/test, and linked issues.
- Ensure `type-check` and `lint` pass; update docs in `docs/` when behavior changes.
- Releases: follow `RELEASING.md` and use `npm run release` to tag and trigger CI.

## Security & Configuration Tips
- Do not commit secrets. Use `.env` for `GOOGLE_CALENDAR_*` and related keys.
- Tauri CSP is strict by default; avoid introducing remote script/style origins without review.
- Sensitive platform code lives in `src-tauri/`; review capability changes in `src-tauri/capabilities/`.

