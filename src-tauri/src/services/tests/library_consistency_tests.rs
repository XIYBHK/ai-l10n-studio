#![allow(clippy::unwrap_used, clippy::expect_used)]

use super::{ConfirmedTranslation, TranslationMemory, memory_key};
use crate::error::AppError;
use crate::services::term_library::TermLibrary;
use std::sync::{Arc, Barrier};

fn pair(
    source: &str,
    translation: &str,
    context: Option<&str>,
    language: &str,
) -> ConfirmedTranslation {
    ConfirmedTranslation {
        source: source.into(),
        translation: translation.into(),
        context: context.map(str::to_string),
        language: language.into(),
    }
}

#[test]
fn manual_confirmation_updates_exact_key_and_rejects_conflicting_batch() {
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("memory.json");
    TranslationMemory::confirm(&path, vec![pair("Open", "错误", Some("verb"), "zh-CN")]).unwrap();
    assert_eq!(
        TranslationMemory::confirm(&path, vec![pair("Open", "打开", Some("verb"), "zh-Hans")])
            .unwrap(),
        1
    );
    let mut memory = TranslationMemory::new_from_file(&path).unwrap();
    assert_eq!(
        memory
            .get_translation("Open", Some("verb"), "zh-CN")
            .as_deref(),
        Some("打开")
    );
    assert!(
        memory
            .get_translation("Open", Some("adjective"), "zh-CN")
            .is_none()
    );
    assert!(memory.get_translation("Open", Some("verb"), "ja").is_none());
    let before = std::fs::read(&path).unwrap();
    assert!(
        TranslationMemory::confirm(
            &path,
            vec![pair("a", "one", None, "en"), pair("a", "two", None, "en")]
        )
        .is_err()
    );
    assert_eq!(std::fs::read(&path).unwrap(), before);
}

#[test]
fn memory_concurrent_confirmation_never_loses_a_writer() {
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("memory.json");
    let barrier = Arc::new(Barrier::new(12));
    let workers: Vec<_> = (0..12)
        .map(|index| {
            let barrier = Arc::clone(&barrier);
            let path = path.clone();
            std::thread::spawn(move || {
                barrier.wait();
                TranslationMemory::confirm(
                    &path,
                    vec![pair(
                        &format!("source{index}"),
                        &format!("target{index}"),
                        None,
                        "en",
                    )],
                )
                .unwrap();
            })
        })
        .collect();
    for worker in workers {
        worker.join().unwrap();
    }
    let memory = TranslationMemory::new_from_file(&path).unwrap();
    for index in 0..12 {
        assert_eq!(
            memory
                .memory
                .get(&memory_key(&format!("source{index}"), None, "en")),
            Some(&format!("target{index}"))
        );
    }
    assert_eq!(memory.revision, 12);
    assert_eq!(memory.stats.total_entries, memory.memory.len());
}

#[test]
fn manager_rejects_stale_snapshot_and_returns_new_revision() {
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("memory.json");
    let mut draft = TranslationMemory::new_from_file(&path).unwrap();
    draft.clear();
    let saved = draft.save_to_file(&path).unwrap();
    assert_eq!(saved.revision, 1);
    TranslationMemory::confirm(&path, vec![pair("Open", "打开", None, "zh-CN")]).unwrap();
    assert!(matches!(
        saved.save_to_file(&path),
        Err(AppError::Validation(_))
    ));
    let memory = TranslationMemory::new_from_file(&path).unwrap();
    assert_eq!(memory.memory.len(), 1);
    assert_eq!(memory.revision, 2);
}

#[test]
fn failed_write_and_invalid_confirmation_preserve_existing_file() {
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("memory.json");
    let memory = TranslationMemory::new().save_to_file(&path).unwrap();
    let before = std::fs::read(&path).unwrap();
    let mut invalid = memory.clone();
    invalid.memory.insert("invalid-key".into(), "x".into());
    assert!(invalid.save_to_file(&path).is_err());
    assert_eq!(std::fs::read(&path).unwrap(), before);
    let blocked_parent = temp.path().join("file-instead-of-directory");
    std::fs::write(&blocked_parent, "keep").unwrap();
    assert!(
        TranslationMemory::confirm(
            blocked_parent.join("memory.json"),
            vec![pair("a", "b", None, "en")]
        )
        .is_err()
    );
    assert_eq!(std::fs::read_to_string(blocked_parent).unwrap(), "keep");
}

#[test]
fn builtin_merge_transaction_refreshes_metadata_and_keeps_user_values() {
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("memory.json");
    let mut memory = TranslationMemory::new();
    memory.clear();
    memory.add_translation("Open".into(), "用户译法".into(), None, "zh-CN");
    let first = memory.save_to_file(&path).unwrap();
    let (merged, ()) = TranslationMemory::transaction(&path, None, |memory| {
        for (key, value) in super::get_builtin_memory() {
            memory.memory.entry(key).or_insert(value);
        }
        Ok(())
    })
    .unwrap();
    assert!(merged.last_updated >= first.last_updated);
    assert_eq!(merged.revision, first.revision + 1);
    assert_eq!(merged.stats.total_entries, merged.memory.len());
    assert_eq!(
        merged.memory[&memory_key("Open", None, "zh-CN")],
        "用户译法"
    );
}

#[test]
fn term_identity_update_and_delete_use_language_and_context() {
    let mut library = TermLibrary::new();
    for (context, language, translation) in [
        (Some("verb"), "zh-CN", "打开"),
        (Some("adj"), "zh-CN", "开放"),
        (Some("verb"), "ja", "開く"),
    ] {
        library
            .add_term(
                "Open".into(),
                translation.into(),
                "old".into(),
                context.map(str::to_string),
                language.into(),
            )
            .unwrap();
    }
    library
        .add_term(
            "Open".into(),
            "开启".into(),
            "new AI".into(),
            Some("verb".into()),
            "zh-Hans".into(),
        )
        .unwrap();
    assert_eq!(library.terms.len(), 3);
    let term = &library.terms[0];
    assert_eq!(term.user_translation, "开启");
    assert_eq!(term.ai_translation, "new AI");
    assert_eq!(term.language, "zh-Hans");
    assert_eq!(term.frequency, 2);
    library.remove_term("Open", Some("verb"), "zh-CN").unwrap();
    assert_eq!(library.terms.len(), 2);
    assert!(library.terms.iter().any(|term| term.language == "ja"));
    assert!(library.remove_term("Open", None, "zh-CN").is_err());
}

#[test]
fn term_concurrent_updates_and_summary_conflict_do_not_lose_data() {
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("terms.json");
    let stale = TermLibrary::load_from_file(&path).unwrap();
    let barrier = Arc::new(Barrier::new(10));
    let workers: Vec<_> = (0..10)
        .map(|index| {
            let barrier = Arc::clone(&barrier);
            let path = path.clone();
            std::thread::spawn(move || {
                barrier.wait();
                TermLibrary::transaction(path, None, |library| {
                    library.add_term(
                        format!("s{index}"),
                        format!("t{index}"),
                        "old".into(),
                        None,
                        "en".into(),
                    )
                })
                .unwrap();
            })
        })
        .collect();
    for worker in workers {
        worker.join().unwrap();
    }
    assert!(
        TermLibrary::transaction(&path, Some(stale.revision), |library| library
            .update_style_summary("stale".into(), "en".into(), None))
        .is_err()
    );
    let loaded = TermLibrary::load_from_file(&path).unwrap();
    assert_eq!(loaded.terms.len(), 10);
    assert_eq!(loaded.metadata.total_terms, 10);
    assert_eq!(loaded.revision, 10);
    assert!(loaded.style_summary.is_none());
}

#[test]
fn phrase_rules_filter_language_context_and_identifier_boundaries() {
    let mut library = TermLibrary::new();
    library
        .add_term(
            "Open".into(),
            "打开".into(),
            "old".into(),
            None,
            "zh-CN".into(),
        )
        .unwrap();
    library
        .add_term(
            "Open".into(),
            "开放".into(),
            "old".into(),
            Some("adjective".into()),
            "zh-CN".into(),
        )
        .unwrap();
    library
        .add_term(
            "Open".into(),
            "開く".into(),
            "old".into(),
            None,
            "ja".into(),
        )
        .unwrap();
    assert_eq!(
        library.matching_terms("Open file", None, "zh-Hans")[0].user_translation,
        "打开"
    );
    let specific = library.matching_terms("Open world", Some("adjective"), "zh-CN");
    assert_eq!(specific.len(), 1);
    assert_eq!(specific[0].user_translation, "开放");
    assert!(
        library
            .matching_terms("Opens _Open OpenGL", None, "zh-CN")
            .is_empty()
    );
    assert!(library.matching_terms("Open file", None, "fr").is_empty());
}

#[test]
fn style_is_scoped_invalidated_and_never_underflows_after_deletion() {
    let mut library = TermLibrary::new();
    library
        .add_term(
            "Open".into(),
            "打开".into(),
            "old".into(),
            None,
            "zh-CN".into(),
        )
        .unwrap();
    library
        .add_term(
            "Save".into(),
            "保存".into(),
            "old".into(),
            None,
            "zh-CN".into(),
        )
        .unwrap();
    library
        .add_term(
            "JapaneseOnly".into(),
            "日本語".into(),
            "old".into(),
            None,
            "ja".into(),
        )
        .unwrap();
    let prompt = library.build_analysis_prompt("zh-CN", None).unwrap();
    assert!(!prompt.contains("JapaneseOnly"));
    library
        .update_style_summary("Chinese style".into(), "zh-CN".into(), None)
        .unwrap();
    assert!(library.style_for("ja", None).is_none());
    assert!(library.style_for("zh-Hans", None).is_some());
    library.metadata.terms_at_last_summary = usize::MAX;
    library.remove_term("Open", None, "zh-CN").unwrap();
    assert!(library.style_summary.is_none());
    assert!(library.should_update_style_summary("zh-CN", None));
}

#[test]
fn library_schema_requires_target_language_and_revision() {
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("terms.json");
    let mut library = TermLibrary::new();
    library
        .add_term("a".into(), "b".into(), "c".into(), None, "en".into())
        .unwrap();
    let mut value = serde_json::to_value(library).unwrap();
    value["terms"][0]
        .as_object_mut()
        .unwrap()
        .remove("language");
    std::fs::write(&path, serde_json::to_vec(&value).unwrap()).unwrap();
    assert!(TermLibrary::load_from_file(path).is_err());
}

#[cfg(windows)]
#[test]
fn windows_failed_atomic_replace_keeps_previous_revision_and_json() {
    use std::os::windows::fs::OpenOptionsExt;
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("memory.json");
    TranslationMemory::confirm(&path, vec![pair("a", "before", None, "en")]).unwrap();
    let before = std::fs::read(&path).unwrap();
    let reader = std::fs::OpenOptions::new()
        .read(true)
        .share_mode(1)
        .open(&path)
        .unwrap();
    assert!(TranslationMemory::confirm(&path, vec![pair("a", "after", None, "en")]).is_err());
    drop(reader);
    assert_eq!(std::fs::read(&path).unwrap(), before);
    let loaded = TranslationMemory::new_from_file(&path).unwrap();
    assert_eq!(loaded.revision, 1);
    assert_eq!(loaded.memory[&memory_key("a", None, "en")], "before");
}
