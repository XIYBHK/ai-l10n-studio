# 开发指南与最佳实践

> 避免重复问题，提升开发效率

---

## 🎯 开发流程

### 1. 启动开发环境

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run tauri:dev

# 3. 查看日志
# - 前端日志：浏览器控制台
# - 后端日志：终端输出
```

### 2. 修改代码后

**前端修改** (`.tsx`, `.ts`, `.css`):
- ✅ 自动热重载
- ✅ 无需重启

**后端修改** (`.rs`):
- ⚠️ 需要重新编译（自动）
- ⏱️ 等待5-10秒

**配置修改** (`tauri.conf.json`, `Cargo.toml`):
- ❌ 需要手动重启

---

## 🚫 常见问题清单

### 问题1: 翻译后应用自动重启

**现象**: 完成翻译后，应用突然重启

**原因**: 翻译记忆库保存到 `src-tauri/data/`，触发热重载

**解决**:
```rust
// ❌ 错误：在src-tauri目录内
let path = "data/translation_memory.json";

// ✅ 正确：使用项目根目录
let path = "../data/translation_memory.json";
```

**修改位置**:
- `commands/translator.rs`
- `services/batch_translator.rs`
- `services/ai_translator.rs`
- `services/config_manager.rs`

---

### 问题2: 记忆库保存失败

**现象**: 点击"保存"后提示失败

**原因**: 前端数据格式不正确

**解决**:
```typescript
// ❌ 错误：缺少必需字段
await invoke('save_translation_memory', {
  memory: memoryMap
});

// ✅ 正确：完整的TranslationMemory结构
await invoke('save_translation_memory', {
  memory: {
    memory: memoryMap,
    stats: {
      total_entries: memories.length,
      hits: 0,
      misses: 0
    },
    last_updated: new Date().toISOString()
  }
});
```

---

### 问题3: 记忆库数据丢失

**现象**: 重启后内置短语消失

**原因**: 保存时把内置短语也保存了，覆盖了代码逻辑

**解决**:
```rust
// 保存时只保存learned部分
pub fn save_to_file(&self, path: P) -> Result<()> {
    let builtin = get_builtin_memory();
    let learned: IndexMap<_, _> = self.memory.iter()
        .filter(|(k, _)| !builtin.contains_key(k.as_str()))
        .map(|(k, v)| (k.clone(), v.clone()))
        .collect();
    
    let data = serde_json::json!({
        "learned": learned,  // 只保存learned
        "last_updated": self.last_updated.to_rfc3339(),
        "stats": {...}
    });
    
    fs::write(path, serde_json::to_string_pretty(&data)?)?;
    Ok(())
}
```

---

### 问题4: 暗色模式颜色错误

**现象**: 切换到暗色模式后，某些区域仍是白色

**原因**: 使用了硬编码颜色值

**解决**:
```typescript
// ❌ 错误：硬编码
<div style={{ background: '#fff', color: '#000' }}>

// ✅ 正确：使用主题变量
const { colors } = useTheme();
<div style={{ 
  background: colors.bgPrimary, 
  color: colors.textPrimary 
}}>
```

**检查清单**:
- [ ] 所有 `background` 使用 `colors.bgXxx`
- [ ] 所有 `color` 使用 `colors.textXxx`
- [ ] 所有 `border` 使用 `colors.borderXxx`
- [ ] CSS 使用 `[data-theme='dark']` 选择器

---

### 问题5: 学习的短语太多

**现象**: 每次翻译都学习几十个短语，包括长句子

**原因**: `is_simple_phrase()` 判断条件太宽松

**解决**: 确保规则与Python版本一致
```rust
fn is_simple_phrase(text: &str) -> bool {
    // 1. 长度 ≤ 35
    if text.len() > 35 { return false; }
    
    // 2. 无句子标点
    let endings = [". ", "! ", "? ", "。", "！", "？"];
    if endings.iter().any(|e| text.contains(e)) { return false; }
    
    // 3. 单词数 ≤ 5
    if text.split_whitespace().count() > 5 { return false; }
    
    // 4. 无占位符
    if text.contains("{0}") || text.contains("{1}") { return false; }
    
    // 5. 无转义字符
    if text.contains("\\n") || text.contains("\\t") { return false; }
    
    // 6. 无特殊符号
    if text.contains('(') || text.contains('[') { return false; }
    
    // 7. 非疑问句开头
    let first = text.split_whitespace().next().unwrap_or("");
    let questions = ["Whether", "How", "What", "When", "Where", "Why"];
    if questions.contains(&first) { return false; }
    
    true
}
```

---

### 问题6: 词条顺序混乱

**现象**: 每次打开记忆库，词条顺序都不一样

**原因**: 使用 `HashMap` 无序

**解决**:
```rust
// ❌ 错误
use std::collections::HashMap;
pub struct TranslationMemory {
    pub memory: HashMap<String, String>,
}

// ✅ 正确
use indexmap::IndexMap;
pub struct TranslationMemory {
    pub memory: IndexMap<String, String>,
}

// Cargo.toml 添加依赖
indexmap = { version = "2.0", features = ["serde"] }
```

---

### 问题7: 清空记忆库后报错

**现象**: 点击"清空"后，重新打开记忆库报错

**原因**: 
1. 清空时未保存到后端
2. 加载时未处理空数据

**解决**:
```typescript
// 1. 清空时立即保存
const handleClearAll = async () => {
  setMemories([]);
  
  // 保存空数据到后端
  await invoke('save_translation_memory', {
    memory: {
      memory: {},  // 空对象
      stats: { total_entries: 0, hits: 0, misses: 0 },
      last_updated: new Date().toISOString()
    }
  });
};

// 2. 加载时处理空数据
const loadMemories = async () => {
  try {
    const tm = await invoke('get_translation_memory');
    if (tm && tm.memory) {
      setMemories(Object.entries(tm.memory).map(...));
    } else {
      setMemories([]);  // 空数据也正常
    }
  } catch (error) {
    setMemories([]);  // 失败时也显示空列表
  }
};
```

---

## 📋 开发检查清单

### 添加新功能前

- [ ] 检查 `ARCHITECTURE.md` 了解模块划分
- [ ] 检查 `DATA_CONTRACT.md` 了解数据格式
- [ ] 确定功能属于哪一层（UI/Command/Service）
- [ ] 考虑是否需要新的 Tauri Command

### 修改数据结构时

- [ ] 同步更新 Rust 结构体
- [ ] 同步更新 TypeScript 接口
- [ ] 更新 `DATA_CONTRACT.md`
- [ ] 检查序列化/反序列化是否正确
- [ ] 测试数据保存和加载

### 修改UI时

- [ ] 使用 `useTheme()` 获取颜色
- [ ] 避免硬编码颜色值
- [ ] 测试亮色和暗色模式
- [ ] 检查响应式布局
- [ ] 验证国际化文本

### 修改翻译逻辑时

- [ ] 对比 Python 版本确保逻辑一致
- [ ] 检查 `is_simple_phrase()` 规则
- [ ] 验证 TM 学习行为
- [ ] 测试统计数据准确性
- [ ] 检查日志输出

### 提交代码前

- [ ] 运行 `npm run build` 确保编译通过
- [ ] 检查终端无警告
- [ ] 测试主要功能正常
- [ ] 更新相关文档
- [ ] 写清晰的 commit message

---

## 🔧 调试技巧

### 1. 查看 Tauri 调用

**前端**:
```typescript
try {
  console.log('调用 command，参数:', params);
  const result = await invoke('command', params);
  console.log('返回结果:', result);
  return result;
} catch (error) {
  console.error('调用失败:', error);
  throw error;
}
```

**后端**:
```rust
#[tauri::command]
pub async fn command(params: Params) -> Result<Data, String> {
    println!("[DEBUG] 收到调用: {:?}", params);
    
    let result = process(params)?;
    
    println!("[DEBUG] 返回结果: {:?}", result);
    Ok(result)
}
```

### 2. 检查文件保存

```rust
pub fn save_to_file(&self, path: P) -> Result<()> {
    let content = serde_json::to_string_pretty(self)?;
    
    // 打印保存内容
    println!("[保存] 路径: {}", path.as_ref().display());
    println!("[保存] 内容预览: {}", &content[..content.len().min(200)]);
    
    fs::write(path, content)?;
    Ok(())
}
```

### 3. 验证数据格式

```typescript
// 发送前验证
const data = {
  memory: { ... },
  stats: { ... },
  last_updated: new Date().toISOString()
};

console.log('数据格式检查:', {
  hasMemory: !!data.memory,
  hasStats: !!data.stats,
  hasTimestamp: !!data.last_updated,
  memoryCount: Object.keys(data.memory).length
});

await invoke('save_translation_memory', data);
```

### 4. 追踪状态变化

```typescript
// 使用 Zustand 的 devtools
import { devtools } from 'zustand/middleware';

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({ ... }),
      { name: 'app-storage' }
    ),
    { name: 'AppStore' }
  )
);

// 在浏览器中查看 Redux DevTools
```

---

## 🎨 代码风格

### TypeScript

```typescript
// ✅ 推荐
import { useState, useEffect } from 'react';
import { Button, message } from 'antd';
import { useTheme } from '../hooks/useTheme';

export const MyComponent: React.FC<Props> = ({ data }) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    // 副作用逻辑
  }, []);
  
  const handleClick = async () => {
    try {
      setLoading(true);
      const result = await invoke('command', { data });
      message.success('成功');
    } catch (error) {
      message.error('失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div style={{ background: colors.bgPrimary }}>
      <Button onClick={handleClick} loading={loading}>
        操作
      </Button>
    </div>
  );
};
```

### Rust

```rust
// ✅ 推荐
use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MyData {
    pub field: String,
}

impl MyData {
    pub fn new(field: String) -> Self {
        Self { field }
    }
    
    pub fn process(&self) -> Result<String> {
        // 处理逻辑
        Ok(self.field.clone())
    }
}

#[tauri::command]
pub async fn my_command(data: MyData) -> Result<String, String> {
    data.process()
        .map_err(|e| e.to_string())
}
```

---

## 📚 学习资源

### 官方文档
- [Tauri 官方文档](https://tauri.app/v1/guides/)
- [Ant Design React](https://ant.design/components/overview/)
- [Zustand](https://github.com/pmndrs/zustand)
- [Rust Book](https://doc.rust-lang.org/book/)

### 项目文档
1. `ARCHITECTURE.md` - 架构总览
2. `DATA_CONTRACT.md` - 数据契约
3. `DEVELOPMENT_GUIDE.md` - 本文档
4. `ARCHITECTURE_COMPARISON.md` - Python vs Rust 对比

### 调试工具
- Chrome DevTools - 前端调试
- Rust Analyzer - Rust 代码智能
- Redux DevTools - 状态管理调试
- Tauri DevTools - 即将推出

---

## 🚀 性能优化建议

### 1. 减少重渲染

```typescript
// ❌ 每次都创建新对象
const style = { background: colors.bgPrimary };

// ✅ 使用 useMemo
const style = useMemo(() => ({
  background: colors.bgPrimary
}), [colors.bgPrimary]);
```

### 2. 避免大数组操作

```typescript
// ❌ 每次创建新数组
const updateEntry = (index: number, data: Partial<Entry>) => {
  const newEntries = [...entries];  // 复制整个数组
  newEntries[index] = { ...newEntries[index], ...data };
  setEntries(newEntries);
};

// ✅ 使用 immer
import produce from 'immer';

const updateEntry = (index: number, data: Partial<Entry>) => {
  setEntries(produce(draft => {
    draft[index] = { ...draft[index], ...data };
  }));
};
```

### 3. 批量更新

```typescript
// ❌ 多次更新
selectedIndices.forEach(index => {
  updateEntry(index, { needsReview: false });
});

// ✅ 一次更新
setEntries(produce(draft => {
  selectedIndices.forEach(index => {
    draft[index].needsReview = false;
  });
}));
```

---

## 🐛 遇到问题时

### 1. 检查日志
- 浏览器控制台
- 终端输出
- `~/.po-translator/` 日志文件

### 2. 验证数据
- 检查发送的数据格式
- 检查返回的数据格式
- 对比 `DATA_CONTRACT.md`

### 3. 隔离问题
- 是前端问题还是后端问题？
- 是数据问题还是逻辑问题？
- 能否复现？

### 4. 查找文档
- 搜索本项目文档
- 查看 GitHub Issues
- 阅读官方文档

### 5. 寻求帮助
- 提供完整的错误信息
- 说明复现步骤
- 附上相关代码

---

**最后更新**: 2025-01-06

