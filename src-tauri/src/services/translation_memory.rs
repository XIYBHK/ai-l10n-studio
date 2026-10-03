use crate::error::AppError;
use chrono::{DateTime, Utc};
use indexmap::IndexMap;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::Path;

// All in-process library readers and writers share this short-lived disk transaction lock.
// It is never held while awaiting an AI request.
pub(crate) static LIBRARY_FILE_LOCK: RwLock<()> = RwLock::new(());

pub(crate) fn atomic_write_library<T: Serialize>(path: &Path, value: &T) -> Result<(), AppError> {
    let parent = path
        .parent()
        .filter(|path| !path.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    fs::create_dir_all(parent)?;
    let mut temporary = tempfile::NamedTempFile::new_in(parent)?;
    temporary.write_all(serde_json::to_string_pretty(value)?.as_bytes())?;
    temporary.as_file().sync_all()?;
    temporary
        .persist(path)
        .map_err(|error| AppError::Io(error.error))?;
    Ok(())
}

#[cfg(feature = "ts-rs")]
use ts_rs::TS;

/// Canonicalize aliases without conflating simplified and traditional Chinese.
pub fn canonical_target_language(language: &str) -> String {
    let language = language.trim().replace('_', "-");
    match language.to_ascii_lowercase().as_str() {
        "zh-cn" | "zh-sg" | "zh-hans" => "zh-Hans".into(),
        "zh-tw" | "zh-hk" | "zh-mo" | "zh-hant" => "zh-Hant".into(),
        _ => language.to_ascii_lowercase(),
    }
}

/// JSON tuples prevent collisions with source text containing pipes or quotes.
pub fn memory_key(source: &str, context: Option<&str>, target: &str) -> String {
    serde_json::json!([source, context, canonical_target_language(target)]).to_string()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(
    feature = "ts-rs",
    ts(export, export_to = "../../src/types/generated/")
)]
pub struct TranslationMemory {
    pub revision: u32,
    #[cfg_attr(feature = "ts-rs", ts(type = "Record<string, string>"))]
    pub memory: IndexMap<String, String>,
    pub stats: MemoryStats,
    #[cfg_attr(feature = "ts-rs", ts(type = "string"))]
    pub last_updated: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(
    feature = "ts-rs",
    ts(export, export_to = "../../src/types/generated/")
)]
pub struct ConfirmedTranslation {
    pub source: String,
    pub translation: String,
    pub context: Option<String>,
    pub language: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[cfg_attr(feature = "ts-rs", derive(TS))]
#[cfg_attr(
    feature = "ts-rs",
    ts(export, export_to = "../../src/types/generated/")
)]
pub struct MemoryStats {
    pub total_entries: usize,
    pub hits: usize,
    pub misses: usize,
}

impl TranslationMemory {
    pub fn new() -> Self {
        let memory = get_builtin_memory();
        let total_entries = memory.len();
        Self {
            revision: 0,
            memory,
            stats: MemoryStats {
                total_entries,
                ..MemoryStats::default()
            },
            last_updated: Utc::now(),
        }
    }

    /// The persisted format is the same typed object exposed by the UI.
    pub fn new_from_file<P: AsRef<Path>>(file_path: P) -> Result<Self, AppError> {
        let _guard = LIBRARY_FILE_LOCK.read();
        Self::load_unlocked(file_path.as_ref())
    }

    fn load_unlocked(path: &Path) -> Result<Self, AppError> {
        let content = match fs::read_to_string(path) {
            Ok(content) => content,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Self::new()),
            Err(error) => return Err(error.into()),
        };
        let mut memory: Self = serde_json::from_str(&content)?;
        memory.validate_keys()?;
        memory.stats.total_entries = memory.memory.len();
        Ok(memory)
    }

    pub fn transaction<R>(
        path: impl AsRef<Path>,
        expected_revision: Option<u32>,
        mutate: impl FnOnce(&mut Self) -> Result<R, AppError>,
    ) -> Result<(Self, R), AppError> {
        let _guard = LIBRARY_FILE_LOCK.write();
        let path = path.as_ref();
        let mut memory = Self::load_unlocked(path)?;
        if expected_revision.is_some_and(|revision| revision != memory.revision) {
            return Err(AppError::validation(
                "翻译记忆已被其他操作修改，请重新加载后再保存",
            ));
        }
        let revision = memory
            .revision
            .checked_add(1)
            .ok_or_else(|| AppError::validation("翻译记忆版本号已达上限"))?;
        let result = mutate(&mut memory)?;
        memory.validate_keys()?;
        memory.revision = revision;
        memory.stats.total_entries = memory.memory.len();
        memory.last_updated = Utc::now();
        atomic_write_library(path, &memory)?;
        Ok((memory, result))
    }

    /// A manager replaces a snapshot only if its revision is still current.
    pub fn save_to_file(&self, path: impl AsRef<Path>) -> Result<Self, AppError> {
        Self::transaction(path, Some(self.revision), |memory| {
            *memory = self.clone();
            Ok(())
        })
        .map(|(memory, ())| memory)
    }

    pub fn confirm(
        path: impl AsRef<Path>,
        pairs: Vec<ConfirmedTranslation>,
    ) -> Result<usize, AppError> {
        if pairs.is_empty() {
            return Ok(0);
        }
        let mut unique = IndexMap::new();
        for pair in pairs {
            if pair.source.trim().is_empty()
                || pair.translation.trim().is_empty()
                || pair.language.trim().is_empty()
            {
                return Err(AppError::validation("确认译文必须包含原文、译文和目标语言"));
            }
            let key = memory_key(&pair.source, pair.context.as_deref(), &pair.language);
            if let Some(previous) = unique.insert(key, pair.translation.clone()) {
                if previous != pair.translation {
                    return Err(AppError::validation("同一记忆键存在不同的确认译文"));
                }
            }
        }
        Self::transaction(path, None, |memory| {
            let count = unique.len();
            memory.memory.extend(unique);
            Ok(count)
        })
        .map(|(_, count)| count)
    }

    fn validate_keys(&self) -> Result<(), AppError> {
        for (key, translation) in &self.memory {
            let (source, context, target): (String, Option<String>, String) =
                serde_json::from_str(key).map_err(|_| {
                    AppError::validation("翻译记忆键必须为 [原文, 上下文, 目标语言]")
                })?;
            if source.trim().is_empty()
                || translation.trim().is_empty()
                || target.is_empty()
                || *key != memory_key(&source, context.as_deref(), &target)
            {
                return Err(AppError::validation("翻译记忆目标语言或键格式无效"));
            }
        }
        Ok(())
    }

    pub fn get_translation(
        &mut self,
        source: &str,
        context: Option<&str>,
        target: &str,
    ) -> Option<String> {
        let translation = if target.trim().is_empty() {
            None
        } else {
            self.memory
                .get(&memory_key(source, context, target))
                .cloned()
        };
        if translation.is_some() {
            self.stats.hits += 1;
        } else {
            self.stats.misses += 1;
        }
        translation
    }

    pub fn add_translation(
        &mut self,
        source: String,
        target: String,
        context: Option<&str>,
        target_lang: &str,
    ) {
        if target_lang.trim().is_empty() {
            return;
        }
        let key = memory_key(&source, context, target_lang);
        if self.memory.len() >= 10000 && !self.memory.contains_key(&key) {
            self.memory.shift_remove_index(0);
        }
        self.memory.insert(key, target);
        self.stats.total_entries = self.memory.len();
        self.last_updated = Utc::now();
    }

    pub fn get_hit_rate(&self) -> f64 {
        let total = self.stats.hits + self.stats.misses;
        if total == 0 {
            0.0
        } else {
            self.stats.hits as f64 / total as f64
        }
    }

    pub fn clear(&mut self) {
        self.memory.clear();
        self.stats = MemoryStats::default();
        self.last_updated = Utc::now();
    }

    pub fn get_stats(&self) -> &MemoryStats {
        &self.stats
    }
    pub fn get_size(&self) -> usize {
        self.memory.len()
    }
}

#[cfg(test)]
#[path = "tests/library_consistency_tests.rs"]
mod library_consistency_tests;

impl Default for TranslationMemory {
    fn default() -> Self {
        Self::new()
    }
}

pub fn get_builtin_memory() -> IndexMap<String, String> {
    let mut memory = IndexMap::new();

    // XTools 命名空间
    memory.insert(
        memory_key("XTools|Random", None, "zh-Hans"),
        "XTools|随机".to_string(),
    );
    memory.insert(
        memory_key("XTools|Sort", None, "zh-Hans"),
        "XTools|排序".to_string(),
    );
    memory.insert(
        memory_key("XTools|Array", None, "zh-Hans"),
        "XTools|数组".to_string(),
    );
    memory.insert(
        memory_key("XTools|Collision", None, "zh-Hans"),
        "XTools|碰撞".to_string(),
    );
    memory.insert(
        memory_key("XTools|Math", None, "zh-Hans"),
        "XTools|数学".to_string(),
    );
    memory.insert(
        memory_key("XTools|String", None, "zh-Hans"),
        "XTools|字符串".to_string(),
    );
    memory.insert(
        memory_key("XTools|Transform", None, "zh-Hans"),
        "XTools|Transform".to_string(),
    );
    memory.insert(
        memory_key("XTools|Utilities", None, "zh-Hans"),
        "XTools|工具".to_string(),
    );
    memory.insert(
        memory_key("XTools|Debug", None, "zh-Hans"),
        "XTools|调试".to_string(),
    );

    // Asset Naming 相关
    memory.insert(
        memory_key("Asset Naming", None, "zh-Hans"),
        "资产命名".to_string(),
    );
    memory.insert(
        memory_key("Asset Naming|Validation", None, "zh-Hans"),
        "资产命名|验证".to_string(),
    );
    memory.insert(
        memory_key("Asset Naming|Exclusion Rules", None, "zh-Hans"),
        "资产命名|排除规则".to_string(),
    );
    memory.insert(
        memory_key("Asset Naming|Prefix", None, "zh-Hans"),
        "资产命名|前缀".to_string(),
    );
    memory.insert(
        memory_key("Asset Naming|Suffix", None, "zh-Hans"),
        "资产命名|后缀".to_string(),
    );

    // 常见术语
    memory.insert(
        memory_key("Connection", None, "zh-Hans"),
        "连接".to_string(),
    );
    memory.insert(
        memory_key("Connection Mode", None, "zh-Hans"),
        "连接模式".to_string(),
    );
    memory.insert(memory_key("Ascending", None, "zh-Hans"), "升序".to_string());
    memory.insert(
        memory_key("Descending", None, "zh-Hans"),
        "降序".to_string(),
    );
    memory.insert(
        memory_key("Input Array", None, "zh-Hans"),
        "输入数组".to_string(),
    );
    memory.insert(
        memory_key("Output Array", None, "zh-Hans"),
        "输出数组".to_string(),
    );
    memory.insert(
        memory_key("Return Value", None, "zh-Hans"),
        "返回值".to_string(),
    );
    memory.insert(
        memory_key("Start Index", None, "zh-Hans"),
        "起始索引".to_string(),
    );
    memory.insert(
        memory_key("End Index", None, "zh-Hans"),
        "结束索引".to_string(),
    );
    memory.insert(
        memory_key("Max Distance", None, "zh-Hans"),
        "最大距离".to_string(),
    );
    memory.insert(
        memory_key("Min Distance", None, "zh-Hans"),
        "最小距离".to_string(),
    );
    memory.insert(
        memory_key("Random Stream", None, "zh-Hans"),
        "随机流送".to_string(),
    );
    memory.insert(
        memory_key("Reference Location", None, "zh-Hans"),
        "参考位置".to_string(),
    );
    memory.insert(
        memory_key("Sorted Actors", None, "zh-Hans"),
        "排序后的Actors".to_string(),
    );
    memory.insert(
        memory_key("Original Indices", None, "zh-Hans"),
        "原始索引".to_string(),
    );
    memory.insert(
        memory_key("Static Mesh", None, "zh-Hans"),
        "静态网格体".to_string(),
    );
    memory.insert(
        memory_key("Skeletal Mesh", None, "zh-Hans"),
        "骨骼网格体".to_string(),
    );
    memory.insert(
        memory_key("Is Valid", None, "zh-Hans"),
        "是否有效".to_string(),
    );
    memory.insert(memory_key("In Place", None, "zh-Hans"), "原地".to_string());
    memory.insert(memory_key("By Value", None, "zh-Hans"), "按值".to_string());
    memory.insert(
        memory_key("By Reference", None, "zh-Hans"),
        "按引用".to_string(),
    );

    // 常见短语
    memory.insert(memory_key("Unique", None, "zh-Hans"), "去重".to_string());
    memory.insert(memory_key("Slice", None, "zh-Hans"), "截取".to_string());
    memory.insert(
        memory_key("Primitives", None, "zh-Hans"),
        "基础类型".to_string(),
    );
    memory.insert(
        memory_key("Constant Speed", None, "zh-Hans"),
        "匀速".to_string(),
    );
    memory.insert(memory_key("Stream", None, "zh-Hans"), "流送".to_string());
    memory.insert(memory_key("Asset", None, "zh-Hans"), "资产".to_string());
    memory.insert(memory_key("Index", None, "zh-Hans"), "索引".to_string());
    memory.insert(memory_key("Indices", None, "zh-Hans"), "索引".to_string());
    memory.insert(memory_key("Value", None, "zh-Hans"), "值".to_string());
    memory.insert(memory_key("Weight", None, "zh-Hans"), "权重".to_string());
    memory.insert(
        memory_key("Probability", None, "zh-Hans"),
        "概率".to_string(),
    );
    memory.insert(memory_key("Distance", None, "zh-Hans"), "距离".to_string());
    memory.insert(memory_key("Speed", None, "zh-Hans"), "速度".to_string());
    memory.insert(memory_key("Direction", None, "zh-Hans"), "方向".to_string());
    memory.insert(memory_key("Location", None, "zh-Hans"), "位置".to_string());
    memory.insert(memory_key("Rotation", None, "zh-Hans"), "旋转".to_string());
    memory.insert(memory_key("Scale", None, "zh-Hans"), "缩放".to_string());
    memory.insert(memory_key("True", None, "zh-Hans"), "True".to_string());
    memory.insert(memory_key("False", None, "zh-Hans"), "False".to_string());
    memory.insert(memory_key("None", None, "zh-Hans"), "无".to_string());
    memory.insert(memory_key("Default", None, "zh-Hans"), "默认".to_string());
    memory.insert(memory_key("Custom", None, "zh-Hans"), "自定义".to_string());

    // UE 常用术语
    memory.insert(memory_key("Settings", None, "zh-Hans"), "设置".to_string());
    memory.insert(memory_key("Options", None, "zh-Hans"), "选项".to_string());
    memory.insert(memory_key("File", None, "zh-Hans"), "文件".to_string());
    memory.insert(memory_key("Edit", None, "zh-Hans"), "编辑".to_string());
    memory.insert(memory_key("View", None, "zh-Hans"), "视图".to_string());
    memory.insert(memory_key("Help", None, "zh-Hans"), "帮助".to_string());
    memory.insert(memory_key("Save", None, "zh-Hans"), "保存".to_string());
    memory.insert(memory_key("Load", None, "zh-Hans"), "加载".to_string());
    memory.insert(memory_key("New", None, "zh-Hans"), "新建".to_string());
    memory.insert(memory_key("Open", None, "zh-Hans"), "打开".to_string());
    memory.insert(memory_key("Close", None, "zh-Hans"), "关闭".to_string());
    memory.insert(memory_key("Exit", None, "zh-Hans"), "退出".to_string());
    memory.insert(memory_key("Cancel", None, "zh-Hans"), "取消".to_string());
    memory.insert(memory_key("OK", None, "zh-Hans"), "确定".to_string());
    memory.insert(memory_key("Yes", None, "zh-Hans"), "是".to_string());
    memory.insert(memory_key("No", None, "zh-Hans"), "否".to_string());
    memory.insert(memory_key("Apply", None, "zh-Hans"), "应用".to_string());
    memory.insert(memory_key("Reset", None, "zh-Hans"), "重置".to_string());

    // 游戏相关术语
    memory.insert(memory_key("Player", None, "zh-Hans"), "玩家".to_string());
    memory.insert(memory_key("Game", None, "zh-Hans"), "游戏".to_string());
    memory.insert(memory_key("Level", None, "zh-Hans"), "关卡".to_string());
    memory.insert(memory_key("Score", None, "zh-Hans"), "分数".to_string());
    memory.insert(memory_key("Health", None, "zh-Hans"), "生命值".to_string());
    memory.insert(memory_key("Energy", None, "zh-Hans"), "能量".to_string());
    memory.insert(
        memory_key("Experience", None, "zh-Hans"),
        "经验".to_string(),
    );
    memory.insert(memory_key("Skill", None, "zh-Hans"), "技能".to_string());
    memory.insert(memory_key("Item", None, "zh-Hans"), "物品".to_string());
    memory.insert(memory_key("Inventory", None, "zh-Hans"), "背包".to_string());

    memory
}
