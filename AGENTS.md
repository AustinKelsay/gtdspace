# Repository Guidelines

## Structure
- React frontend lives in `src/`.
- Tauri backend and capabilities live in `src-tauri/`.
- Shared assets live in `public/`; longer docs live in `docs/`; scripts live in `scripts/`.

## Commands
- `npm run dev`
- `npm run tauri:dev`
- `npm run build`
- `npm run preview`
- `npm run lint`
- `npm run type-check`
- `npm run test`

## Verification
- Baseline for code changes: `npm run type-check`, `npm run lint`, and `cd src-tauri && cargo fmt --check && cargo clippy -- -D warnings`.
- If you touch app integration flows, run `npx vitest run tests/app.integration.spec.tsx`.
- If you touch MCP settings or settings validation, run `npx vitest run tests/settings-validation.spec.ts`.
- If you touch dashboard actions, overview, or projects, run `npx vitest run tests/dashboard-actions.component.spec.tsx tests/dashboard-projects.component.spec.tsx tests/date-formatting.spec.ts`.
- If you touch Rust settings parsing, workspace resolution, or MCP server paths, run the targeted `cargo test --manifest-path ...` commands already documented in the repo and rerun them after any formatter rewrite.

## PR Rules
- Use scope-focused imperative commits.
- Include screenshots for UI changes and note relevant test coverage.
- Unless instructed otherwise, attempt to run the CodeRabbit CLI on unstaged changes before committing and pushing.

## Security
- Keep API keys in `.env`.
- Review `src-tauri/capabilities/` and CSP changes carefully.
