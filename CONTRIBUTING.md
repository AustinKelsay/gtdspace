# Contributing to GTD Space

Thanks for helping improve GTD Space! This document outlines how to propose changes, the coding standards we follow, and what to expect during reviews.

## Getting Started

1. **Discuss first** – Open a GitHub issue or discussion to describe the problem/idea. This prevents duplicate work and lets maintainers provide early guidance.
2. **Fork & branch** – Fork the repo (or create a feature branch if you have write access) using a descriptive branch name such as `feat/inbox-filters` or `fix/sidebar-layout`.
3. **Local setup**

   ```bash
   npm install
   npm run tauri:dev   # full desktop shell (frontend + Rust backend)
   npm run dev         # frontend-only Vite server when backend changes aren't needed
   ```

4. **Before pushing** – Run `npm run lint`, `npm run type-check`, and any relevant `npm run vitest` suites.

## Coding Standards

- **Tech stack** – React 18 + TypeScript + Tauri (Rust). Prefer functional components and hooks.
- **Style** – Two-space indentation, semicolons enabled via ESLint (`eslint.config.js` is the source of truth). No Prettier step.
- **File naming** – Components in `src/components` use PascalCase; hooks in `src/hooks` use `useThing`; utilities in `src/utils` use kebab-case; Tailwind helpers live in `src/styles`.
- **Tailwind first** – Reach for Tailwind classes; only touch global CSS in `src/styles` when utility classes can’t handle the use-case.
- **State & logic** – Share cross-component logic via hooks (`src/hooks`) or utilities (`src/utils`). Keep complex command-layer changes mirrored in `src-tauri/`.

## Testing & Quality Checklist

- `npm run lint` – ESLint (React Hooks + TypeScript rules)
- `npm run type-check` – TypeScript no-emit diagnostics
- `npm run vitest` or `npm run test` – Unit/component suites
- Manual verification in `npm run tauri:dev` for UX-facing changes
- Update or add docs under `docs/` whenever UX or workflows change

## Commit Messages

Follow the conventional prefix used in this repo: `type: summary (#issue)`. Examples:

- `feat: add weekly habit focus view (#245)`
- `fix: resolve sidebar selection regression`
- `docs: clarify git sync setup`

Use imperative mood, keep scope focused, and reference an issue/PR number when available.

## Pull Request Expectations

1. Describe motivation, screenshots (for UI changes), and testing performed.
2. Confirm lint/type-check/tests were executed.
3. Reference related issues (e.g., `Fixes #123`).
4. Keep changes narrowly scoped; split large features into multiple PRs when possible.

## Code Review Process

- Reviews prioritize correctness, security, and UX consistency.
- Address comments with additional commits (avoid force-push over reviewer history unless requested).
- Mark threads as “resolved” only after implementing or explicitly deferring with maintainer approval.

## Contact / Maintainers

- Primary maintainer: [@AustinKelsay](https://github.com/AustinKelsay)
- Best way to reach us: open a GitHub issue or start a Discussion thread.
- For sensitive disclosures (security, private data), email the maintainer via the address listed on their GitHub profile and mention “GTD Space”.

Thanks again for contributing!
