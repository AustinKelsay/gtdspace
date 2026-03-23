# Quick Release Guide

Use this file as the short version. The canonical release workflow lives in [docs/release-process.md](docs/release-process.md).

## Recommended Command

```bash
npm run release
```

Use `npm run release:minor` or `npm run release:major` when needed.

## Before Running It

- Add `docs/releases/vX.Y.Z.md` for the version you are about to ship
- `npm run test:run`
- `npm run type-check`
- `npm run lint`
- `npm run build`
- `cd src-tauri && cargo test --bins --tests`
- `npm run tauri:dev` for a quick manual smoke test when needed

Preview the GitHub release body locally with:

```bash
npm run release:notes -- vX.Y.Z
```

Validate the full scripted flow without mutating the repo:

```bash
npm run release:major -- --dry-run
```

## Manual Version Scripts

If you need lower-level control:

```bash
npm run version:patch
npm run version:minor
npm run version:major
```

## Canonical Docs

- [docs/release-process.md](docs/release-process.md)
- [docs/build-setup.md](docs/build-setup.md)
- [docs/mac-signing-setup.md](docs/mac-signing-setup.md)
