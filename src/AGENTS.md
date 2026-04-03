# FRONTEND KNOWLEDGE BASE

## OVERVIEW

React 19 + Vite frontend for Tauri 2.x. Orchestrates translation state and IPC flow.

## STRUCTURE

```
src/
├── components/       # editor/, settings/, ui/ subdirs (18 top-level)
├── hooks/            # core logic (useTranslationFlow, useConfig)
├── store/            # 4 Zustand stores with atomic selectors
├── services/         # apiClient -> tauriInvoke -> invoke()
├── types/            # 4 manual + 22 generated files (ts-rs)
└── test/             # Vitest + jsdom (setup.ts, providers.tsx)
```

## WHERE TO LOOK

| Feature          | Location                              | Notes                       |
| :--------------- | :------------------------------------ | :-------------------------- |
| 3-Column Layout  | `components/TranslationWorkspace.tsx` | Resizable panels            |
| Virtualized List | `components/EntryList.tsx`            | @tanstack/react-virtual     |
| Lazy Components  | `AIWorkspace`, `DevToolsModal`        | Code split point            |
| Logic Engine     | `hooks/useTranslationFlow.ts`         | 550 lines, updateQueue      |
| Config Access    | `hooks/useConfig.ts`                  | SWR-based (useAppData, etc) |
| Streaming IPC    | `hooks/useChannelTranslation.ts`      | Tauri Channel API           |
| IPC Client       | `services/apiClient.ts`               | Error handling, retries     |
| IPC Wrapper      | `services/tauriInvoke.ts`             | Logging, sensitive masking  |
| Generated Types  | `types/generated/`                    | Auto-sync with Rust types   |

## STORE DESIGN

- **useAppStore**: Persistent. Theme, language, window state.
- **useTranslationStore**: Session. Entries, navigation, O(1) entryIndexMap.
- **useSessionStore**: Session. Progress tracking, batch stats.
- **useStatsStore**: Persistent. Cumulative metrics via tauriStore.
- **Selection**: Always use atomic selectors (e.g., `state => state.entries`).

## HOOK CONVENTIONS

- **useTranslationFlow**: Aggregates file ops, entry management, translation.
- **updateQueue**: Progressive rendering for large PO file performance.
- **useConfig**: Centralized SWR data access for app/AI configurations.
- **useChannelTranslation**: Direct handler for streaming batch translation events.

## SERVICE LAYER

1. `apiClient.ts`: High-level. Handles errors, feedback, and retry logic.
2. `tauriInvoke.ts`: Middleware. Console logging and PII masking.
3. `invoke()`: Low-level Tauri IPC calls.

## TESTING

- **Environment**: Vitest + jsdom.
- **Setup**: `src/test/setup.ts` (Tauri mocks, matchMedia, ResizeObserver).
- **Wrapper**: Use `renderWithProviders()` for store/SWR context.
- **Interaction**: Use `userEvent.setup()` instead of `fireEvent`.

## CONVENTIONS

- Use `ts-rs` generated types for all IPC payloads.
- Lazy load AIWorkspace and DevToolsModal to reduce main bundle.
- Atomic selectors required for every Zustand store access.
- SWR for all configuration and read-only app state.

## ANTI-PATTERNS

- No `fireEvent` in component tests; use `userEvent`.
- No direct `invoke()` outside `tauriInvoke.ts`.
- No bulk store subscriptions (`const state = useStore()`).
- No manual editing of `src/types/generated/` files.
- No non-SWR data fetching for persistent app config.
