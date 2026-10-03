# FRONTEND KNOWLEDGE BASE

React 19 + TypeScript + Vite + Ant Design 6. Current architecture: docs/Architecture.md.

## State and flow

- useTranslationStore owns the PO document, metadata, identity/version, per-entry versions and editor drafts.
- useSessionStore owns running/progress/session statistics; useStatsStore persists cumulative statistics.
- useAppStore owns theme, language and system appearance. No backend AppConfig mirror.
- useTranslationFlow orchestrates document lifecycle, translation, confirmation and cancellation.
- useChannelTranslation is transport-only: Run refs, callbacks, early cancellation and final-result compensation.
- useAppConfig/useModelConfiguration/useSystemPrompt subscribe separately through SWR. Use useActiveAIConfig for active-model-only consumers.
- Library hooks read TM/terms; managers hold independent revision-bound edit snapshots. Refresh must not overwrite dirty drafts.

## UI and theme

- Components orchestrate; extract domain logic into hooks and pure helpers.
- src/index.css is the design-token SSOT. src/theme/config.ts supplies Ant Design token objects.
- useTheme is pure state/actions. Only main AppShell owns useThemeRuntime global DOM/media/emit effects.
- Async listeners need active guards; unregister if registration resolves after unmount.
- All visible strings and service error messages use i18n. Dictionaries are zh-CN/en-US in the default translation namespace.
- Avoid custom focus traps over Ant Design Modal.
- Use deferred filters/virtualized lists for large displays; do not claim PO streaming reads.

## IPC and types

Component/hook → command service → apiClient/tauriInvoke → Tauri.
Never call the native invoke API from a component. Channel transport uses tauriInvoke directly.

Use generated Rust DTOs, including FileMetadata snake_case fields and nullable TermLibrary fields. Only frontend runtime extensions belong in manual types.
Do not maintain hand-written IPC mirrors, type shims, any casts or legacy wrappers.
Transport options that affect UI errors live in apiClient, not tauriInvoke.

## Testing

Vitest + jsdom; src/test/setup.ts provides Tauri/matchMedia/ResizeObserver mocks.
Use renderWithProviders and userEvent.setup. Theme controls requiring DOM effects must mount the single runtime boundary in their fixture.
Preserve protocol, document-version, save-snapshot, cancellation and revision-conflict assertions when refactoring.
Mock tests do not verify native window-close/notification behavior or actual provider billing.
