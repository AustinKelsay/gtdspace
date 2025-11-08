# GTD Space

![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-blue)
![Tech Stack](https://img.shields.io/badge/Stack-Tauri%202.x%20%7C%20React%2018%20%7C%20Rust-orange)
![Version](https://img.shields.io/badge/Version-0.1.0-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

GTD Space is a GTD-first productivity desktop app built with Tauri, React, and Rust. Your entire workspace lives on your device (we bootstrap `~/GTD Space` or `%USERPROFILE%/GTD Space`), so every project, note, and habit stays local and private by default. Opt in to cloud features only when you need them.

## Why GTD Space

- Local-first privacy with instant file access and no background servers.
- GTD-native workspace that mirrors Horizons of Focus, projects, actions, habits, and references.
- WYSIWYG BlockNote editor with rich markdown, bidirectional title sync, and multi-tab writing.
- Integrated calendar that combines due dates, focus dates, habits, and Google Calendar events.
- Real-time automation (file watcher, smart notifications, content event system) to keep everything in sync.
- Cross-platform desktop build powered by Tauri for fast native performance.

## Private Sync & Backups

Need redundancy without giving up privacy? The new Git Sync & Backups feature encrypts your workspace before pushing to a remote Git repo (GitHub, GitLab, or any Git server). You get:

- **Private encrypted (free) cloud syncing** – bring your own free private repo and GTD Space handles encryption, so even the remote copy is unreadable without your key.
- **Manual control** – push and pull on demand, keeping local-first behavior while enabling multi-device workflows.
- **Automatic key management** – GTD Space stores the encryption secret locally and never transmits it.

See `docs/git-sync.md` for setup details, including key rotation, passphrase recovery, and CI-safe workflows.

## Feature Highlights

**Workflow** – Automatic GTD space detection, quick action/project creation, sidebar action rollups, and reference linking between Horizons.

**Editor** – WYSIWYG markdown, code highlighting (Shiki), interactive dropdown fields for status and effort, inline metadata chips, and auto-save with parallel writes.

**Calendar & Scheduling** – Weekly and monthly views, two-way Google Calendar sync, habit scheduling, event filtering, and duration heuristics based on effort sizing.

**Technical** – Native file operations, global search, theme switching, and encrypted git backups backed by Tauri commands.

## Quick Start

```bash
git clone https://github.com/AustinKelsay/gtdspace.git
cd gtdspace
npm install
npm run tauri:dev   # Spins up the desktop app and seeds your local GTD Space
```

Optional: add Google Calendar OAuth credentials to `.env` before running the app.

## Build & Test

- `npm run dev` – Vite frontend only
- `npm run tauri:dev` – Desktop shell with backend commands
- `npm run build` / `npm run preview` – Production bundle + preview
- `npm run lint` / `npm run lint:fix` – ESLint checks
- `npm run type-check` – TypeScript diagnostics
- `npm run vitest` – Unit/component tests

## Documentation

- `docs/installation.md` – Platform-specific setup
- `docs/architecture.md` – System overview
- `docs/GTD_IMPLEMENTATION.md` – Methodology deep dive
- `docs/calendar.md` – Calendar + Google integration
- `docs/git-sync.md` – Encrypted git syncing & backups
- `docs/settings.md` – Preferences and persistence

## Contributing

See `CONTRIBUTING.md` for guidelines, coding standards, and PR expectations.

## License

MIT License – see `LICENSE` for the full text.

## Acknowledgments

Built with [Tauri](https://tauri.app/), [React](https://react.dev/), [BlockNote](https://www.blocknotejs.org/), and [shadcn/ui](https://ui.shadcn.com/).
