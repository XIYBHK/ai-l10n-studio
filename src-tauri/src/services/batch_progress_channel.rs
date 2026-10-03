//! Reliable batch results and progress share one generated IPC contract.
use crate::services::translation_stats::TranslationStats;
use serde::{Deserialize, Serialize};
#[cfg(feature = "ts-rs")]
use ts_rs::TS;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(
    feature = "ts-rs",
    ts(export, export_to = "../../src/types/generated/")
)]
pub struct TranslationInput {
    pub text: String,
    pub context: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(
    feature = "ts-rs",
    ts(export, export_to = "../../src/types/generated/")
)]
pub enum TranslationSource {
    Tm,
    Dedup,
    Ai,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(
    feature = "ts-rs",
    ts(export, export_to = "../../src/types/generated/")
)]
pub struct TranslationItem {
    pub index: usize,
    pub translation: String,
    pub source: TranslationSource,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(
    feature = "ts-rs",
    ts(export, export_to = "../../src/types/generated/")
)]
pub struct BatchProgressEvent {
    #[cfg_attr(feature = "ts-rs", ts(type = "number"))]
    pub task_id: u64,
    pub processed: usize,
    pub total: usize,
    pub items: Vec<TranslationItem>,
    // Cumulative snapshot for this task, never per-item estimates.
    pub stats: TranslationStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(
    feature = "ts-rs",
    ts(export, export_to = "../../src/types/generated/")
)]
pub struct BatchResultWithTaskId {
    #[cfg_attr(feature = "ts-rs", ts(type = "number"))]
    pub task_id: u64,
    pub items: Vec<TranslationItem>,
    pub cancelled: bool,
    pub stats: TranslationStats,
}
