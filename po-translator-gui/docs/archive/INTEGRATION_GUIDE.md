# Store Plugin 集成指南

## 🎯 目标

让 TauriStore 在应用启动时自动工作，用户的设置能够持久化保存。

---

## 📊 执行流程图

```
用户打开应用
    ↓
App.tsx 启动
    ↓
useEffect 执行 (只一次)
    ↓
┌─────────────────────────────┐
│ autoMigrate()               │ ← 迁移工具
│                             │
│ 检查是否需要迁移？           │
│ if (有localStorage && 无Store) │
│   ✅ 执行迁移               │ ← 只第1次
│ else                        │
│   ❌ 跳过                   │ ← 以后都这样
└─────────────────────────────┘
    ↓
┌─────────────────────────────┐
│ initializeStores()          │ ← 加载数据
│                             │
│ 并行加载:                    │
│ - loadSettings()            │
│ - loadStats()               │
│                             │
│ 从 TauriStore 读取:         │
│ - theme: 'dark'             │
│ - language: 'zh-CN'         │
│ - cumulativeStats: {...}    │
└─────────────────────────────┘
    ↓
应用界面显示
- 主题: dark (用户上次的设置) ✅
- 语言: zh-CN (用户上次的设置) ✅
- 统计: 正确的累计数据 ✅
```

---

## 🔧 集成步骤

### Step 1: 找到 App.tsx

文件位置: `src/App.tsx`

### Step 2: 在文件顶部添加导入

```typescript
// 在其他 import 之后添加
import { initializeStores } from './store';
import { autoMigrate } from './utils/storeMigration';
```

### Step 3: 在组件中添加初始化

```typescript
function App() {
  // 在现有的 hooks 之后添加
  
  // 🆕 Store 初始化
  useEffect(() => {
    const initStores = async () => {
      try {
        console.log('🚀 开始初始化 Store...');
        
        // 1. 检查并迁移旧数据 (只执行一次)
        const { migrated, result } = await autoMigrate();
        if (migrated) {
          console.log('✅ 数据迁移成功:', result?.migratedKeys);
        }
        
        // 2. 加载所有持久化数据
        await initializeStores();
        console.log('✅ Store 初始化完成');
        
      } catch (error) {
        console.error('❌ Store 初始化失败:', error);
      }
    };
    
    initStores();
  }, []); // 空依赖数组 = 只执行一次
  
  // ... 其他代码保持不变
}
```

---

## 🎬 完整示例

### 修改前 (App.tsx)

```typescript
function App() {
  const [settingsVisible, setSettingsVisible] = useState(false);
  // ... 其他代码
  
  return (
    <ConfigProvider theme={...}>
      {/* UI 组件 */}
    </ConfigProvider>
  );
}
```

### 修改后 (App.tsx)

```typescript
import { initializeStores } from './store';
import { autoMigrate } from './utils/storeMigration';

function App() {
  const [settingsVisible, setSettingsVisible] = useState(false);
  // ... 其他代码
  
  // 🆕 添加 Store 初始化
  useEffect(() => {
    const initStores = async () => {
      try {
        const { migrated } = await autoMigrate();
        if (migrated) {
          console.log('✅ 旧数据迁移成功');
        }
        await initializeStores();
        console.log('✅ Store 加载完成');
      } catch (error) {
        console.error('❌ Store 初始化失败:', error);
      }
    };
    initStores();
  }, []);
  
  return (
    <ConfigProvider theme={...}>
      {/* UI 组件 */}
    </ConfigProvider>
  );
}
```

---

## 🧪 测试验证

### 1. 启动应用

```bash
npm run tauri:dev
```

### 2. 查看控制台日志

应该看到:
```
🚀 开始初始化 Store...
[Migration] 不需要迁移  (或) [Migration] 迁移成功: ['theme', 'language', ...]
[useSettingsStore] 设置加载成功 { theme: 'dark', language: 'zh' }
[useStatsStore] 统计加载成功 { totalTranslated: 100, ... }
✅ Store 初始化完成
```

### 3. 测试主题切换

1. 点击主题切换按钮
2. 主题应该立即改变
3. 查看控制台: `[TauriStore] 设置 theme: dark`

### 4. 重启应用验证

1. 关闭应用
2. 重新启动: `npm run tauri:dev`
3. 主题应该保持上次的设置 ✅

### 5. 检查数据文件

Windows 位置:
```
C:\Users\{你的用户名}\AppData\Roaming\com.potranslator.gui\app-settings.json
```

打开文件应该看到:
```json
{
  "theme": "dark",
  "language": "zh-CN",
  "cumulativeStats": {
    "totalTranslated": 100,
    "totalTokens": 1000,
    "totalCost": 0.5,
    ...
  }
}
```

---

## ❓ 常见问题

### Q: 迁移工具会一直运行吗？
A: 不会。只在第一次检测到旧数据时运行一次，之后自动跳过。

### Q: 如果不集成会怎样？
A: Store 代码不会被调用，用户设置无法保存，每次启动都是默认值。

### Q: 集成后会影响性能吗？
A: 几乎没影响。初始化只在启动时执行一次，耗时不到 100ms。

### Q: 如果初始化失败怎么办？
A: 有 try-catch 处理，应用仍可正常运行，只是使用默认设置。

---

## ✅ 检查清单

集成完成后确认:
- [ ] 导入了 `initializeStores` 和 `autoMigrate`
- [ ] 添加了 useEffect 调用
- [ ] 启动应用看到初始化日志
- [ ] 主题切换后重启仍保持
- [ ] 控制台无错误

---

**集成完成！** 🎉

现在 Store Plugin 已经完全可用，用户的所有设置都会自动保存和恢复。

