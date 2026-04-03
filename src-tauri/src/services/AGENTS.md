# SERVICES KNOWLEDGE BASE

**Location:** src-tauri/src/services/ | **Target:** Internals and AI plugin architecture.

## OVERVIEW

Core service layer managing AI translation orchestration, configuration drafts, and file processing.

## SERVICE MAP

### Core Translation

- **ai_translator.rs**: Core engine. Abstracts AI provider calls and message formatting.
- **batch_translator.rs**: Batch orchestrator. Uses Channel API for progress events and throttling.
- **translation_task.rs**: Individual task tracking with cancellation support and error retry logic.

### Configuration

- **config_draft.rs**: ConfigDraft singleton with RwLock for thread-safe runtime modifications.
- Pattern: `read()` -> `draft()` (clone) -> `modify` -> `apply()` (persist to disk).
- Global access via `ConfigDraft::global()` for unified configuration across command modules.

### File Processing

- **po_parser.rs**: nom-based PO parsing for speed, reliability, and comment preservation.
- **file_chunker.rs**: Large file handler (>10MB). Splits into 500 entries per batch for efficiency.
- **file_format.rs**: Format detection (PO, JSON, XLIFF, YAML) and metadata extraction.

### AI Integration (ai/)

- **provider.rs**: Defines `AIProvider` trait for plugin implementations and registry management.
- **plugin_loader.rs**: Runtime loader for `plugins/` directory resources using Tauri's fs API.
- **plugin_config.rs**: Per-plugin configuration management and secret key handling.
- **cost_calculator.rs**: Token-based cost estimation for budget tracking and reporting.
- **model_info.rs**: Capability, rate limit, and pricing metadata for specific AI models.

### Translation Support

- **translation_memory.rs**: TM with 83+ built-in phrases. 9 criteria used for hit detection.
- **term_library.rs**: Context-aware terminology enforcement for consistent translation quality.
- **prompt_builder.rs**: Constructs system prompts from global settings, terminology, and memory.
- **language_detector.rs**: Source and target language identification using n-gram analysis.

### Infrastructure

- **batch_progress_channel.rs**: Progress event streaming to frontend via Tauri event system.
- **translation_stats.rs**: Token usage, cost statistics, and performance metric collector.
- **prompt_logger.rs**: Debugging log for AI interactions and request/response history.

## AI PLUGIN SYSTEM

### Providers

- 6 implementations: openai, moonshot, deepseek, gemini-ai, minimax, and zhipu.
- Bundled as external resources in `plugins/`. Trait-based abstraction in `ai/provider.rs`.
- Dynamic discovery at startup allows user-provided plugins without recompilation.
- Each plugin implements the common `AIProvider` interface for seamless integration.

### Model Registries (ai/models/)

- Provider-specific registries: `openai.rs`, `moonshot.rs`, `deepseek.rs`, `minimax.rs`, `zhipuai.rs`.
- Manages model names, max tokens, context windows, and function calling support.
- Externalized model registries allow updates without core backend changes.

## KEY PATTERNS

- **Singleton Config**: `ConfigDraft::global()` provides unified state across all threads.
- **Progress Streaming**: Channel-based event emission ensures smooth UI updates without polling.
- **Concurrency**: `parking_lot::RwLock` used for all thread-safe global states and cache layers.
- **Chunking**: Atomic batch processing prevents memory spikes on large translation files.

## DATA FLOW

1. `BatchTranslator.translate_batch()` starts the orchestration flow.
2. `ConfigDraft::global()` fetches the active AI provider and model settings.
3. `AITranslator::new()` initializes the translation engine with current context.
4. `POParser::parse()` loads file entries into the internal data model.
5. TM lookup -> Deduplicate entries -> AI translation call via provider trait.
6. `BatchProgressEvent` emitted via Channel for real-time frontend updates.
7. `translation_stats.rs` updates token usage and cost metrics on completion.

## TESTS

- **Location**: `src-tauri/src/services/tests/`
- **Files**: `ai_translator_tests`, `po_parser_tests`, `batch_translator_simple_tests`.
- **Fixtures**: Uses `tempfile` for safe, isolated file-based unit tests and cleanup.
- **Scope**: Unit tests cover core translation logic, PO parsing, and batch orchestration.
