# PROJECT KNOWLEDGE BASE

Current reference: 2026-10-03. Architecture and interfaces follow the current source, not historical phase reports.

## Overview and ownership

Tauri 2 desktop PO translator; React 19, TypeScript, Vite, Ant Design 6 and Rust 2024.

| Work                                                 | Entry                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| Desktop startup / command registration               | src-tauri/src/lib.rs::run; main.rs only delegates            |
| File lifecycle, save, translation, cancellation      | src/hooks/useTranslationFlow.ts                              |
| Document and editor drafts / stale-result protection | src/store/useTranslationStore.ts                             |
| Channel transport                                    | src/hooks/useChannelTranslation.ts; refs/callbacks only      |
| Config access                                        | src/hooks/useConfig.ts; separate SWR subscriptions           |
| Persistent backend settings                          | src-tauri/src/services/config_draft.rs; transaction only     |
| AI request protocols                                 | src-tauri/src/services/ai_translator.rs + model_config.rs    |
| Provider / price catalog                             | plugins/\*/plugin.toml; no dynamically compiled Rust plugins |
| TM / terminology                                     | services/translation_memory.rs and term_library.rs           |
| Theme runtime                                        | src/hooks/useTheme.ts::useThemeRuntime, once in AppShell     |
| Design tokens                                        | src/index.css                                                |
| Current documentation                                | docs/README.md, Architecture.md, API.md, DataContract.md     |
| Historical evidence and plans                        | docs/archive/; not current instructions                      |

Read src/AGENTS.md and src-tauri/src/AGENTS.md for scoped conventions. CLAUDE.md is a compatibility pointer, not a second rule source.

## Conventions

- No emoji in code/comments/CSS, empty catch blocks, CI `|| true`, third-party type shims, `as any`, `@ts-ignore` or `@ts-expect-error`.
- All UI strings use i18n. Default error messages in command services also use i18n.
- Design-token SSOT is src/index.css; do not redefine radius/shadow/duration/color tokens elsewhere.
- Use atomic Zustand selectors. Business flow owns session state; transport hooks do not duplicate it.
- Rust services prefer AppError and `?`; use parking_lot::RwLock. Avoid unwrap/expect outside explicitly allowed tests/startup boundary.
- Configuration mutations use ConfigDraft.transaction. Do not reintroduce draft/apply wrappers or a second state authority.
- IPC payloads use ts-rs generated types; regenerate from Rust, never hand-edit generated files.
- Replace superseded paths; do not add legacy wrappers. Reuse framework and project modules before adding abstractions.
- Async listener registration needs an active guard and late-registration cleanup.
- Use userEvent.setup in interaction tests; no fireEvent. Ant Design Modal supplies focus trapping.
- Prettier: 100 columns, single quotes, two spaces. Use PowerShell 7 on Windows.

## Validation commands

```powershell
npm run test:run
npm run test:scripts
npx tsc --noEmit
npm run i18n:check
npm run lint:all
cargo test --manifest-path src-tauri/Cargo.toml --locked --features ts-rs --quiet
cargo clippy --manifest-path src-tauri/Cargo.toml --locked --all-features --lib --bins -- -D warnings
npm run tauri:build -- --no-bundle
npm run tauri:portable
```

Run checks appropriate to the change; do not add tests that only mirror reversible low-impact edits. New recurring errors belong in docs/ERRORS.md. Do not infer actual desktop or provider behavior from mocks.

## Runtime boundaries

- PO is the main editor format. JSON supports detection/metadata; XLIFF/YAML metadata is explicitly unsupported.
- Translation batches are 1–25 inputs, with incremental Channel results and final-result compensation.
- AI results require review and explicit confirmation before TM learning; disk PO save is a separate operation.
- Save merges editor drafts; file switch/close cancels and waits, then handles unsaved work.
- TM/terms use revisions and atomic file replacement. No old-library migration layer.
- Provider keys are write-only through IPC, stored by stable ID in a separate local JSON file.
- Theme/language are Tauri-store preferences, not Rust AppConfig settings.
- Portable ZIP excludes user data and credentials. Native updater remains unregistered.
- Desktop E2E is a shell smoke test; do not describe it as full business-flow coverage.
