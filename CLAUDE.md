# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a professional PO file translation tool built with Tauri (Rust + React). The application provides AI-powered translation with advanced features like multiple AI providers, contextual refine, multi-language support, and comprehensive test coverage.

**Architecture**: Frontend (React + TypeScript + Ant Design) + Backend (Rust + Tauri)
**Primary Purpose**: Professional translation workflow for localization files with AI assistance
**Current Version**: Phase 9+ (2025-10 架构重构完成)
**Development Status**: Production Ready

### Core Features

- **Multi-AI Provider Support**: 8 AI services (Moonshot, OpenAI, iFlytek, Baidu, Alibaba, Zhipu, Claude, Gemini)
- **Custom System Prompts**: User-customizable translation prompts
- **Automated Testing**: 73 tests, 100% pass rate, 82.8% coverage
- **Multi-Format Files**: PO, JSON, XLIFF, YAML detection & metadata
- **Multi-Language Translation**: 10 languages with auto-detection
- **Application Localization**: System language detection, i18n support
- **Contextual Refine**: Context-aware fine-tuned translation
- **Performance Optimization**: Large file handling, progress throttling, memory optimization

### Architecture Enhancements (2025-10)

- **Unified Command Layer** (`commands.ts`): Type-safe Tauri command calls, 13 modular APIs
- **AppDataProvider**: Centralized data management with SWR integration
- **Draft Mode Config**: Atomic configuration updates with `parking_lot::RwLock`
- **Enhanced Event Bridge**: Debouncing, throttling, robust cleanup
- **Log Rotation**: Automatic log file management (size + count + retention)

## Development Commands

### Core Development

```bash
npm run tauri:dev      # Start development server (first run is slow due to Rust compilation)
npm run tauri:build    # Build production executable
npm run dev            # Frontend only (for UI development)
npm run build          # Build frontend only
npm run tauri clean    # Clean Rust build cache
```

### Testing & Code Quality

```bash
# Testing
npm run test           # Frontend tests with Vitest (watch mode)
npm run test:ui        # Vitest UI mode
npm run test:run       # Run tests once without watch
npm run test:coverage  # Run tests with coverage report
npm run test -- path/to/test.spec.ts  # Run specific test file
cd src-tauri && cargo test && cd ..   # Backend tests

# Code Quality
npm run format         # Format frontend code with Prettier
npm run format:check   # Check code format
npm run fmt            # Format Rust code
npm run lint:all       # Check all code format
```

### Troubleshooting

```bash
# Clear all caches and reinstall
rm -rf node_modules
npm install
cd src-tauri && cargo clean && cd ..

# If Rust compilation fails
rustup update stable
cd src-tauri && cargo clean && cd ..

# If frontend build fails
npm run build  # Build frontend only first
```

## Architecture Overview

### Frontend Structure (`src/`)

- **Components**: React components using Ant Design
  - `MenuBar.tsx` - Application toolbar with file operations
  - `EntryList.tsx` - PO file entries list with status indicators
  - `EditorPane.tsx` - Translation editor with AI assistance
  - `SettingsModal.tsx` - API configuration and settings
  - `TermLibraryManager.tsx` - Terminology library management
  - `MemoryManager.tsx` - Translation memory management
  - `AIWorkspace.tsx` - Advanced AI-powered workspace features
  - `ErrorBoundary.tsx` - Error boundary for error handling

- **Services**: Frontend service layer
  - `commands.ts` - **[NEW 2025-10]** Unified command layer, 13 modular APIs:
    - `configCommands`, `aiConfigCommands`, `aiModelCommands`
    - `systemPromptCommands`, `termLibraryCommands`, `translationMemoryCommands`
    - `translatorCommands`, `poFileCommands`, `fileFormatCommands`
    - `dialogCommands`, `i18nCommands`, `logCommands`, `systemCommands`
  - `api.ts` - **[DEPRECATED]** Old API layer (partially migrated to `commands.ts`)
  - `eventDispatcher.ts` - Type-safe event system inspired by UE
  - `statsEngine.ts` - Event sourcing for translation statistics
  - `formatters.ts` - Unified formatting utilities (cost, tokens, percentage)

- **Providers**: React Context providers
  - `AppDataProvider.tsx` - **[NEW 2025-10]** Centralized data management with SWR:
    - Global data access via `useAppData()` hook
    - Auto-refresh on backend events (config, term library, memory, etc.)
    - Unified `refreshAll()` interface

- **Hooks**: Custom React hooks
  - `useAppData` - **[NEW 2025-10]** Access global data from AppDataProvider
  - `useAsync` - Generic async operation handling (replaces `useTranslator`)
  - `useTauriEventBridge.enhanced.ts` - **[NEW 2025-10]** Enhanced event bridge with debouncing/throttling
  - `useTheme` - Theme management (light/dark/system)
  - `useEventListener` - Event system integration

- **Store**: Zustand state management
  - `useAppStore.ts` - Main application state with persistence for theme, language, and cumulative stats

- **Types**: TypeScript definitions
  - `tauri.ts` - Core types for PO entries, translations, stats, and configuration
  - `termLibrary.ts` - Terminology library specific types

### Backend Structure (`src-tauri/src/`)

- **Commands** (`commands/`): Tauri command handlers for frontend-backend communication
  - `translator.rs` - Translation operations (single/batch)
  - `mod.rs` - Command module organization

- **Services** (`services/`): Core business logic
  - `po_parser.rs` - PO file parsing and generation with nom parser
  - `ai_translator.rs` - AI translation integration (8 providers)
  - `translation_memory.rs` - Translation memory system (83+ built-in phrases, pattern matching)
  - `batch_translator.rs` - Batch translation (deduplication, progress tracking, event emission)
  - `config_manager.rs` - **[DEPRECATED]** Old configuration management
  - `config_draft.rs` - **[NEW 2025-10]** Draft mode configuration (atomic updates, `parking_lot::RwLock`)
  - `term_library.rs` - Terminology library management with style analysis
  - `mod.rs` - Service module organization

- **Utils** (`utils/`): Shared utilities
  - `draft.rs` - **[NEW 2025-10]** Generic Draft pattern implementation (from clash-verge-rev)
  - `logging.rs` - Structured logging with `flexi_logger` (rotation, cleanup, `wrap_err!` macro)
  - `init.rs` - **[NEW 2025-10]** Application initialization (portable mode, directories, logging)
  - `paths.rs` - Path and file system utilities (portable mode support)
  - `common.rs` - Common utilities and helper functions
  - `mod.rs` - Utility module organization

### Key Integration Points (Updated 2025-10)

**Four-Layer Architecture**:

```
Components → AppDataProvider → Command Layer → Tauri IPC → Rust Services
```

- **Command Layer** (`commands.ts`): Type-safe Tauri invocations, unified error handling
- **AppDataProvider**: Centralized data management, SWR caching, event-driven refresh
- **Enhanced Event Bridge**: Debouncing (500ms), throttling, auto-cleanup on unmount
- **Draft Mode Config** (`ConfigDraft`): Atomic updates with `parking_lot::RwLock`, auto-persist and event emission
- **Translation Pipeline**: PO parsing → TM lookup → AI translation → TM update → Event emission
- **Logging**: Structured logging with rotation (128KB per file, keep 8 files, retention days)

## Technology Stack

### Frontend

- React 18 + TypeScript
- Ant Design 5 (UI components)
- Zustand (state management)
- Vite (build tool)
- i18next (internationalization)

### Backend

- Tauri 2.x (desktop app framework)
- Rust Edition 2024 with Tokio (async runtime)
- reqwest (HTTP client for AI APIs)
- async-openai (OpenAI API client)
- serde (JSON serialization)
- flexi_logger (structured logging with rotation)
- parking_lot (高性能 RwLock for Draft mode)
- nom (PO file parsing)
- whatlang (language detection)
- sys-locale (system language detection)
- ts-rs (Rust-to-TypeScript type generation, optional)

### External Dependencies

- **AI Translation Providers** (8 supported):
  - Moonshot AI (primary, Chinese-optimized)
  - OpenAI (GPT series)
  - iFlytek Spark (讯飞星火)
  - Baidu Wenxin (百度文心一言)
  - Alibaba Tongyi (阿里通义千问)
  - Zhipu AI (智谱AI)
  - Anthropic Claude
  - Google Gemini
- Local file system for PO files and translation memory

## Development Guidelines (Updated 2025-10)

### Command Layer Usage

**Recommended Approach**:

```typescript
import { configCommands, aiConfigCommands, translatorCommands } from '@/services/commands';

// Preferred: Use command layer
const config = await configCommands.get();
await aiConfigCommands.add(newConfig);
const result = await translatorCommands.translateBatch(entries, targetLang);
```

**Deprecated**:

```typescript
// OLD: Direct API calls (partially deprecated)
import { configApi, translatorApi } from '@/services/api';
```

### Data Access via AppDataProvider

**Recommended Approach**:

```typescript
const { config, aiConfigs, termLibrary, refreshAll } = useAppData();

// Unified refresh
await refreshAll();
```

**What AppDataProvider provides**:

- `config` - Application configuration
- `aiConfigs` - AI provider configurations
- `activeAiConfig` - Currently active AI config
- `termLibrary` - Terminology library
- `translationMemory` - Translation memory
- `systemPrompt` - Custom system prompt
- `supportedLanguages` - Supported language list
- `refreshAll()` - Refresh all data

### Event System Integration

- `useTauriEventBridgeEnhanced` auto-integrates in AppDataProvider
- Supports debouncing/throttling (default 500ms)
- Auto-cleanup on component unmount
- Events forwarded to `eventDispatcher` for compatibility

### File Operations

- All PO file operations go through Rust backend (`po_parser.rs`)
- File dialogs handled by Tauri's filesystem API via `dialogApi`
- Translation memory automatically saves/loads from user data directory
- File state is managed through Zustand store with persistence

### AI Translation Integration

- Translation requests are batched and deduplicated for efficiency
- Translation memory serves 83+ built-in phrases with automatic pattern matching
- Both single-entry and batch translation modes supported
- Progress tracking via events for long-running batch operations
- Batch translation emits progress events and final statistics

### State Management

- Use Zustand stores for frontend state with selective persistence
- Keep state in sync with backend operations via events and API calls
- Handle async operations with `useAsync` hook for consistent loading/error states
- Theme, language, and cumulative statistics are persisted across sessions

### Logging and Debugging

- Rust backend uses structured logging with `tracing`
- Frontend logging available via `utils/logger` with module-based organization
- Development mode shows detailed logs in console
- Event system provides debugging capabilities through event history

### Configuration Management (Draft Mode)

**Backend (Rust)**:

```rust
// Read configuration (read-only access)
let draft = ConfigDraft::global().await;
{
    let config = draft.data(); // MappedRwLockReadGuard
    println!("API Key: {}", config.api_key);
} // Guard auto-released

// Modify configuration (atomic update)
let draft = ConfigDraft::global().await;
{
    let mut config = draft.draft(); // MappedRwLockWriteGuard
    config.ai_configs.push(new_config);
}
draft.apply()?; // Save to disk + emit event
```

**Frontend**:

```typescript
const { config, refreshAll } = useAppData();

// Modify and save
await configCommands.update(updatedConfig);
// AppDataProvider auto-refreshes on `config:updated` event
```

**Key Features**:

- Atomic updates (all-or-nothing)
- Concurrent-safe (`parking_lot::RwLock`)
- Auto-persist and event emission
- Global singleton pattern

## Common Tasks

### Adding New AI Providers

1. Update `ai_translator.rs` with new provider implementation
2. Add provider configuration to `config_manager.rs` and types
3. Update `configApi` in `services/api.ts` with new provider methods
4. Update settings modal UI for new provider options
5. Register new commands in `main.rs` if needed

### Extending Translation Memory

1. Modify `translation_memory.rs` for new phrase patterns
2. Update built-in phrases collection
3. Adjust matching algorithms if needed
4. Add new events to `eventDispatcher.ts` for memory changes
5. Update `translationMemoryApi` if new operations are needed

### Adding New File Format Support

1. Create parser service similar to `po_parser.rs`
2. Add Tauri commands for file operations in `commands/`
3. Update `poFileApi` in `services/api.ts` with new format methods
4. Add new events to `eventDispatcher.ts` for file operations
5. Update frontend components to handle new format
6. Update types in `types/tauri.ts` for new format structures

### Adding New Events

1. Define event type in `EventMap` in `eventDispatcher.ts`
2. Emit events from backend services or commands
3. Bridge Tauri events in `useTauriEventBridge.ts` if needed
4. Subscribe to events in components using `eventDispatcher.on()`
5. Add event types to `types/` if needed

### Adding New API Operations

1. Add Tauri command in `src-tauri/src/commands/`
2. Register command in `main.rs`
3. Add API method to appropriate module in `services/api.ts`
4. Add corresponding types in `types/`
5. Add events for progress/completion if async operation
6. Use `useAsync` hook in components for consistent async handling

## Performance Considerations

### File Handling (Phase 8)

- **Small files** (<10MB): Direct memory loading
- **Large files** (10-50MB): Automatic chunking with 500 entries/batch
- **Huge files** (>50MB): Optimized processing with 200 entries/batch
- File size analysis and warnings for large files
- Streaming support for future enhancements

### Translation Efficiency

- Batch translation with intelligent deduplication
- Translation memory lookup optimized for phrase patterns
- AI API requests deduplicated to avoid redundant calls
- Progress updates throttled to 100ms intervals for smooth UI

### Memory Management

- PO files parsed into memory (suitable for files ~5000 entries)
- LRU caching strategy for translation memory
- Automatic memory optimization for large operations

### Testing & Quality

- 73 automated tests (46 backend + 27 frontend)
- 100% test pass rate
- 82.8% code coverage
- Fast test execution (~14 seconds)

### Supported Languages (Phase 5)

The application supports translation to/from 10 major languages with automatic detection:

- English
- Chinese (Simplified & Traditional)
- Japanese
- Korean
- Spanish
- French
- German
- Russian
- Portuguese
- Arabic

## Important Project Files

### Documentation

- `README.md` - Project introduction and quick start
- `CLAUDE.md` - AI assistant guidance (this file)
- `docs/API.md` - **[UPDATED 2025-10]** API reference (command layer, AppDataProvider, Draft mode)
- `docs/Architecture.md` - **[UPDATED 2025-10]** Architecture overview (four-layer design)
- `docs/DataContract.md` - **[UPDATED 2025-10]** Data contracts (types, Draft mode flow)
- `docs/CHANGELOG.md` - **[UPDATED 2025-10]** Change history (architecture refactoring, log rotation)

### Configuration

- `package.json` - Frontend dependencies and scripts
- `src-tauri/Cargo.toml` - Backend dependencies and build config
- `vite.config.ts` - Vite build configuration
- `vitest.config.ts` - Test configuration
- `tsconfig.json` - TypeScript configuration

### Key Source Files (Updated 2025-10)

**Frontend**:

- `src/services/commands.ts` - **[NEW]** Unified command layer (13 modules, 52 commands)
- `src/providers/AppDataProvider.tsx` - **[NEW]** Centralized data provider (SWR + events)
- `src/hooks/useTauriEventBridge.enhanced.ts` - **[NEW]** Enhanced event bridge
- `src/services/eventDispatcher.ts` - Type-safe event system
- `src/store/useAppStore.ts` - Main application state

**Backend**:

- `src-tauri/src/main.rs` - Backend entry point (52 registered commands)
- `src-tauri/src/services/config_draft.rs` - **[NEW]** Draft mode configuration
- `src-tauri/src/utils/draft.rs` - **[NEW]** Generic Draft pattern (from clash-verge-rev)
- `src-tauri/src/utils/init.rs` - **[NEW]** Application initialization
- `src-tauri/src/services/ai_translator.rs` - AI translation engine
- `src-tauri/src/services/po_parser.rs` - PO file parser (nom-based)
