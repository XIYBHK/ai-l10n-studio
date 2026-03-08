# Documentation Index

## Core Docs

- `Architecture.md` - Current architecture, layers, and dependency summary
- `API.md` - Tauri commands, frontend service calls, and config access
- `DataContract.md` - Shared frontend/backend data contracts
- `SECURITY_NOTES.md` - Current secrets storage strategy and security tradeoffs
- `CHANGELOG.md` - Main project change history
- `ERRORS.md` - Troubleshooting and error references

## Recommended Reading Order

1. `Architecture.md`
2. `API.md`
3. `DataContract.md`
4. `SECURITY_NOTES.md`

## Notes

- Runtime configuration access should prefer `ConfigDraft`
- `ConfigManager` is retained only for compatibility and tooling flows such as import/export
- Historical or superseded material lives under `archive/`
- `Architecture.md`, `API.md`, and `DataContract.md` include historical sections; use their 2026 summaries first
