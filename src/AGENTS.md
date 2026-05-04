# FRONTEND KNOWLEDGE BASE

## OVERVIEW

React 19 + Vite frontend for Tauri 2.x. Orchestrates translation state, IPC flow, and Catppuccin-themed UI. Public i18n namespace count: 14 (`app`, `menu`, `theme`, `entryList`, `editor`, `aiWorkspace`, `memoryManager`, `settings`, `common`, `messages`, `errors`, `errorBoundary`, `emptyState`, `devTools`).

## STRUCTURE

```
src/
├── components/
│   ├── aiWorkspaceSections/  # AIWorkspace sub-components (StatCard, SessionStats, etc.)
│   ├── entryListParts/       # EntryList sub-components (VirtualizedColumn, StatusColumns, BatchActions)
│   ├── editor/          # EditorPane sub-components (Source/TargetSection, Toolbar, StatusBar)
│   ├── settings/        # 5 tab components (AI/SystemPrompt/Appearance/Notification/Logs)
│   ├── ui/              # Reusable primitives (ActionButton, EmptyState, InfoCard, SectionHeader)
│   └── *.tsx            # Top-level components (MenuBar, TranslationWorkspace, Editor/EntryList orchestrators)
├── hooks/               # core + domain-specific hooks (see HOOK CATALOG)
├── store/               # 4 Zustand stores with atomic selectors
├── services/            # apiClient -> tauriInvoke -> invoke()
├── theme/config.ts      # Catppuccin palette + Antd ThemeConfig
├── i18n/                # react-i18next config + locale files
├── styles/              # accessibility.css (WCAG 2.1 AA)
├── types/               # 4 manual + 22 generated files (ts-rs)
├── utils/               # accessibility.ts (FocusTrap), formatters, logger, termAnalyzer
└── test/                # Vitest + jsdom (setup.ts, providers.tsx)
```

## WHERE TO LOOK

| Feature               | Location                                               | Notes                                              |
| :-------------------- | :----------------------------------------------------- | :------------------------------------------------- |
| 3-column layout       | `components/TranslationWorkspace.tsx`                  | Resizable panels                                   |
| Virtualized list      | `components/entryListParts/VirtualizedColumn.tsx`      | @tanstack/react-virtual                            |
| 3-column status group | `components/entryListParts/StatusColumns.tsx`          | Groups entries by status, renders 3 VirtualColumns |
| Batch actions toolbar | `components/entryListParts/BatchActions.tsx`           | Translate/confirm/refine selected                  |
| Entry selection state | `hooks/useEntrySelection.ts`                           | Set-based, with range select                       |
| AI workspace sub-UI   | `components/aiWorkspaceSections/*.tsx`                 | StatCard (supports `size="large"`), Stats, Term    |
| Editor term detection | `hooks/useTermDetection.ts`                            | Extracted from EditorPane                          |
| Lazy components       | `MemoryManager`, `SettingsModal`, `TermLibraryManager` | Code-split via Suspense                            |
| Logic engine          | `hooks/useTranslationFlow.ts`                          | 555 lines, updateQueue, uses `startTransition`     |
| Config access         | `hooks/useConfig.ts`                                   | SWR-based (useAppData, etc)                        |
| Streaming IPC         | `hooks/useChannelTranslation.ts`                       | Tauri Channel API                                  |
| IPC client            | `services/apiClient.ts`                                | Error handling, retries                            |
| IPC wrapper           | `services/tauriInvoke.ts`                              | Logging, sensitive masking                         |
| Design tokens (SSOT)  | `src/index.css`                                        | Never redefine in `App.css` or module CSS          |
| Theme config          | `src/theme/config.ts`                                  | `palette.needsReview` decoupled from `accent`      |
| Generated types       | `types/generated/`                                     | Auto-sync with Rust types (ts-rs)                  |

## STORE DESIGN

- **useAppStore**: Persistent. Theme, i18n language, window state.
- **useTranslationStore**: Session. `entries`, `currentEntry`, O(1) `entryIndexMap`, `sourceLanguage`, `targetLanguage` (file-scoped, downed from `useTranslationFlow` useState).
- **useSessionStore**: Session. Progress tracking, batch stats.
- **useStatsStore**: Persistent. Cumulative metrics via `tauriStore`.
- **Selection rule**: Always use atomic selectors (`useEntries()`, `useSourceLanguage()`, etc). Never `useStore()` bulk subscription.

## HOOK CATALOG

| Hook                    | Role                                                                            |
| :---------------------- | :------------------------------------------------------------------------------ |
| `useTranslationFlow`    | Aggregates file ops, translation execution, event listeners, progressive queue  |
| `useChannelTranslation` | Streaming batch translation via Tauri Channel API (destructure for stable refs) |
| `useConfig`             | Centralized SWR access (app config, AI configs, system prompt)                  |
| `useTheme`              | Theme mode + system preference + Antd theme config (used directly, no Context)  |
| `useTranslationMemory`  | TM fetch with event-driven refresh (has `isActive` race guard)                  |
| `useTermLibrary`        | Term library fetch (has `isActive` race guard)                                  |
| `useTermDetection`      | Term difference analysis + confirmation modal state (extracted from EditorPane) |
| `useEntrySelection`     | Selection state: set-based, range-select, keyboard-friendly                     |
| `useAsync`              | Generic async state helper                                                      |
| `useCssColors`          | CSS variable constants export (no Hook overhead)                                |
| `useSupportedLanguages` | Supported languages list from backend                                           |

### Hook Authoring Rules

1. **Hook rules compliance**: call hooks at top level only.
2. **Destructure unstable returns** in parent: if a hook returns a plain object (not memoized), destructure the functions you need to avoid re-creating `useCallback` on every render.
3. **Async listeners need `isActive` flag**: always guard `listen()` cleanup to prevent race on unmount (see `useTranslationFlow.ts` lines 173-200 for pattern).
4. **React 19 performance**: use `useDeferredValue` for filter inputs over large lists; wrap large list `setState` in `startTransition`.

## SERVICE LAYER

```
Component → apiClient.invoke()  (error UI feedback)
          → tauriInvoke()        (console log + PII masking)
          → invoke()              (Tauri IPC)
```

Never call `invoke()` directly from components.

## TESTING

- **Environment**: Vitest + jsdom.
- **Setup**: `src/test/setup.ts` (Tauri mocks, matchMedia, ResizeObserver).
- **Wrapper**: Use `renderWithProviders()` for store/SWR context.
- **Interaction**: Use `userEvent.setup()` — never `fireEvent`.

## CONVENTIONS

- Use `ts-rs` generated types for all IPC payloads.
- Lazy load `AIWorkspace`, `MemoryManager`, `SettingsModal`, `DevToolsModal`, `TermLibraryManager` to reduce main bundle.
- Atomic selectors for every Zustand store access.
- SWR for configuration and read-only app state.
- All user-visible strings via `t()` / `i18n.t()` — no hardcoded Chinese in `message.*()` or JSX.
- Design tokens: reference `--color-*` / `--radius-*` / `--shadow-*` / `--duration-*` from `index.css`; never redefine in component CSS modules.
- For class components needing i18n (e.g., `ErrorBoundary`), use `i18n.t()` static call from `src/i18n/config.ts`.

## ANTI-PATTERNS

- No `fireEvent` in component tests; use `userEvent`.
- No direct `invoke()` outside `tauriInvoke.ts`.
- No bulk store subscriptions (`const state = useStore()`).
- No manual editing of `src/types/generated/` files.
- No non-SWR data fetching for persistent app config.
- No hardcoded Chinese strings in `message.*()` or JSX children — always `t()`.
- No token redefinition in `App.css` or CSS modules — extend `index.css` only.
- No custom `FocusTrap` over Antd Modal (Antd v5+ has built-in trap).
- No async `listen()` without `isActive` cleanup guard.
- No destructuring hook return objects unless they're memoized — destructure functions instead.

## PERFORMANCE NOTES

- `useTranslationFlow` wraps large file `setEntries` in `startTransition` — keeps UI responsive on 5000+ entry PO files.
- `MemoryManager` search uses `useDeferredValue` on `searchText` — input stays smooth on large TMs.
- `EntryList` uses virtualization (`@tanstack/react-virtual`); rows recycle via `virtual-scroll-optimized` class (from `App.css`).
- Adaptive queue throttle in `useTranslationFlow` (50ms at 100+ queue, 300ms at <20) keeps rendering smooth during batch translation.
- Design tokens are CSS variables (no Hook overhead); `CSS_COLORS` constant exports `var(--color-xxx)` strings.
