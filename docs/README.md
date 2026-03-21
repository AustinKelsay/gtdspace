# Documentation Index

This repository keeps the canonical GTD rules in `spec/` and the supporting implementation docs in `docs/`.

If a doc conflicts with code or tests, the code and tests win.

## Start Here

- [`../README.md`](../README.md): project overview and top-level links
- [`../spec/gtd-spec.md`](../spec/gtd-spec.md): canonical GTD behavior and markdown rules
- [`installation.md`](./installation.md): contributor setup and local development
- [`build-setup.md`](./build-setup.md): build prerequisites and packaging expectations
- [`architecture.md`](./architecture.md): current runtime boundaries and data flow

## GTD System

- [`GTD_IMPLEMENTATION.md`](./GTD_IMPLEMENTATION.md): high-level GTD product overview
- [`gtd-data-model.md`](./gtd-data-model.md): data model, file shapes, and data flow
- [`markdown.md`](./markdown.md): markdown pipeline and GTD marker storage
- [`data-migration.md`](./data-migration.md): legacy marker and content migrations
- [`horizon-readme-template.md`](./horizon-readme-template.md): canonical horizon overview template

## Runtime And UI

- [`content-events.md`](./content-events.md): content event bus behavior
- [`hooks.md`](./hooks.md): hook inventory and responsibilities
- [`settings.md`](./settings.md): settings model, persistence, and startup usage
- [`tauri.md`](./tauri.md): Tauri command surface, backend command modules, and frontend/backend integration
- [`blocknote.md`](./blocknote.md): editor integration and custom block system
- [`theming.md`](./theming.md): theme tokens and styling conventions
- [`git-sync.md`](./git-sync.md): encrypted git backup and sync workflow

## Page Templates

- [`project-page-template.md`](./project-page-template.md)
- [`action-page-template.md`](./action-page-template.md)
- [`habit-page-template.md`](./habit-page-template.md)
- [`area-page-template.md`](./area-page-template.md)
- [`goal-page-template.md`](./goal-page-template.md)
- [`vision-page-template.md`](./vision-page-template.md)
- [`purpose-page-template.md`](./purpose-page-template.md)

Use these when changing canonical page builders or page-specific UI. For exact GTD schema rules, cross-check against [`../spec/02-markdown-schema.md`](../spec/02-markdown-schema.md).

## Field-Level References

- [`singleselect-fields.md`](./singleselect-fields.md)
- [`multiselect-fields.md`](./multiselect-fields.md)
- [`datetime-fields.md`](./datetime-fields.md)

These are implementation references for specific marker families. They are secondary to the spec and page-template docs.

## Build And Release

- [`release-process.md`](./release-process.md): canonical release workflow
- [`icon-generation.md`](./icon-generation.md): icon generation notes
- [`mac-signing-setup.md`](./mac-signing-setup.md): macOS signing and notarization setup

## Historical Notes

- [`dashboard-refactor.md`](./dashboard-refactor.md): historical dashboard refactor notes
- [`horizon-readme-plan.md`](./horizon-readme-plan.md): historical horizon README planning notes
- [`../RELEASE_SETUP_COMPLETE.md`](../RELEASE_SETUP_COMPLETE.md): initial release-pipeline setup snapshot

Prefer `spec/` for canonical behavior and use the rest of the docs as implementation context.
