use crate::services::po_parser::{PODocument, POEntry, POParser};
use std::collections::BTreeMap;
use std::fs;
use tempfile::tempdir;

#[test]
fn multiline_bom_and_escape_semantics_survive_overwrite() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("multiline.po");
    let text = concat!(
        "\u{feff}",
        r#"msgid ""
msgstr ""
"Language: ja\n"
"Content-Type: text/plain; charset=UTF-8\n"

msgctxt "menu"
msgid " leading "
"line\n"
"trailing \"quote\"\\"
msgstr " 改行\n"
"末尾 "
"#
    );
    fs::write(&path, text).unwrap();
    let parser = POParser::new().unwrap();
    let doc = parser.parse_file(&path).unwrap();
    assert_eq!(doc.entries[0].msgid, " leading line\ntrailing \"quote\"\\");
    assert_eq!(doc.entries[0].msgstr, " 改行\n末尾 ");
    parser.write_file(&path, &doc).unwrap();
    let reparsed = parser.parse_file(&path).unwrap();
    assert_eq!(reparsed.entries[0].msgid, doc.entries[0].msgid);
    assert_eq!(reparsed.entries[0].msgstr, doc.entries[0].msgstr);
    assert_eq!(reparsed.metadata, doc.metadata);
}

#[test]
fn incompatible_declared_encoding_cannot_replace_existing_document() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("original.po");
    fs::write(&path, "original").unwrap();
    let mut doc = PODocument::default();
    doc.metadata.insert(
        "Content-Type".into(),
        "text/plain; charset=ISO-8859-1".into(),
    );
    assert!(POParser::new().unwrap().write_file(&path, &doc).is_err());
    assert_eq!(fs::read_to_string(path).unwrap(), "original");
}

#[test]
fn parses_and_roundtrips_rich_po() {
    let dir = tempdir().unwrap();
    let input = dir.path().join("input.po");
    let output = dir.path().join("output.po");
    fs::write(&input, "# Header\nmsgid \"\"\nmsgstr \"\"\n\"Language: zh\\n\"\n\n# translator\n#. extracted\n#: src/a.rs:7\n#, fuzzy, c-format\n#| msgctxt \"old ctx\"\n#| msgid \"old\"\nmsgctxt \"ctx\"\nmsgid \"Hello \\\"world\\\"\\\\\"\nmsgid_plural \"Hello worlds\"\nmsgstr[0] \"你好\"\nmsgstr[1] \"你好们\"\n\n#~ msgid \"old\"\n#~ msgstr \"旧\"\n").unwrap();
    let parser = POParser::new().unwrap();
    let mut document = parser.parse_file(&input).unwrap();
    assert_eq!(document.metadata.get("Language"), Some(&"zh".to_string()));
    assert_eq!(document.entries.len(), 2);
    assert_eq!(document.entries[0].msgctxt, "ctx");
    assert_eq!(document.entries[0].msgstr_plural, vec!["你好", "你好们"]);
    assert!(document.entries[0].flags.contains(&"fuzzy".to_string()));
    assert!(document.entries[1].obsolete);
    parser.write_file(&output, &document).unwrap();
    let mut reparsed = parser.parse_file(&output).unwrap();
    // Serialization may change physical layout, but not entry semantics.
    for entry in document
        .entries
        .iter_mut()
        .chain(reparsed.entries.iter_mut())
    {
        entry.line_start = 0;
    }
    assert_eq!(document, reparsed);
}

#[test]
fn writer_preserves_long_comments_previous_plural_and_trailing_spaces() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("rich.po");
    let mut doc = PODocument::default();
    doc.entries.push(POEntry {
        msgid: " item ".into(),
        msgid_plural: Some(" items ".into()),
        msgstr_plural: vec![" one \n ".into(), " many \t".into()],
        comments: vec!["extracted comment ".repeat(30).trim_end().into()],
        translator_comments: "translator comment ".repeat(30).trim_end().into(),
        previous_msgid_plural: Some("previous items".into()),
        previous_msgid: Some("previous item".into()),
        occurrences: vec![("very_long_source_name_".repeat(10), "42".into())],
        ..Default::default()
    });
    let parser = POParser::new().unwrap();
    parser.write_file(&path, &doc).unwrap();
    let mut actual = parser.parse_file(&path).unwrap();
    actual.entries[0].line_start = 0;
    assert_eq!(actual.entries, doc.entries);
    assert!(
        fs::read_to_string(path)
            .unwrap()
            .contains("#| msgid_plural \"previous items\"")
    );
}

#[test]
fn rejects_invalid_utf8_and_invalid_po() {
    let dir = tempdir().unwrap();
    let invalid_utf8 = dir.path().join("invalid-utf8.po");
    fs::write(&invalid_utf8, [0xff, 0xfe]).unwrap();
    assert!(POParser::new().unwrap().parse_file(invalid_utf8).is_err());
    let invalid_po = dir.path().join("invalid.po");
    fs::write(&invalid_po, "msgid \\\"unterminated\n").unwrap();
    assert!(POParser::new().unwrap().parse_file(invalid_po).is_err());
}

#[test]
fn atomic_write_keeps_original_when_parent_is_missing() {
    let dir = tempdir().unwrap();
    let target = dir.path().join("original.po");
    fs::write(&target, b"original").unwrap();
    let doc = PODocument {
        header: None,
        metadata: BTreeMap::new(),
        metadata_is_fuzzy: false,
        entries: vec![POEntry {
            msgid: "changed".into(),
            ..Default::default()
        }],
    };
    assert!(
        POParser::new()
            .unwrap()
            .write_file(dir.path().join("missing").join("x.po"), &doc)
            .is_err()
    );
    assert_eq!(fs::read(&target).unwrap(), b"original");
}
