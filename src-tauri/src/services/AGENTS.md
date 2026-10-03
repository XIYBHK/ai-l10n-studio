# SERVICES KNOWLEDGE BASE

Current service responsibilities; historical plans are in docs/archive/.

| Module                            | Responsibility                                                    |
| --------------------------------- | ----------------------------------------------------------------- |
| ai_translator                     | TM lookup, deduplication, prompt/request/response, reported usage |
| model_config                      | Provider profile, models, default selection, three wire protocols |
| config_draft                      | Loaded settings and transactional persistence                     |
| po_parser                         | PO parse/preserved fields and atomic UTF-8 writer                 |
| translation_memory / term_library | Scoped keys, revisions, short disk transactions                   |
| prompt_builder                    | Language/context-matched term constraints and style summary       |
| batch_progress_channel            | Indexed Channel DTOs and cumulative statistics snapshots          |
| translation_task                  | Task ID and cancellation lifecycle                                |
| translation_stats                 | Token / source / local estimated cost counters                    |
| file_format                       | Format detection and metadata; PO/JSON supported metadata         |
| language_detector                 | Language definitions and detection                                |
| prompt_logger                     | Bounded prompt/response debug history                             |
| ai/                               | Pure TOML catalog, metadata registry and cost calculation         |

ConfigDraft keeps one current state. transaction clones it, applies the closure, validates, persists and publishes; failed transactions retain live state.
Theme/language and unused concurrency/auto-save settings are not backend configuration authorities.

AIProvider borrows catalog metadata; ModelApi selects actual HTTP behavior. Never use Box::leak to return runtime strings.
TOML is the only bundled model/price source. Explicit zero cache prices are meaningful; absent prices use the documented fallback.

TM keys are JSON tuples of source/context/canonical target language. Exact phrase terms and summaries use matching scopes.
AI output is not automatically learned. Confirmation commits to the latest library; manager replacement requires a matching revision.
No locks span AI requests. File replacement is atomic per file.

PO is fully read and parsed. The removed file_chunker was never on the live read path; Channel batching is not file streaming.
Use generated DTOs rather than hand-maintained frontend mirrors. Tests cover domain behavior and protocol contracts with isolated fixtures.
