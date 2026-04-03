# RUST BACKEND KNOWLEDGE BASE

## OVERVIEW

Tauri 2.x backend (Rust 2024). 39 commands across 9 modules, 15 services, unified AppError.

## STRUCTURE

```
src/
├── main.rs          # Tauri builder, invoke_handler (39 cmds), plugins: dialog/fs/store/notification
├── lib.rs           # Re-exports commands, services, error, utils
├── error.rs         # Unified AppError (From<serde/io/reqwest/walkdir>)
├── commands/        # 9 modules (bridge layer: frontend -> services)
├── services/        # 15 modules + ai/ subsystem (see services/AGENTS.md)
└── utils/           # 10 helpers (init.rs: flexi_logger, path, string, IO)
```

## COMMAND REGISTRATION (9 modules in commands/)

| Module               | Commands                                               | Scope                          |
| -------------------- | ------------------------------------------------------ | ------------------------------ |
| translator.rs        | parse, translate, batch, refine, TM, term, file_dialog | Core translation + related ops |
| ai_config.rs         | CRUD, set_active, test_connection                      | AI provider management         |
| config_sync.rs       | get, update, validate, get_version                     | Config read/write/sync         |
| ai_model_commands.rs | provider/model queries, cost estimation                | Frontend dropdown data         |
| language.rs          | detect, default_target, supported, system_lang/locale  | Language detection             |
| file_format.rs       | detect, get_metadata                                   | File format handling           |
| system.rs            | log_dir, open_logs, native_theme                       | System utilities               |
| prompt_log.rs        | get, clear                                             | AI request/response history    |

## ERROR HANDLING

- `AppError` in error.rs: unified type, implements `From<>` for serde/io/reqwest/walkdir
- Commands: `Result<T, String>` via `.map_err(|e| e.to_string())` at Tauri boundary
- Propagation: `?` operator through service -> command -> frontend
- Logger: flexi_logger in utils/init.rs with `WriteMode::BufferAndFlush`
- Catalog: new errors must be documented in `docs/ERRORS.md`

## TESTING

- Location: `services/tests/` (NOT inline `#[cfg(test)]`)
- 3 files: ai_translator_tests, po_parser_tests, batch_translator_simple_tests
- Fixtures: `tempfile` crate for isolated file-based tests
- Tests may `#[allow(clippy::unwrap_used)]` where appropriate

## CONVENTIONS

- Services stay platform-agnostic; Tauri-specific code only in commands/ and main.rs
- Command args: simple serializable types; use structs for complex inputs
- Prefer Tauri plugins (dialog, fs, store) over custom implementations
- Serde for all Rust <-> TypeScript data transfer
- Use absolute paths; avoid relative path assumptions (cross-platform)
- Throttle progress events to prevent frontend flooding
- Keep main.rs clean: init logic in utils/init.rs, commands in commands/mod.rs
