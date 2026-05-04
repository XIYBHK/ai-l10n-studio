# PROJECT KNOWLEDGE BASE

**Generated:** 2026-05-04
**Commit:** c96f4d2
**Branch:** main

## OVERVIEW

Tauri 2.x desktop app for AI-assisted PO file translation. React 19 + TypeScript frontend, Rust 2024 backend, pluggable AI provider system. Catppuccin-based visual language, i18n (zh-CN / en-US) with 14 namespaces.

## STRUCTURE

```
ai-l10n-studio/
├── src/                  # React frontend (see src/AGENTS.md)
├── src-tauri/
│   └── src/
│       ├── commands/     # 9 command modules (39 Tauri commands total)
│       └── services/     # 15 service modules + AI plugin subsystem
├── plugins/              # User-facing AI provider plugins (bundled as resources)
├── e2e-tests/            # Separate npm project (WebDriverIO + MidScene AI vision)
├── scripts/              # Build utilities (portable.js, check-unused-i18n.js)
└── docs/                 # Architecture, API, data contract, theme, color system
```

## WHERE TO LOOK

| Task                  | Location                                                                                | Notes                                                                    |
| --------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Add Tauri command     | `src-tauri/src/commands/` + register in `main.rs` + frontend wrapper in `src/services/` | 3-step process                                                           |
| Add AI provider       | `src-tauri/src/services/ai/providers/` + `models/` + register in `mod.rs`               | Trait-based plugin                                                       |
| Add React hook        | `src/hooks/`                                                                            | Follow `useTranslationFlow` pattern; extract UI logic early              |
| Extract logic from UI | Create a hook (see `useTermDetection`, `useEntrySelection` for reference)               | Keep components as orchestrators                                         |
| Add component         | `src/components/` + subdir pattern                                                      | `editor/`, `settings/`, `ui/`, `aiWorkspaceSections/`, `entryListParts/` |
| Add store state       | `src/store/`                                                                            | 4 stores by responsibility, atomic selectors required                    |
| Add design token      | `src/index.css` (SSOT)                                                                  | Never define tokens in `App.css` or component CSS                        |
| Add i18n key          | `src/i18n/locales/{zh-CN,en-US}.json`                                                   | 14 namespaces; run `npm run i18n:check` after                            |
| Fix translation bug   | `src-tauri/src/services/ai_translator.rs` or `batch_translator.rs`                      | Core engine                                                              |
| Fix UI bug            | `src/components/` + `src/hooks/`                                                        | Hook extracts logic, component renders                                   |
| Debug config          | `src-tauri/src/services/config_draft.rs`                                                | ConfigDraft read/draft/apply pattern                                     |
| Update error catalog  | `docs/ERRORS.md`                                                                        | Required when solving new errors                                         |

## CONVENTIONS

- **No emoji** in code, comments, or CSS (including `//🆕`)
- **No `|| true`** in CI scripts
- **No type shims** for third-party libraries
- **No `as any`**, `@ts-ignore`, `@ts-expect-error`
- **Design tokens SSOT = `src/index.css`** — never redefine `--radius-*` / `--shadow-*` / `--duration-*` elsewhere
- **All UI strings must go through i18n** — no hardcoded Chinese in `message.*()` or JSX text
- **Unified error type**: All Rust errors use `AppError` from `error.rs`
- **Rust concurrency**: `parking_lot::RwLock`, never `std::sync::RwLock`
- **Prettier**: 100-char line width, single quotes, 2-space indent
- **Clippy**: deny correctness/suspicious/panic/unimplemented; warn unwrap_used/expect_used
- **Replace, don't coexist**: Remove old code when adding new; no legacy wrappers
- **Single responsibility**: One function = one task; split if complex
- **Framework first**: Check existing modules before adding patches

## ANTI-PATTERNS (THIS PROJECT)

| Pattern                                           | Why forbidden                                         | Reference                       |
| ------------------------------------------------- | ----------------------------------------------------- | ------------------------------- |
| `catch(e) {}` empty blocks                        | Silent failures                                       | CLAUDE.md                       |
| `\|\| true` in CI                                 | Bypasses lint/test gates                              | docs/ERRORS.md                  |
| Type shim files (`*.d.ts` for libs)               | Destroys type inference                               | docs/ERRORS.md                  |
| `unwrap()` / `expect()` in Rust                   | Clippy warn; use `?` operator                         | Cargo.toml lints                |
| Direct `std::sync::RwLock`                        | Deadlock risk; use parking_lot                        | CLAUDE.md                       |
| `fireEvent` in tests                              | Use `userEvent.setup()` instead                       | Test conventions                |
| Hardcoded Chinese in `message.*()` / JSX          | Breaks en-US locale                                   | docs/COLOR_SYSTEM.md            |
| Redefining design tokens in multiple files        | Causes silent visual drift (same name, different val) | docs/COLOR_SYSTEM.md            |
| Custom focus trap over Antd Modal                 | Antd v5+ has built-in; double-trap conflicts          | src/utils/accessibility.ts      |
| Async listener without `isActive` flag            | Race condition on unmount                             | src/hooks/useTranslationFlow.ts |
| Destructuring unstable object in useCallback deps | Re-creates callback every render                      | P0 fix reference                |

## COMMANDS

```bash
# Dev
npm run tauri:dev          # Full stack dev (Vite + Rust, first run slow)
npm run dev                # Frontend only

# Test
npm run test:run           # Frontend unit tests (Vitest, single run)
cd src-tauri && cargo test --quiet  # Rust unit tests
npm run test:e2e           # E2E (builds debug binary + WebDriverIO)

# Quality
npm run format             # Prettier format
npm run fmt                # cargo fmt
npm run lint:all           # Check all formatting
npm run i18n:check         # Find unused i18n keys
npx tsc --noEmit           # Full-project TypeScript check

# Build
npm run tauri:build        # Production build
npm run tauri:portable     # Windows portable ZIP
```

## NOTES

- **First `tauri:dev`** compiles entire Rust toolchain; expect 2-5 minutes
- **TypeScript LSP**: Install `typescript-language-server` globally for OpenCode diagnostics support
- **Large PO files** (10MB+) auto-chunked at 500 entries per batch
- **Progress updates** throttled to 100ms; entries update via adaptive queue (50-300ms)
- **Big file loads** use `startTransition` to keep UI responsive
- **Translation memory search** uses `useDeferredValue` for non-blocking filter
- **E2E tests** Windows-only (tauri-driver + edgedriver)
- **MidScene AI vision tests** gated by `MIDSCENE_MODEL_API_KEY` env var
- **ConfigDraft** uses global singleton with RwLock; draft() returns mutable clone, apply() writes back
- **Channel API** for batch translation streams progress events (not polling)
- **4 CI workflows**: check (push/PR), ui-e2e (push main), build (manual), release (tag v\*)
