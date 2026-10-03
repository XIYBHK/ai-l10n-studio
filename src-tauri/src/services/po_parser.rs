//! PO document parsing and atomic serialization.

use rspolib::{POEntry as RspolibEntry, POFile, pofile};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::io::Write;
use std::path::Path;
use tempfile::NamedTempFile;

use crate::error::AppError;

#[cfg(feature = "ts-rs")]
use ts_rs::TS;

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(
    feature = "ts-rs",
    ts(export, export_to = "../../src/types/generated/")
)]
pub struct PODocument {
    pub header: Option<String>,
    pub metadata: BTreeMap<String, String>,
    pub metadata_is_fuzzy: bool,
    pub entries: Vec<POEntry>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(
    feature = "ts-rs",
    ts(export, export_to = "../../src/types/generated/")
)]
pub struct POEntry {
    pub comments: Vec<String>,
    pub translator_comments: String,
    pub msgctxt: String,
    pub msgid: String,
    pub msgstr: String,
    pub line_start: usize,
    pub msgid_plural: Option<String>,
    pub msgstr_plural: Vec<String>,
    pub flags: Vec<String>,
    pub occurrences: Vec<(String, String)>,
    pub obsolete: bool,
    pub previous_msgid: Option<String>,
    pub previous_msgid_plural: Option<String>,
    pub previous_msgctxt: Option<String>,
}

#[derive(Debug, Clone, Copy, Default)]
pub struct POParser;

impl POParser {
    pub fn new() -> Result<Self, AppError> {
        Ok(Self)
    }

    pub fn parse_file<P: AsRef<Path>>(&self, path: P) -> Result<PODocument, AppError> {
        let bytes = fs::read(path.as_ref())?;
        let content = String::from_utf8(bytes)
            .map_err(|e| AppError::parse(format!("PO 文件必须是 UTF-8 编码: {e}")))?;
        let file = pofile(content.trim_start_matches('\u{feff}'))
            .map_err(|e| AppError::parse(e.to_string()))?;
        let document = document_from_rspolib(file);
        validate_encoding(&document)?;
        Ok(document)
    }

    pub fn write_file<P: AsRef<Path>>(
        &self,
        path: P,
        document: &PODocument,
    ) -> Result<(), AppError> {
        let path = path.as_ref();
        validate_encoding(document)?;
        let bytes = serialize_document(document).into_bytes();
        let parent = path
            .parent()
            .filter(|parent| !parent.as_os_str().is_empty())
            .unwrap_or_else(|| Path::new("."));
        let mut temp = NamedTempFile::new_in(parent)?;
        temp.write_all(&bytes)?;
        temp.as_file().sync_all()?;
        temp.persist(path).map_err(|e| AppError::Io(e.error))?;
        Ok(())
    }
}

fn validate_encoding(document: &PODocument) -> Result<(), AppError> {
    if let Some(content_type) = document.metadata.get("Content-Type") {
        for parameter in content_type.split(';').skip(1) {
            if let Some((name, value)) = parameter.split_once('=') {
                let charset = value.trim().trim_matches('"');
                if name.trim().eq_ignore_ascii_case("charset")
                    && !charset.eq_ignore_ascii_case("utf-8")
                {
                    return Err(AppError::parse(format!(
                        "Unsupported PO charset {charset}; convert the document to UTF-8 first"
                    )));
                }
            }
        }
    }
    Ok(())
}

fn document_from_rspolib(file: POFile) -> PODocument {
    PODocument {
        header: file.header,
        metadata: file.metadata.into_iter().collect(),
        metadata_is_fuzzy: file.metadata_is_fuzzy,
        entries: file.entries.into_iter().map(entry_from_rspolib).collect(),
    }
}

fn entry_from_rspolib(entry: RspolibEntry) -> POEntry {
    POEntry {
        comments: entry
            .comment
            .map(|v| v.lines().map(str::to_owned).collect())
            .unwrap_or_default(),
        translator_comments: entry.tcomment.unwrap_or_default(),
        msgctxt: entry.msgctxt.unwrap_or_default(),
        msgid: entry.msgid,
        msgstr: entry.msgstr.unwrap_or_default(),
        line_start: entry.linenum,
        msgid_plural: entry.msgid_plural,
        msgstr_plural: entry.msgstr_plural,
        flags: entry.flags,
        occurrences: entry.occurrences,
        obsolete: entry.obsolete,
        previous_msgid: entry.previous_msgid,
        previous_msgid_plural: entry.previous_msgid_plural,
        previous_msgctxt: entry.previous_msgctxt,
    }
}

// Keep values verbatim: the library formatter trims translations and wraps
// comments/references incorrectly. PO does not require physical line wrapping.
fn quoted(value: &str) -> String {
    let mut output = String::from("\"");
    for ch in value.chars() {
        match ch {
            '\\' => output.push_str("\\\\"),
            '"' => output.push_str("\\\""),
            '\n' => output.push_str("\\n"),
            '\r' => output.push_str("\\r"),
            '\t' => output.push_str("\\t"),
            _ => output.push(ch),
        }
    }
    output.push('"');
    output
}

fn field(output: &mut String, prefix: &str, name: &str, value: &str) {
    output.push_str(&format!("{prefix}{name} {}\n", quoted(value)));
}

fn comment(output: &mut String, prefix: &str, value: &str) {
    for line in value.split('\n') {
        output.push_str(prefix);
        output.push_str(line);
        output.push('\n');
    }
}

fn serialize_document(document: &PODocument) -> String {
    let mut output = String::new();
    if let Some(header) = &document.header {
        comment(&mut output, "# ", header);
    }
    if document.metadata_is_fuzzy {
        output.push_str("#, fuzzy\n");
    }
    field(&mut output, "", "msgid", "");
    let metadata: String = document
        .metadata
        .iter()
        .map(|(key, value)| format!("{key}: {value}\n"))
        .collect();
    field(&mut output, "", "msgstr", &metadata);
    for entry in &document.entries {
        output.push('\n');
        if !entry.translator_comments.is_empty() {
            comment(&mut output, "# ", &entry.translator_comments);
        }
        for text in &entry.comments {
            comment(&mut output, "#. ", text);
        }
        for (file, line) in &entry.occurrences {
            comment(
                &mut output,
                "#: ",
                &if line.is_empty() {
                    file.clone()
                } else {
                    format!("{file}:{line}")
                },
            );
        }
        if !entry.flags.is_empty() {
            comment(&mut output, "#, ", &entry.flags.join(", "));
        }
        for (name, value) in [
            ("msgctxt", &entry.previous_msgctxt),
            ("msgid", &entry.previous_msgid),
            ("msgid_plural", &entry.previous_msgid_plural),
        ] {
            if let Some(value) = value {
                field(&mut output, "#| ", name, value);
            }
        }
        let prefix = if entry.obsolete { "#~ " } else { "" };
        if !entry.msgctxt.is_empty() {
            field(&mut output, prefix, "msgctxt", &entry.msgctxt);
        }
        field(&mut output, prefix, "msgid", &entry.msgid);
        if let Some(plural) = &entry.msgid_plural {
            field(&mut output, prefix, "msgid_plural", plural);
            for (index, value) in entry.msgstr_plural.iter().enumerate() {
                field(&mut output, prefix, &format!("msgstr[{index}]"), value);
            }
            if entry.msgstr_plural.is_empty() {
                field(&mut output, prefix, "msgstr[0]", "");
            }
        } else {
            field(&mut output, prefix, "msgstr", &entry.msgstr);
        }
    }
    output
}
