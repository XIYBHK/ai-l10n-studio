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
                    crate::app_log!(
                        "[TM] 加载翻译记忆库: {} 条学习记录（不含内置短语）",
                        learned_count
                    );
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

    pub fn save_to_file<P: AsRef<Path>>(&self, file_path: P) -> Result<()> {
        // 分离内置和学习的翻译（与Python版本保持一致）
        let builtin = get_builtin_memory();
        let learned: IndexMap<String, String> = self
            .memory
            .iter()
            .filter(|(k, _)| !builtin.contains_key(k.as_str()))
            .map(|(k, v)| (k.clone(), v.clone()))
            .collect();

        // 构造保存的数据结构（与Python版本一致）
        let data = serde_json::json!({
            "learned": learned,
            "last_updated": self.last_updated.to_rfc3339(),
            "stats": {
                "total_entries": self.stats.total_entries,
                "learned_entries": learned.len(),
                "builtin_entries": builtin.len(),
                "hits": self.stats.hits,
                "misses": self.stats.misses,
            }
        });

        let content = serde_json::to_string_pretty(&data)?;
        fs::write(file_path, content)?;

        crate::app_log!("[TM] 保存翻译记忆库: {} 条学习记录", learned.len());
        Ok(())
    }

    pub fn get_translation(&mut self, source: &str) -> Option<String> {
        // 只查询当前记忆库（learned + 首次加载的builtin）
        // 如果用户删除了某个词条，即使它在builtin中，也不再使用
        if let Some(translation) = self.memory.get(source) {
            self.stats.hits += 1;
            return Some(translation.clone());
        }

        // 未命中
        self.stats.misses += 1;
        None
    }

    pub fn add_translation(&mut self, source: String, target: String) {
        const MAX_CAPACITY: usize = 10000;

        // 检查容量限制
        if self.memory.len() >= MAX_CAPACITY {
            // 获取内置短语列表，保护它们不被移除
            let builtin = get_builtin_memory();

            // 查找第一个非内置短语并移除（FIFO策略）
            if let Some(key) = self
                .memory
                .keys()
                .find(|k| !builtin.contains_key(k.as_str()))
                .cloned()
            {
                self.memory.shift_remove(&key);
                crate::app_log!(
                    "[TM] 达到容量上限({})，移除最早的条目: {}",
                    MAX_CAPACITY,
                    key
                );
            }
        }

        self.memory.insert(source, target);
        self.stats.total_entries = self.memory.len();
        self.last_updated = Utc::now();
    }

    pub fn batch_add_translations(&mut self, translations: Vec<(String, String)>) {
        for (source, target) in translations {
            self.add_translation(source, target);
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
        self.memory.clear();
        self.stats = MemoryStats {
            total_entries: 0,
            hits: 0,
            misses: 0,
        };
        self.last_updated = Utc::now();
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
pub fn get_builtin_memory() -> IndexMap<String, String> {
    let mut memory = IndexMap::new();

    // XTools 命名空间
    memory.insert("XTools|Random".to_string(), "XTools|随机".to_string());
    memory.insert("XTools|Sort".to_string(), "XTools|排序".to_string());
    memory.insert("XTools|Array".to_string(), "XTools|数组".to_string());
    memory.insert("XTools|Collision".to_string(), "XTools|碰撞".to_string());
    memory.insert("XTools|Math".to_string(), "XTools|数学".to_string());
    memory.insert("XTools|String".to_string(), "XTools|字符串".to_string());
    memory.insert(
        "XTools|Transform".to_string(),
        "XTools|Transform".to_string(),
    );
    memory.insert("XTools|Utilities".to_string(), "XTools|工具".to_string());
    memory.insert("XTools|Debug".to_string(), "XTools|调试".to_string());

    // Asset Naming 相关
    memory.insert("Asset Naming".to_string(), "资产命名".to_string());
    memory.insert(
        "Asset Naming|Validation".to_string(),
        "资产命名|验证".to_string(),
    );
    memory.insert(
        "Asset Naming|Exclusion Rules".to_string(),
        "资产命名|排除规则".to_string(),
    );
    memory.insert(
        "Asset Naming|Prefix".to_string(),
        "资产命名|前缀".to_string(),
    );
    memory.insert(
        "Asset Naming|Suffix".to_string(),
        "资产命名|后缀".to_string(),
    );

    // 常见术语
    memory.insert("Connection".to_string(), "连接".to_string());
    memory.insert("Connection Mode".to_string(), "连接模式".to_string());
    memory.insert("Ascending".to_string(), "升序".to_string());
    memory.insert("Descending".to_string(), "降序".to_string());
    memory.insert("Input Array".to_string(), "输入数组".to_string());
    memory.insert("Output Array".to_string(), "输出数组".to_string());
    memory.insert("Return Value".to_string(), "返回值".to_string());
    memory.insert("Start Index".to_string(), "起始索引".to_string());
    memory.insert("End Index".to_string(), "结束索引".to_string());
    memory.insert("Max Distance".to_string(), "最大距离".to_string());
    memory.insert("Min Distance".to_string(), "最小距离".to_string());
    memory.insert("Random Stream".to_string(), "随机流送".to_string());
    memory.insert("Reference Location".to_string(), "参考位置".to_string());
    memory.insert("Sorted Actors".to_string(), "排序后的Actors".to_string());
    memory.insert("Original Indices".to_string(), "原始索引".to_string());
    memory.insert("Static Mesh".to_string(), "静态网格体".to_string());
    memory.insert("Skeletal Mesh".to_string(), "骨骼网格体".to_string());
    memory.insert("Is Valid".to_string(), "是否有效".to_string());
    memory.insert("In Place".to_string(), "原地".to_string());
    memory.insert("By Value".to_string(), "按值".to_string());
    memory.insert("By Reference".to_string(), "按引用".to_string());

    // 常见短语
    memory.insert("Unique".to_string(), "去重".to_string());
    memory.insert("Slice".to_string(), "截取".to_string());
    memory.insert("Primitives".to_string(), "基础类型".to_string());
    memory.insert("Constant Speed".to_string(), "匀速".to_string());
    memory.insert("Stream".to_string(), "流送".to_string());
    memory.insert("Asset".to_string(), "资产".to_string());
    memory.insert("Index".to_string(), "索引".to_string());
    memory.insert("Indices".to_string(), "索引".to_string());
    memory.insert("Value".to_string(), "值".to_string());
    memory.insert("Weight".to_string(), "权重".to_string());
    memory.insert("Probability".to_string(), "概率".to_string());
    memory.insert("Distance".to_string(), "距离".to_string());
    memory.insert("Speed".to_string(), "速度".to_string());
    memory.insert("Direction".to_string(), "方向".to_string());
    memory.insert("Location".to_string(), "位置".to_string());
    memory.insert("Rotation".to_string(), "旋转".to_string());
    memory.insert("Scale".to_string(), "缩放".to_string());
    memory.insert("True".to_string(), "True".to_string());
    memory.insert("False".to_string(), "False".to_string());
    memory.insert("None".to_string(), "无".to_string());
    memory.insert("Default".to_string(), "默认".to_string());
    memory.insert("Custom".to_string(), "自定义".to_string());

    // UE 常用术语
    memory.insert("Settings".to_string(), "设置".to_string());
    memory.insert("Options".to_string(), "选项".to_string());
    memory.insert("File".to_string(), "文件".to_string());
    memory.insert("Edit".to_string(), "编辑".to_string());
    memory.insert("View".to_string(), "视图".to_string());
    memory.insert("Help".to_string(), "帮助".to_string());
    memory.insert("Save".to_string(), "保存".to_string());
    memory.insert("Load".to_string(), "加载".to_string());
    memory.insert("New".to_string(), "新建".to_string());
    memory.insert("Open".to_string(), "打开".to_string());
    memory.insert("Close".to_string(), "关闭".to_string());
    memory.insert("Exit".to_string(), "退出".to_string());
    memory.insert("Cancel".to_string(), "取消".to_string());
    memory.insert("OK".to_string(), "确定".to_string());
    memory.insert("Yes".to_string(), "是".to_string());
    memory.insert("No".to_string(), "否".to_string());
    memory.insert("Apply".to_string(), "应用".to_string());
    memory.insert("Reset".to_string(), "重置".to_string());

    // 游戏相关术语
    memory.insert("Player".to_string(), "玩家".to_string());
    memory.insert("Game".to_string(), "游戏".to_string());
    memory.insert("Level".to_string(), "关卡".to_string());
    memory.insert("Score".to_string(), "分数".to_string());
    memory.insert("Health".to_string(), "生命值".to_string());
    memory.insert("Energy".to_string(), "能量".to_string());
    memory.insert("Experience".to_string(), "经验".to_string());
    memory.insert("Skill".to_string(), "技能".to_string());
    memory.insert("Item".to_string(), "物品".to_string());
    memory.insert("Inventory".to_string(), "背包".to_string());

    memory
}
