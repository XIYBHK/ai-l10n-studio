# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a professional PO file translation tool built with Tauri (Rust + React). The application provides AI-powered translation with advanced features like multiple AI providers, contextual refine, multi-language support, and comprehensive test coverage.

**Architecture**: Frontend (React + TypeScript + Ant Design) + Backend (Rust + Tauri)
**Primary Purpose**: Professional translation workflow for localization files with AI assistance
**Current Version**: Phase 8 完成（8/8 Phases, 87.5% Complete）
**Development Status**: Production Ready

### Key Features (Phase 1-8)

- ✅ **Multi-AI Provider Support** (Phase 1): 8 AI services (Moonshot, OpenAI, iFlytek, Baidu, Alibaba, Zhipu, Claude, Gemini)
- ✅ **Custom System Prompts** (Phase 2): User-customizable translation prompts
- ✅ **Automated Testing** (Phase 3): 73 tests, 100% pass rate
- ✅ **Multi-Format Files** (Phase 4): PO, JSON, XLIFF, YAML detection & metadata
- ✅ **Multi-Language Translation** (Phase 5): 10 languages with auto-detection
- ✅ **Application Localization** (Phase 6): System language detection, i18n support
- ✅ **Contextual Refine** (Phase 7): Context-aware fine-tuned translation
- ✅ **Performance Optimization** (Phase 8): Large file handling, progress throttling, memory optimization

## Development Commands

### Core Development

```bash
# Start development server (first run is slow due to Rust compilation)
npm run tauri:dev

# Build production executable
npm run tauri:build

# Frontend only (for UI development)
npm run dev

# Build frontend only
npm run build

# Clean Rust build cache
npm run tauri clean
```

### Testing Commands

```bash
# Run all tests (frontend + backend)
npm run test           # Frontend tests with Vitest
npm run test:ui        # Vitest UI mode
npm run test:run       # Run tests once without watch
npm run test:coverage  # Run tests with coverage report

# Backend tests
cd src-tauri && cargo test && cd ..

# Run specific test file
npm run test -- path/to/test.spec.ts
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
  - `api.ts` - Unified Tauri API wrapper with error handling, logging, and organized API modules
    - `termLibraryApi` - Terminology library operations
    - `translationMemoryApi` - Translation memory operations
    - `poFileApi` - PO file parsing and saving
    - `configApi` - Application configuration
    - `translatorApi` - AI translation (single and batch)
    - `dialogApi` - File dialogs
    - `logApi` - Application logs
  - `eventDispatcher.ts` - Type-safe event system inspired by UE, handling:
    - Translation lifecycle events (progress, stats, completion)
    - File operation events (load, save, error)
    - Terminology library events (add, remove, update)
    - UI events (entry selection, updates)
    - Configuration events

- **Hooks**: Custom React hooks
  - `useTranslator.ts` - Translation operations (deprecated, use useAsync + API directly)
  - `useTauriEventBridge.ts` - Bridges Tauri backend events to frontend event dispatcher
  - `useAsync.ts` - Generic async operation handling
  - `useTheme.ts` - Theme management
  - `useEventListener.ts` - Event system integration

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
  - `ai_translator.rs` - AI translation integration (Moonshot/OpenAI)
  - `translation_memory.rs` - Translation memory system with 83+ built-in phrases and pattern matching
  - `batch_translator.rs` - Batch translation with deduplication, progress tracking, and event emission
  - `config_manager.rs` - Application configuration management with validation
  - `term_library.rs` - Terminology library management with style analysis
  - `mod.rs` - Service module organization

- **Utils** (`utils/`): Shared utilities
  - `logger.rs` - Structured logging system with tracing
  - `common.rs` - Common utilities and helper functions
  - `paths.rs` - Path and file system utilities
  - `mod.rs` - Utility module organization

### Key Integration Points

- **Tauri Commands**: All backend operations exposed through Tauri's invoke system with unified error handling
- **Event System**: Type-safe event dispatcher bridges backend events to frontend components
- **API Layer**: Centralized API wrapper with consistent error handling, logging, and organization
- **State Management**: Zustand store synchronized with backend operations via events and API calls
- **Translation Pipeline**: PO parsing → TM lookup → AI translation → TM update → Event emission
- **Configuration**: JSON-based config stored in user data directory with validation
- **Logging**: Structured logging system spanning both frontend and backend

## Technology Stack

### Frontend

- React 18 + TypeScript
- Ant Design 5 (UI components)
- Zustand (state management)
- Vite (build tool)
- i18next (internationalization)

### Backend

- Tauri 2.x (desktop app framework)
- Rust with Tokio (async runtime)
- reqwest (HTTP client for AI APIs)
- async-openai (OpenAI API client)
- serde (JSON serialization)
- tracing (logging system)
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

## Development Guidelines

### API Usage

- Use the centralized API services from `services/api.ts` instead of direct Tauri invoke calls
- All API calls have built-in error handling, logging, and user feedback
- Prefer `useAsync` hook + API functions over specialized hooks (like `useTranslator`)
- API modules are organized by feature: `termLibraryApi`, `translationMemoryApi`, `poFileApi`, etc.

### Event System Integration

- Subscribe to events via `eventDispatcher` for type-safe event handling
- Use `useTauriEventBridge` to bridge backend events to frontend
- Events cover translation lifecycle, file operations, terminology changes, and UI updates
- Event history is available for debugging with `eventDispatcher.getEventHistory()`

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

### Configuration Management

- API keys and settings stored in Tauri's app data directory
- Use `configApi` for all configuration operations with validation
- Configuration changes are persisted immediately
- Validation prevents invalid API configurations from being used

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
- `ARCHITECTURE_OVERVIEW.md` - Detailed architecture documentation
- `API_REFERENCE_V2.md` - Complete API reference
- `QUICK_API_REFERENCE.md` - Quick API lookup
- `FEATURES_STATUS.md` - Feature completion status
- `docs/` - Comprehensive documentation folder
  - `docs/README.md` - Documentation index
  - `docs/QUICK_START.md` - 5-minute quick start guide
  - `docs/DEVELOPMENT_GUIDE.md` - Complete development tutorial
  - `docs/TEST_COVERAGE_STATUS.md` - Test coverage report
  - `docs/PHASE*_COMPLETION_SUMMARY.md` - Phase completion reports

### Configuration

- `package.json` - Frontend dependencies and scripts
- `src-tauri/Cargo.toml` - Backend dependencies and build config
- `vite.config.ts` - Vite build configuration
- `vitest.config.ts` - Test configuration
- `tsconfig.json` - TypeScript configuration

### Key Source Files

- `src/services/api.ts` - Centralized API layer (13 modules)
- `src/services/eventDispatcher.ts` - Type-safe event system
- `src/store/useAppStore.ts` - Main application state
- `src-tauri/src/main.rs` - Backend entry point (52 registered commands)
- `src-tauri/src/services/ai_translator.rs` - AI translation engine
- `src-tauri/src/services/po_parser.rs` - PO file parser (nom-based)
