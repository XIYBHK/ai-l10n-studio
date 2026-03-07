export const COMMANDS = {
  CONFIG_GET: 'get_app_config',
  CONFIG_UPDATE: 'update_app_config',
  CONFIG_VALIDATE: 'validate_config',

  AI_CONFIG_GET_ALL: 'get_all_ai_configs',
  AI_CONFIG_GET_ACTIVE: 'get_active_ai_config',
  AI_CONFIG_SET_ACTIVE: 'set_active_ai_config',
  AI_CONFIG_ADD: 'add_ai_config',
  AI_CONFIG_UPDATE: 'update_ai_config',
  AI_CONFIG_DELETE: 'remove_ai_config',
  AI_CONFIG_TEST_CONNECTION: 'test_ai_connection',

  AI_MODEL_GET_PROVIDER_MODELS: 'get_provider_models',
  AI_MODEL_GET_INFO: 'get_model_info',
  AI_MODEL_ESTIMATE_COST: 'estimate_translation_cost',
  AI_MODEL_CALCULATE_COST: 'calculate_precise_cost',

  AI_PROVIDER_GET_ALL: 'get_all_providers',
  AI_PROVIDER_GET_ALL_MODELS: 'get_all_models',
  AI_PROVIDER_FIND_BY_MODEL: 'find_provider_for_model',

  SYSTEM_PROMPT_GET: 'get_system_prompt',
  SYSTEM_PROMPT_SET: 'update_system_prompt',
  SYSTEM_PROMPT_RESET: 'reset_system_prompt',

  TERM_LIBRARY_GET: 'get_term_library',
  TERM_LIBRARY_ADD: 'add_term_to_library',
  TERM_LIBRARY_REMOVE: 'remove_term_from_library',
  TERM_LIBRARY_GENERATE_STYLE: 'generate_style_summary',
  TERM_LIBRARY_SHOULD_UPDATE: 'should_update_style_summary',

  TM_GET: 'get_translation_memory',
  TM_GET_BUILTIN: 'get_builtin_phrases',
  TM_MERGE_BUILTIN: 'merge_builtin_phrases',
  TM_SAVE: 'save_translation_memory',

  PO_PARSE: 'parse_po_file',
  PO_SAVE: 'save_po_file',

  FILE_FORMAT_DETECT: 'detect_file_format',
  FILE_METADATA_GET: 'get_file_metadata',

  TRANSLATE_ENTRY: 'translate_entry',
  CONTEXTUAL_REFINE: 'contextual_refine',

  LOG_GET: 'get_app_logs',
  LOG_CLEAR: 'clear_app_logs',
  LOG_FRONTEND_GET: 'get_frontend_logs',
  PROMPT_LOG_GET: 'get_prompt_logs',
  PROMPT_LOG_CLEAR: 'clear_prompt_logs',

  I18N_GET_SUPPORTED: 'get_supported_langs',
  I18N_GET_SYSTEM_LOCALE: 'get_system_locale',
  LANGUAGE_DETECT: 'detect_text_language',
  LANGUAGE_GET_DEFAULT_TARGET: 'get_default_target_lang',
} as const;
