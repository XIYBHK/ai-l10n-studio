use anyhow::Result;
use chrono::{DateTime, Utc};
use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TranslationMemory {
    pub memory: IndexMap<String, String>, // 使用 IndexMap 保持插入顺序
    pub stats: MemoryStats,
    pub last_updated: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MemoryStats {
    pub total_entries: usize,
    pub hits: usize,
    pub misses: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub source: String,
    pub target: String,
    pub created_at: DateTime<Utc>,
    pub hit_count: u32,
}

impl TranslationMemory {
    pub fn new() -> Self {
        // 只加载内置短语
        let builtin = get_builtin_memory();
        let total_entries = builtin.len();

        Self {
            memory: builtin,
            stats: MemoryStats {
                total_entries,
                hits: 0,
                misses: 0,
            },
            last_updated: Utc::now(),
        }
    }

    /// 从文件加载或创建新的TM（合并内置短语）
    pub fn new_from_file<P: AsRef<Path>>(file_path: P) -> Result<Self> {
        let path = file_path.as_ref();

        // 如果文件不存在，加载内置短语（首次使用）
        if !path.exists() {
            let memory = get_builtin_memory();
            let total_entries = memory.len();
            crate::app_log!("[TM] 首次使用，加载内置短语: {} 条", total_entries);
            return Ok(Self {
                memory,
                stats: MemoryStats {
                    total_entries,
                    hits: 0,
                    misses: 0,
                },
                last_updated: Utc::now(),
            });
        }

        // 文件存在，只加载learned部分，不加载内置短语
        let content = fs::read_to_string(path)?;
        let data: serde_json::Value = serde_json::from_str(&content)?;

        let mut memory = IndexMap::new();

        // 尝试加载learned字段（Python格式）
        if let Some(learned_obj) = data.get("learned") {
            if let Some(learned_map) = learned_obj.as_object() {
                for (k, v) in learned_map {
                    if let Some(translation) = v.as_str() {
                        memory.insert(k.clone(), translation.to_string());
                    }
                }
                let learned_count = memory.len();
                if learned_count > 0 {
                    crate::app_log!("[TM] 加载翻译记忆库: {} 条记录", learned_count);
                } else {
                    crate::app_log!("[TM] 记忆库为空");
                }
            }
        } else if let Some(memory_obj) = data.get("memory") {
            // 兼容旧格式（直接保存整个memory）
            if let Some(memory_map) = memory_obj.as_object() {
                for (k, v) in memory_map {
                    if let Some(translation) = v.as_str() {
                        memory.insert(k.clone(), translation.to_string());
                    }
                }
                crate::app_log!("[TM] 加载翻译记忆库（旧格式）: {} 条", memory.len());
            }
        }

        let total_entries = memory.len();
        Ok(Self {
            memory,
            stats: MemoryStats {
                total_entries,
                hits: 0,
                misses: 0,
            },
            last_updated: Utc::now(),
        })
    }

    pub fn load_from_file<P: AsRef<Path>>(file_path: P) -> Result<Self> {
        let path = file_path.as_ref();
        if !path.exists() {
            return Ok(Self::new());
        }

        let content = fs::read_to_string(path)?;
        let memory: TranslationMemory = serde_json::from_str(&content)?;
        Ok(memory)
    }

    /// 保存记忆库到文件
    /// 保存当前 memory 中的所有内容，不再过滤内置词库
    /// 用户清空后内置词库不在 memory 中，用户加载后内置词库在 memory 中
    pub fn save_to_file<P: AsRef<Path>>(&self, file_path: P) -> Result<()> {
        let data = serde_json::json!({
            "learned": self.memory,
            "last_updated": self.last_updated.to_rfc3339(),
            "stats": {
                "total_entries": self.memory.len(),
                "learned_entries": self.memory.len(),
                "hits": self.stats.hits,
                "misses": self.stats.misses,
            }
        });

        let content = serde_json::to_string_pretty(&data)?;
        fs::write(file_path, content)?;

        crate::app_log!("[TM] 保存记忆库: {} 条记录", self.memory.len());
        Ok(())
    }

    /// save_all 现在与 save_to_file 相同，保留以兼容现有调用
    pub fn save_all<P: AsRef<Path>>(&self, file_path: P) -> Result<()> {
        self.save_to_file(file_path)
    }

    /// 根据源文本和目标语言查询翻译
    /// target_lang: 目标语言代码（如 "zh-CN", "ja", "en"）
    pub fn get_translation(&mut self, source: &str, target_lang: Option<&str>) -> Option<String> {
        // 标准化语言代码映射
        fn normalize_lang_code(lang: &str) -> &str {
            match lang {
                "zh-CN" | "zh-TW" | "zh-HK" => "zh-Hans",
                "en-US" | "en-GB" => "en",
                other => other,
            }
        }

        // 尝试按"源文本|目标语言"查询（新格式，支持多语言）
        if let Some(lang) = target_lang {
            let normalized_lang = normalize_lang_code(lang);
            let key_with_lang = format!("{}|{}", source, normalized_lang);
            if let Some(translation) = self.memory.get(&key_with_lang) {
                self.stats.hits += 1;
                crate::app_log!("[TM] 命中翻译（{}）: {} -> {}", lang, source, translation);
                return Some(translation.clone());
            }
        }

        // 降级：尝试不带语言的查询（兼容旧数据）
        self.memory
            .get(source)
            .map(|translation| {
                self.stats.hits += 1;
                crate::app_log!("[TM] 命中翻译（无语言标识）: {} -> {}", source, translation);
                translation.clone()
            })
            .or_else(|| {
                self.stats.misses += 1;
                None
            })
    }

    /// 添加翻译到记忆库
    /// target_lang: 目标语言代码（如 "zh-CN", "ja", "en"）
    pub fn add_translation(&mut self, source: String, target: String, target_lang: Option<&str>) {
        const MAX_CAPACITY: usize = 10000;

        // 修复：使用"源文本|目标语言"作为键，支持多语言
        let key = if let Some(lang) = target_lang {
            format!("{}|{}", source, lang)
        } else {
            source.clone() // 降级：不带语言标识（兼容旧数据）
        };

        // 检查容量限制
        if self.memory.len() >= MAX_CAPACITY {
            // 获取内置短语列表，保护它们不被移除
            let builtin = get_builtin_memory();

            // 查找第一个非内置短语并移除（FIFO策略）
            if let Some(old_key) = self
                .memory
                .keys()
                .find(|k| !builtin.contains_key(k.as_str()))
                .cloned()
            {
                self.memory.shift_remove(&old_key);
                crate::app_log!(
                    "[TM] 达到容量上限({})，移除最早的条目: {}",
                    MAX_CAPACITY,
                    old_key
                );
            }
        }

        self.memory.insert(key, target);
        self.stats.total_entries = self.memory.len();
        self.last_updated = Utc::now();
    }

    /// 批量添加翻译（兼容旧接口，不带语言信息）
    pub fn batch_add_translations(&mut self, translations: Vec<(String, String)>) {
        for (source, target) in translations {
            self.add_translation(source, target, None);
        }
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
        *self = Self::new();
    }

    pub fn get_stats(&self) -> &MemoryStats {
        &self.stats
    }

    pub fn get_size(&self) -> usize {
        self.memory.len()
    }
}

impl Default for TranslationMemory {
    fn default() -> Self {
        Self::new()
    }
}

// 内置的常用翻译记忆（从 Python 版本迁移）
// 所有内置词条默认为简体中文（zh-Hans）
pub fn get_builtin_memory() -> IndexMap<String, String> {
    let mut memory = IndexMap::new();

    // XTools 命名空间
    memory.insert(
        "XTools|Random|zh-Hans".to_string(),
        "XTools|随机".to_string(),
    );
    memory.insert("XTools|Sort|zh-Hans".to_string(), "XTools|排序".to_string());
    memory.insert(
        "XTools|Array|zh-Hans".to_string(),
        "XTools|数组".to_string(),
    );
    memory.insert(
        "XTools|Collision|zh-Hans".to_string(),
        "XTools|碰撞".to_string(),
    );
    memory.insert("XTools|Math|zh-Hans".to_string(), "XTools|数学".to_string());
    memory.insert(
        "XTools|String|zh-Hans".to_string(),
        "XTools|字符串".to_string(),
    );
    memory.insert(
        "XTools|Transform|zh-Hans".to_string(),
        "XTools|Transform".to_string(),
    );
    memory.insert(
        "XTools|Utilities|zh-Hans".to_string(),
        "XTools|工具".to_string(),
    );
    memory.insert(
        "XTools|Debug|zh-Hans".to_string(),
        "XTools|调试".to_string(),
    );

    // Asset Naming 相关
    memory.insert("Asset Naming|zh-Hans".to_string(), "资产命名".to_string());
    memory.insert(
        "Asset Naming|Validation|zh-Hans".to_string(),
        "资产命名|验证".to_string(),
    );
    memory.insert(
        "Asset Naming|Exclusion Rules|zh-Hans".to_string(),
        "资产命名|排除规则".to_string(),
    );
    memory.insert(
        "Asset Naming|Prefix|zh-Hans".to_string(),
        "资产命名|前缀".to_string(),
    );
    memory.insert(
        "Asset Naming|Suffix|zh-Hans".to_string(),
        "资产命名|后缀".to_string(),
    );

    // 常见术语
    memory.insert("Connection|zh-Hans".to_string(), "连接".to_string());
    memory.insert(
        "Connection Mode|zh-Hans".to_string(),
        "连接模式".to_string(),
    );
    memory.insert("Ascending|zh-Hans".to_string(), "升序".to_string());
    memory.insert("Descending|zh-Hans".to_string(), "降序".to_string());
    memory.insert("Input Array|zh-Hans".to_string(), "输入数组".to_string());
    memory.insert("Output Array|zh-Hans".to_string(), "输出数组".to_string());
    memory.insert("Return Value|zh-Hans".to_string(), "返回值".to_string());
    memory.insert("Start Index|zh-Hans".to_string(), "起始索引".to_string());
    memory.insert("End Index|zh-Hans".to_string(), "结束索引".to_string());
    memory.insert("Max Distance|zh-Hans".to_string(), "最大距离".to_string());
    memory.insert("Min Distance|zh-Hans".to_string(), "最小距离".to_string());
    memory.insert("Random Stream|zh-Hans".to_string(), "随机流送".to_string());
    memory.insert(
        "Reference Location|zh-Hans".to_string(),
        "参考位置".to_string(),
    );
    memory.insert(
        "Sorted Actors|zh-Hans".to_string(),
        "排序后的Actors".to_string(),
    );
    memory.insert(
        "Original Indices|zh-Hans".to_string(),
        "原始索引".to_string(),
    );
    memory.insert("Static Mesh|zh-Hans".to_string(), "静态网格体".to_string());
    memory.insert(
        "Skeletal Mesh|zh-Hans".to_string(),
        "骨骼网格体".to_string(),
    );
    memory.insert("Is Valid|zh-Hans".to_string(), "是否有效".to_string());
    memory.insert("In Place|zh-Hans".to_string(), "原地".to_string());
    memory.insert("By Value|zh-Hans".to_string(), "按值".to_string());
    memory.insert("By Reference|zh-Hans".to_string(), "按引用".to_string());

    // 常见短语
    memory.insert("Unique|zh-Hans".to_string(), "去重".to_string());
    memory.insert("Slice|zh-Hans".to_string(), "截取".to_string());
    memory.insert("Primitives|zh-Hans".to_string(), "基础类型".to_string());
    memory.insert("Constant Speed|zh-Hans".to_string(), "匀速".to_string());
    memory.insert("Stream|zh-Hans".to_string(), "流送".to_string());
    memory.insert("Asset|zh-Hans".to_string(), "资产".to_string());
    memory.insert("Index|zh-Hans".to_string(), "索引".to_string());
    memory.insert("Indices|zh-Hans".to_string(), "索引".to_string());
    memory.insert("Value|zh-Hans".to_string(), "值".to_string());
    memory.insert("Weight|zh-Hans".to_string(), "权重".to_string());
    memory.insert("Probability|zh-Hans".to_string(), "概率".to_string());
    memory.insert("Distance|zh-Hans".to_string(), "距离".to_string());
    memory.insert("Speed|zh-Hans".to_string(), "速度".to_string());
    memory.insert("Direction|zh-Hans".to_string(), "方向".to_string());
    memory.insert("Location|zh-Hans".to_string(), "位置".to_string());
    memory.insert("Rotation|zh-Hans".to_string(), "旋转".to_string());
    memory.insert("Scale|zh-Hans".to_string(), "缩放".to_string());
    memory.insert("True|zh-Hans".to_string(), "True".to_string());
    memory.insert("False|zh-Hans".to_string(), "False".to_string());
    memory.insert("None|zh-Hans".to_string(), "无".to_string());
    memory.insert("Default|zh-Hans".to_string(), "默认".to_string());
    memory.insert("Custom|zh-Hans".to_string(), "自定义".to_string());

    // UE 常用术语
    memory.insert("Settings|zh-Hans".to_string(), "设置".to_string());
    memory.insert("Options|zh-Hans".to_string(), "选项".to_string());
    memory.insert("File|zh-Hans".to_string(), "文件".to_string());
    memory.insert("Edit|zh-Hans".to_string(), "编辑".to_string());
    memory.insert("View|zh-Hans".to_string(), "视图".to_string());
    memory.insert("Help|zh-Hans".to_string(), "帮助".to_string());
    memory.insert("Save|zh-Hans".to_string(), "保存".to_string());
    memory.insert("Load|zh-Hans".to_string(), "加载".to_string());
    memory.insert("New|zh-Hans".to_string(), "新建".to_string());
    memory.insert("Open|zh-Hans".to_string(), "打开".to_string());
    memory.insert("Close|zh-Hans".to_string(), "关闭".to_string());
    memory.insert("Exit|zh-Hans".to_string(), "退出".to_string());
    memory.insert("Cancel|zh-Hans".to_string(), "取消".to_string());
    memory.insert("OK|zh-Hans".to_string(), "确定".to_string());
    memory.insert("Yes|zh-Hans".to_string(), "是".to_string());
    memory.insert("No|zh-Hans".to_string(), "否".to_string());
    memory.insert("Apply|zh-Hans".to_string(), "应用".to_string());
    memory.insert("Reset|zh-Hans".to_string(), "重置".to_string());

    // 游戏相关术语
    memory.insert("Player|zh-Hans".to_string(), "玩家".to_string());
    memory.insert("Game|zh-Hans".to_string(), "游戏".to_string());
    memory.insert("Level|zh-Hans".to_string(), "关卡".to_string());
    memory.insert("Score|zh-Hans".to_string(), "分数".to_string());
    memory.insert("Health|zh-Hans".to_string(), "生命值".to_string());
    memory.insert("Energy|zh-Hans".to_string(), "能量".to_string());
    memory.insert("Experience|zh-Hans".to_string(), "经验".to_string());
    memory.insert("Skill|zh-Hans".to_string(), "技能".to_string());
    memory.insert("Item|zh-Hans".to_string(), "物品".to_string());
    memory.insert("Inventory|zh-Hans".to_string(), "背包".to_string());

    memory
}
