# RUST BACKEND KNOWLEDGE BASE

Tauri 2 / Rust 2024. Startup, plugins and command registration are in lib.rs::run; main.rs delegates and retains the Windows subsystem attribute.

## Boundaries

- commands/ bridges IPC to services; modules include translator, ai_config, ai_model_commands, config_sync, file_format, language, log, prompt_log and system.
- services/ implements domain logic and DTOs; utils/init.rs handles app paths, logging and catalog initialization.
- services/ai/ contains provider metadata registry, TOML catalog, model info and cost calculation. HTTP protocols execute in AITranslator.
- All new service errors use AppError and `?`. Some existing command boundaries return String; do not add silent success paths.
- Use parking_lot::RwLock and short lock lifetimes. Never hold library/config locks across remote AI awaits.

## Contracts and persistence

Add a command in commands/, export from commands/mod.rs, register in lib.rs and expose through a frontend service.
Serializable payloads use serde and ts-rs export annotations. Respect each DTO's field naming and Option/null/omitted-field semantics.
ConfigDraft.transaction is the only mutation API. Validate, persist and publish while holding one config lock.
Credentials live in config.secrets.json keyed by stable provider ID and are not serialized through query DTOs.
TM/terms use one shared short-lived disk lock, revision checks and atomic replacement.

## Translation and plugins

Channel batches are the current translation entry. Keep early cancellation, indexed items, final result and cumulative usage semantics.
Record reported usage before validating content; failures may still consume tokens.
plugins/\*/plugin.toml is the sole bundled provider/model/price catalog. No dynamic compilation of provider.rs/models.rs.
Strict catalog parsing rejects unused legacy extra_config/models.overrides fields.
Missing cache price falls back to input price; explicit zero remains zero.
Do not restore BatchTranslator, directory-translation IPC, old provider/model trees or file_chunker.

## Validation

Tests live inline for module internals and in services/tests for shared translation/PO fixtures.
Use tempfile for isolated files and local HTTP mocks for protocol tests. Test unwrap allowances are scoped.
Run cargo test --locked --features ts-rs and cargo clippy --locked --all-features --lib --bins -- -D warnings.
Regenerate TypeScript DTOs after Rust schema changes, then run the frontend type check.
New recurring errors belong in docs/ERRORS.md.
