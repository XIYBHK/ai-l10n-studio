# Tasks: 关键用户界面和功能问题修复

**Input**: Design documents from `/specs/001-bug-7/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 本次BUG修复采用TDD方法，每个修复前先编写失败的测试

**Organization**: 任务按用户故事组织，每个故事独立可测试

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行执行（不同文件，无依赖）
- **[Story]**: 所属用户故事（US1, US2, US3, US4, US5, US6）
- 包含准确的文件路径

## Path Conventions

- Frontend: `src/` at repository root
- Backend: `src-tauri/src/` at repository root
- Tests: `src/__tests__/` for frontend, inline for backend

---

## Phase 1: Setup（共享基础设施）

**Purpose**: 项目初始化和开发环境准备

- [x] T001 Git分支已创建并检出 (`001-bug-7`)
- [x] T002 规范文档已完成 (spec.md, plan.md, research.md, data-model.md, contracts/)
- [ ] T003 [P] 确保开发环境就绪 (`npm install`, Rust工具链)
- [ ] T004 [P] 创建测试数据目录 (`specs/001-bug-7/test-data/`)

---

## Phase 2: Foundational（阻塞性前置任务）

**Purpose**: 所有用户故事依赖的核心基础设施，必须在任何故事开始前完成

**⚠️ CRITICAL**: 本Phase必须100%完成才能开始任何用户故事

- [ ] T005 验证 `commands.ts` 中的命令定义是否与后端一致
  - 位置：`src/services/commands.ts`
  - 检查：`COMMANDS.SYSTEM_PROMPT_SET` = `'update_system_prompt'` (不是 `set_system_prompt`)
  - 检查：`COMMANDS.LANGUAGE_GET_DEFAULT_TARGET` 参数命名

- [ ] T006 验证后端命令注册
  - 位置：`src-tauri/src/main.rs`
  - 确认已注册：`update_system_prompt`, `get_default_target_lang`, `add_ai_config`

- [ ] T007 创建测试辅助工具模块
  - 位置：`src/__tests__/utils/test-helpers.ts`
  - 功能：Mock Tauri invoke, 创建测试配置对象, 清理函数

**Checkpoint**: Foundation ready - 用户故事实现可以并行开始

---

## Phase 3: User Story 1 - AI配置保存失败修复 (Priority: P1) 🎯 MVP

**Goal**: 修复AI配置保存时的 `missing field api_key` 错误

**Independent Test**: 打开设置 → 添加AI配置 → 测试连接成功 → 保存 → 验证配置已保存且无错误

### Tests for User Story 1 ⚠️

**NOTE: 编写测试，确保失败后再实现修复**

- [ ] T008 [P] [US1] 单元测试：AI配置对象结构验证
  - 位置：`src/__tests__/bug-fixes/ai-config-validation.test.ts`
  - 测试：`AIConfig` 对象包含所有必需字段（id, name, provider, api_key, model）
  - 测试：字段命名使用蛇形（`api_key` 不是 `apiKey`）
  - 预期：测试失败（当前可能使用驼峰命名）

- [ ] T009 [P] [US1] 集成测试：完整的保存流程
  - 位置：`src/__tests__/bug-fixes/ai-config-save.test.tsx`
  - 测试：模拟用户填写表单 → 调用 `aiConfigCommands.add()` → 验证参数正确
  - Mock：`invoke` 函数，验证传递的 config 对象结构
  - 预期：测试失败（当前 api_key 字段缺失）

### Implementation for User Story 1

- [ ] T010 [US1] 修复 SettingsModal 中的配置对象构造
  - 位置：`src/components/SettingsModal.tsx`
  - 问题：保存时未包含 `api_key` 字段或字段命名错误
  - 修复：确保 `newConfig` 对象包含所有必需字段，使用蛇形命名
  - 代码示例：
    ```typescript
    const newConfig: AIConfig = {
      id: nanoid(),
      name: configName,
      provider: selectedProvider,
      api_key: apiKey, // ✅ 显式包含，蛇形命名
      model: selectedModel,
      base_url: baseUrl || undefined,
      is_active: false,
    };
    ```

- [ ] T011 [US1] 验证 `aiConfigCommands.add()` 的参数传递
  - 位置：`src/services/commands.ts` (检查，通常无需修改)
  - 确认：`add(config: AIConfig)` 完整传递对象
  - 如果需要：添加字段验证和明确的错误提示

- [ ] T012 [US1] 添加前端字段验证
  - 位置：`src/components/SettingsModal.tsx`
  - 功能：保存前验证 `apiKey` 非空
  - 提示：明确的错误消息（"API密钥不能为空"）

- [ ] T013 [US1] 验证后端 `add_ai_config` 命令
  - 位置：`src-tauri/src/commands/config.rs` (检查，通常无需修改)
  - 确认：接受完整的 `AIConfig` 结构
  - 确认：使用 `ConfigDraft::global().await` 模式

**Checkpoint**: 运行 `npm run test` 验证 T008-T009 现在通过，手动测试 quickstart.md 的验证1

---

## Phase 4: User Story 2 - 系统提示词保存失败修复 (Priority: P1)

**Goal**: 修复 `Command set_system_prompt not found` 错误

**Independent Test**: 打开设置 → 系统提示词标签 → 修改内容 → 保存 → 验证无错误且内容已保存

### Tests for User Story 2 ⚠️

- [ ] T014 [P] [US2] 单元测试：系统提示词命令名称验证
  - 位置：`src/__tests__/bug-fixes/system-prompt-command.test.ts`
  - 测试：`COMMANDS.SYSTEM_PROMPT_SET` 的值为 `'update_system_prompt'`
  - 测试：调用 `systemPromptCommands.update()` 使用正确的命令名
  - 预期：测试失败（如果使用了错误的命令名）

- [ ] T015 [P] [US2] 集成测试：完整的保存流程
  - 位置：`src/__tests__/bug-fixes/system-prompt-save.test.tsx`
  - 测试：调用 `systemPromptCommands.update(prompt)` → 验证invoke参数
  - Mock：验证调用的命令名为 `update_system_prompt`
  - 预期：测试失败（如果命令名错误）

### Implementation for User Story 2

- [ ] T016 [US2] 修复 SettingsModal 中的系统提示词保存调用
  - 位置：`src/components/SettingsModal.tsx`
  - 查找：所有调用系统提示词保存的代码
  - 修复：使用 `systemPromptCommands.update(newPrompt)`
  - 删除：任何直接调用 `invoke('set_system_prompt', ...)` 的代码

- [ ] T017 [US2] 验证 commands.ts 中的命令定义
  - 位置：`src/services/commands.ts`
  - 确认：`COMMANDS.SYSTEM_PROMPT_SET = 'update_system_prompt'`
  - 确认：`systemPromptCommands.update()` 使用该常量
  - 通常无需修改（已正确）

- [ ] T018 [US2] 检查并移除 api.ts 中的旧实现
  - 位置：`src/services/api.ts`
  - 搜索：`set_system_prompt` 或旧的调用方式
  - 删除：遗留代码（如果有）

**Checkpoint**: 运行测试验证 T014-T015 通过，手动测试 quickstart.md 的验证2

---

## Phase 5: User Story 3 - 文件加载后语言检测失败修复 (Priority: P1)

**Goal**: 修复 `missing required key sourceLangCode` 参数命名错误

**Independent Test**: 打开文件 → 选择英文PO → 验证自动检测源语言且无错误提示

### Tests for User Story 3 ⚠️

- [ ] T019 [P] [US3] 单元测试：语言检测参数命名
  - 位置：`src/__tests__/bug-fixes/language-detect-params.test.ts`
  - 测试：`i18nCommands.getDefaultTargetLanguage()` 传递蛇形命名参数
  - Mock：验证 invoke 接收 `{ source_lang_code: 'en' }` 而非 `{ sourceLangCode: 'en' }`
  - 预期：测试失败（当前使用驼峰）

- [ ] T020 [P] [US3] 集成测试：文件加载后的语言检测流程
  - 位置：`src/__tests__/bug-fixes/language-detect.test.tsx`
  - 测试：加载PO文件 → 检测语言 → 获取默认目标语言
  - Mock：PO文件解析，验证参数传递正确
  - 预期：测试失败（参数命名错误）

### Implementation for User Story 3

- [ ] T021 [US3] 修复 commands.ts 中的参数命名转换
  - 位置：`src/services/commands.ts` 第545-553行
  - 当前：
    ```typescript
    async getDefaultTargetLanguage(sourceLangCode: string) {
      return invoke(COMMANDS.LANGUAGE_GET_DEFAULT_TARGET,
        { sourceLangCode }, // ❌ 驼峰
      );
    }
    ```
  - 修复：
    ```typescript
    async getDefaultTargetLanguage(sourceLangCode: string) {
      return invoke(COMMANDS.LANGUAGE_GET_DEFAULT_TARGET,
        { source_lang_code: sourceLangCode }, // ✅ 蛇形
      );
    }
    ```

- [ ] T022 [US3] 验证 App.tsx 中的调用方式
  - 位置：`src/App.tsx`
  - 确认：使用 `i18nCommands.getDefaultTargetLanguage(detectedLang.code)`
  - 无需修改（已通过 commands.ts 封装）

- [ ] T023 [US3] 改进错误提示
  - 位置：`src/App.tsx` 的错误处理部分
  - 当前：通用的"获取默认目标语言失败"
  - 改进：显示检测到的源语言和建议操作

**Checkpoint**: 运行测试验证 T019-T020 通过，手动测试 quickstart.md 的验证3

---

## Phase 6: User Story 4 - 主题切换响应修复 (Priority: P2)

**Goal**: 修复需要点击两次主题切换按钮的问题

**Independent Test**: 当前亮色 → 点击一次 → 立即变暗色 → 再点击一次 → 立即变亮色

### Tests for User Story 4 ⚠️

- [ ] T024 [P] [US4] 单元测试：主题状态同步
  - 位置：`src/__tests__/bug-fixes/theme-toggle-state.test.ts`
  - 测试：`useAppStore` 的 `setTheme()` 立即更新状态
  - 测试：连续调用3次，状态变化3次
  - 预期：测试可能失败（如有双重状态管理）

- [ ] T025 [P] [US4] 集成测试：主题切换组件行为
  - 位置：`src/__tests__/bug-fixes/theme-toggle.test.tsx`
  - 测试：点击按钮 → 验证 DOM 的 `data-theme` 属性立即更新
  - 测试：快速连续点击3次 → 验证最终状态正确
  - 预期：测试失败（如需点击两次）

### Implementation for User Story 4

- [ ] T026 [US4] 分析 ThemeModeSwitch 组件的状态管理
  - 位置：`src/components/ThemeModeSwitch.tsx`
  - 检查：是否同时使用 Zustand state 和 React state
  - 识别：状态不同步的根本原因

- [ ] T027 [US4] 修复主题切换逻辑（单一状态源）
  - 位置：`src/components/ThemeModeSwitch.tsx`
  - 删除：组件内部的 React state（如果有）
  - 修复：直接从 `useAppStore` 读取和更新
  - 代码示例：

    ```typescript
    const theme = useAppStore((state) => state.theme);
    const setTheme = useAppStore((state) => state.setTheme);

    const handleToggle = () => {
      const newTheme = theme === 'light' ? 'dark' : 'light';
      setTheme(newTheme); // ✅ 直接更新，无中间状态
    };
    ```

- [ ] T028 [US4] 确保 useEffect 正确监听主题变化
  - 位置：`src/components/ThemeModeSwitch.tsx` 或 `src/hooks/useTheme.ts`
  - 添加/修复：
    ```typescript
    useEffect(() => {
      document.documentElement.setAttribute('data-theme', theme);
    }, [theme]); // ✅ 每次theme变化立即应用
    ```

- [ ] T029 [US4] 验证 Zustand store 的持久化配置
  - 位置：`src/store/useAppStore.ts`
  - 确认：主题状态正确持久化到 Tauri Store
  - 确认：持久化不会延迟UI更新

**Checkpoint**: 运行测试验证 T024-T025 通过，手动快速点击3次验证响应

---

## Phase 7: User Story 5 - 外观设置功能修复 (Priority: P2)

**Goal**: 修复"跟随系统"不生效和语言切换无效的问题

**Independent Test**:

- 跟随系统：选择"跟随系统" → 切换OS主题 → 验证应用跟随
- 语言切换：选择英语 → 验证界面文本立即变为英文

### Tests for User Story 5 ⚠️

- [ ] T030 [P] [US5] 单元测试：系统主题监听
  - 位置：`src/__tests__/bug-fixes/follow-system-theme.test.ts`
  - 测试：选择"system"模式时，监听 `matchMedia` 变化
  - Mock：`window.matchMedia` 的 `change` 事件
  - 预期：测试失败（如未实现监听）

- [ ] T031 [P] [US5] 单元测试：语言切换逻辑
  - 位置：`src/__tests__/bug-fixes/language-switch.test.ts`
  - 测试：`i18n.changeLanguage()` 调用后，`t()` 函数返回新语言文本
  - 测试：设置持久化到 Tauri Store
  - 预期：测试失败（如未强制刷新）

- [ ] T032 [P] [US5] 集成测试：完整的外观设置流程
  - 位置：`src/__tests__/bug-fixes/appearance-settings.test.tsx`
  - 测试：SettingsModal 的外观设置 → 保存 → 验证生效
  - 包含：主题模式、语言切换

### Implementation for User Story 5

#### 子任务A: 跟随系统主题

- [ ] T033 [US5] 实现系统主题监听逻辑
  - 位置：`src/hooks/useTheme.ts`
  - 功能：监听 `window.matchMedia('(prefers-color-scheme: dark)')`
  - 代码示例：

    ```typescript
    useEffect(() => {
      if (theme !== 'system') return;

      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      const updateTheme = (e: MediaQueryListEvent | MediaQueryList) => {
        const systemTheme = e.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', systemTheme);
      };

      updateTheme(mediaQuery); // 初始化
      mediaQuery.addEventListener('change', updateTheme); // 监听变化

      return () => mediaQuery.removeEventListener('change', updateTheme);
    }, [theme]);
    ```

- [ ] T034 [US5] 集成系统主题监听到应用
  - 位置：`src/App.tsx` 或主题相关组件
  - 确保：`useTheme` hook 在应用启动时调用
  - 确保：theme='system' 时自动监听

#### 子任务B: 语言切换

- [ ] T035 [US5] 修复语言切换后的强制刷新
  - 位置：`src/components/SettingsModal.tsx`
  - 当前问题：调用 `i18n.changeLanguage()` 后组件未刷新
  - 修复：

    ```typescript
    const handleLanguageChange = async (lng: string) => {
      // 1. 更新 i18next
      await i18n.changeLanguage(lng);

      // 2. 持久化
      await useSettingsStore.getState().setLanguage(lng);

      // 3. 触发全局刷新（如需要）
      mutate('app-language'); // SWR刷新

      // 4. 显示反馈
      message.success(t('settings.languageChanged'));
    };
    ```

- [ ] T036 [US5] 验证翻译文件完整性
  - 位置：`src/i18n/locales/en-US.json` 和 `zh-CN.json`
  - 检查：所有界面文本都有翻译
  - 使用：`npm run i18n:check` 检测未使用的键

- [ ] T037 [US5] 测试翻译回退机制
  - 确保：缺失翻译时回退到默认语言（中文）
  - 位置：`src/i18n/config.ts` 的 `fallbackLng` 配置

**Checkpoint**: 手动测试 quickstart.md 的验证5和验证6

---

## Phase 8: User Story 6 - 日志管理改进 (Priority: P3)

**Goal**: 添加"打开日志目录"按钮，优化日志设置页面布局

**Independent Test**: 打开设置 → 日志设置 → 点击"打开日志目录" → 验证文件管理器打开

### Tests for User Story 6 ⚠️

- [ ] T038 [P] [US6] 单元测试：打开日志目录命令
  - 位置：`src/__tests__/bug-fixes/open-log-directory.test.ts`
  - 测试：`systemCommands.openLogDirectory()` 调用正确的Tauri命令
  - Mock：验证命令名和参数
  - 预期：测试失败（命令不存在）

- [ ] T039 [P] [US6] 集成测试：日志设置UI交互
  - 位置：`src/__tests__/bug-fixes/log-directory.test.tsx`
  - 测试：点击按钮 → 调用命令 → 显示成功提示
  - Mock：Tauri命令

### Implementation for User Story 6

#### 子任务A: 后端命令实现

- [ ] T040 [US6] 创建 `open_log_directory` Tauri命令
  - 位置：`src-tauri/src/commands/system.rs` (新建文件)
  - 功能：跨平台打开文件管理器
  - 代码示例：

    ```rust
    use tauri_plugin_shell::ShellExt;

    #[tauri::command]
    pub async fn open_log_directory(app: tauri::AppHandle) -> Result<(), String> {
        let log_dir = crate::utils::paths::app_log_dir()
            .map_err(|e| format!("获取日志目录失败: {}", e))?;

        if !log_dir.exists() {
            return Err("日志目录不存在".to_string());
        }

        #[cfg(target_os = "windows")]
        app.shell()
            .command("explorer")
            .args([log_dir.to_string_lossy().to_string()])
            .spawn()
            .map_err(|e| format!("无法打开文件管理器: {}", e))?;

        #[cfg(target_os = "macos")]
        app.shell()
            .command("open")
            .args([log_dir.to_string_lossy().to_string()])
            .spawn()
            .map_err(|e| format!("无法打开文件管理器: {}", e))?;

        #[cfg(target_os = "linux")]
        app.shell()
            .command("xdg-open")
            .args([log_dir.to_string_lossy().to_string()])
            .spawn()
            .map_err(|e| format!("无法打开文件管理器: {}", e))?;

        Ok(())
    }
    ```

- [ ] T041 [US6] 注册命令到 main.rs
  - 位置：`src-tauri/src/main.rs`
  - 添加：`mod commands::system;` (如果需要)
  - 添加：`.invoke_handler()` 中添加 `open_log_directory`

- [ ] T042 [US6] 创建命令模块导出
  - 位置：`src-tauri/src/commands/mod.rs`
  - 添加：`pub mod system;`
  - 添加：`pub use system::*;`

#### 子任务B: 前端命令集成

- [ ] T043 [US6] 添加 systemCommands 到 commands.ts
  - 位置：`src/services/commands.ts` (文件末尾，554行后)
  - 添加命令常量：
    ```typescript
    export const COMMANDS = {
      // ... 现有命令 ...
      SYSTEM_OPEN_LOG_DIR: 'open_log_directory',
    };
    ```
  - 添加命令模块：
    ```typescript
    /**
     * 系统命令
     */
    export const systemCommands = {
      async openLogDirectory() {
        return invoke<void>(COMMANDS.SYSTEM_OPEN_LOG_DIR, undefined, {
          errorMessage: '打开日志目录失败',
        });
      },
    };
    ```

#### 子任务C: UI实现

- [ ] T044 [US6] 在 SettingsModal 添加"打开日志目录"按钮
  - 位置：`src/components/SettingsModal.tsx` 的日志设置标签页
  - UI布局：

    ```tsx
    import { FolderOpenOutlined } from '@ant-design/icons';
    import { systemCommands } from '@/services/commands';

    // 在日志设置部分
    <Space direction="vertical" size="small" style={{ width: '100%' }}>
      <Text>日志级别：{config?.log_level || 'info'}</Text>
      <Text>保留天数：{config?.log_retention_days || 30}天</Text>

      <Button icon={<FolderOpenOutlined />} onClick={handleOpenLogDir}>
        打开日志目录
      </Button>
    </Space>;

    const handleOpenLogDir = async () => {
      try {
        await systemCommands.openLogDirectory();
        message.success('已打开日志目录');
      } catch (error) {
        message.error(`打开失败: ${error}`);
      }
    };
    ```

- [ ] T045 [US6] 优化日志设置页面布局
  - 位置：`src/components/SettingsModal.tsx`
  - 调整：减少不必要的间距
  - 调整：使用 `<Space>` 或 `<Row>` 紧凑排列
  - 参考：Ant Design 的表单布局最佳实践

**Checkpoint**: 运行测试验证 T038-T039 通过，手动测试 quickstart.md 的验证7

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: 最终优化、文档更新、全面测试

- [ ] T046 [P] 运行完整的测试套件
  - 前端：`npm run test:run`
  - 后端：`cd src-tauri && cargo test`
  - 确保：所有测试通过

- [ ] T047 [P] 运行代码格式化
  - 前端：`npm run format`
  - 后端：`npm run fmt`

- [ ] T048 [P] 运行Linter检查
  - 前端：`npm run lint:all`
  - 后端：`cargo clippy --all-targets --all-features`
  - 修复：所有警告

- [ ] T049 [P] 完整的手动回归测试
  - 使用：`specs/001-bug-7/quickstart.md` 的测试矩阵
  - 验证：所有10项测试通过

- [ ] T050 [P] 更新 CHANGELOG.md
  - 位置：`docs/CHANGELOG.md`
  - 添加：新的版本条目（2025-10-14）
  - 内容：

    ```markdown
    ## 2025-10-14 - 修复7个关键UI和功能问题

    ### Bug修复

    #### P1 阻塞性问题

    - **AI配置保存失败**: 修正前端参数序列化，确保api_key字段正确传递
    - **系统提示词保存失败**: 使用正确的命令名update_system_prompt
    - **语言检测失败**: 修正参数命名转换（驼峰→蛇形）

    #### P2 用户体验问题

    - **主题切换响应**: 修复单一状态源，点击一次立即生效
    - **跟随系统主题**: 实现matchMedia监听，实时跟随OS主题
    - **语言切换**: 添加强制刷新，界面文本立即更新

    #### P3 改进项

    - **日志管理**: 新增"打开日志目录"按钮，优化布局

    ### 技术改进

    - 统一参数命名转换逻辑（commands.ts层处理）
    - 新增systemCommands模块（跨平台系统操作）
    - 完善错误提示（具体原因而非通用错误）

    ### 测试覆盖

    - 新增12个单元测试
    - 新增6个集成测试
    - 测试覆盖率保持 > 80%
    ```

- [ ] T051 验证架构对齐
  - 检查：所有修改符合四层架构
  - 检查：使用ConfigDraft模式
  - 检查：通过AppDataProvider访问数据
  - 检查：遵循Constitution的8项原则

- [ ] T052 性能基准测试
  - 配置保存：< 100ms
  - 主题切换：< 100ms
  - 语言切换：< 1s
  - 打开日志目录：< 2s
  - 记录：实际测量值到测试报告

- [ ] T053 创建PR准备
  - 标题：`fix: 修复7个关键UI和功能问题 (#001)`
  - 描述：引用 `specs/001-bug-7/spec.md`
  - Checklist：所有测试通过、无Lint警告、CHANGELOG已更新

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
  ↓
Phase 2 (Foundational) ← 必须100%完成
  ↓
Phase 3-8 (User Stories) ← 可并行执行（如有多人）
  ├─ Phase 3 (US1 - P1)
  ├─ Phase 4 (US2 - P1)
  ├─ Phase 5 (US3 - P1)
  ├─ Phase 6 (US4 - P2)
  ├─ Phase 7 (US5 - P2)
  └─ Phase 8 (US6 - P3)
  ↓
Phase 9 (Polish) ← 所有故事完成后
```

### User Story Dependencies

- **User Story 1-6**: 所有故事完全独立，无依赖关系
- **最佳执行顺序**: 按优先级 P1 → P2 → P3
- **并行机会**: 多人团队可同时处理不同优先级的故事

### Within Each User Story

```
测试编写（T008, T009, T014, ...）← TDD: 先写测试
  ↓ 测试必须失败
实现修复（T010-T013, T016-T018, ...）
  ↓
测试验证（运行测试，确保通过）
  ↓
手动验证（quickstart.md对应章节）
```

### Task-Level Dependencies

**Phase 2 (Foundational)**:

- T005, T006, T007 可并行
- T007 依赖 T005, T006 完成（需要测试辅助）

**Phase 3 (US1)**:

- T008, T009 可并行（不同测试文件）
- T010, T011, T012 顺序执行（可能同一文件）
- T013 独立（后端验证）

**Phase 6 (US4)**:

- T024, T025 可并行（不同测试）
- T026 → T027 → T028 顺序（分析→修复→验证）
- T029 独立

**Phase 8 (US6)**:

- T038, T039 可并行（不同测试）
- T040 → T041 → T042 顺序（后端命令创建）
- T043 并行于T040-T042（前端命令定义）
- T044, T045 顺序（UI实现和优化）

**Phase 9 (Polish)**:

- T046-T048 可并行（不同工具）
- T049-T053 顺序（手动测试→文档→PR）

---

## Parallel Execution Examples

### Phase 3 (US1) - 并行测试编写

```bash
Developer A: T008 (ai-config-validation.test.ts)
Developer B: T009 (ai-config-save.test.tsx)
# 同时进行，不同文件
```

### Phase 8 (US6) - 前后端并行

```bash
Developer A: T040-T042 (后端命令实现)
Developer B: T043 (前端命令定义)
# 同时进行，约定好命令名称
```

### Multi-Story Parallel (多人团队)

```bash
Team Member 1: Phase 3 (US1 - AI配置)
Team Member 2: Phase 4 (US2 - 系统提示词)
Team Member 3: Phase 5 (US3 - 语言检测)
# 三个P1故事同时修复
```

---

## Implementation Strategy

### MVP First (最小可行产品)

**建议范围**: Phase 3 (US1) 仅

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (必须100%)
3. Complete Phase 3: User Story 1 (AI配置保存)
4. **STOP and VALIDATE**: 运行测试 + 手动验证
5. Deploy/demo if ready

**理由**: US1 是用户首次配置的阻塞问题，修复后用户才能使用应用

### Incremental Delivery (增量交付)

**推荐顺序**:

1. **Week 1**: Phase 1-2 (Setup + Foundation)
   - 准备工作，100%完成
2. **Week 1-2**: Phase 3-5 (US1-US3, 所有P1)
   - 3个阻塞性问题
   - 每个修复后立即测试
   - 可考虑每个US一个小版本发布
3. **Week 2**: Phase 6-7 (US4-US5, P2)
   - 用户体验改进
   - 不阻塞核心功能
4. **Week 2-3**: Phase 8 (US6, P3)
   - 锦上添花的改进
5. **Week 3**: Phase 9 (Polish)
   - 最终打磨和发布

### Single Developer Strategy (单人开发)

**时间估算**: 约2-3天

- Day 1 AM: Phase 1-2 (Setup + Foundation)
- Day 1 PM: Phase 3 (US1) + Phase 4 (US2)
- Day 2 AM: Phase 5 (US3) + Phase 6 (US4)
- Day 2 PM: Phase 7 (US5) + Phase 8 (US6)
- Day 3: Phase 9 (Polish + Testing + PR)

---

## Notes

- **[P]** 任务 = 不同文件，可并行执行
- **[Story]** 标签将任务映射到用户故事
- 每个用户故事独立可完成和测试
- **TDD**: 测试先行，确保失败后再实现
- 每个Phase有Checkpoint验证
- 小步提交：每个US完成后提交一次
- 避免：模糊任务、文件冲突、跨故事依赖

---

## Test Coverage Summary

| Story            | Unit Tests | Integration Tests | Total  |
| ---------------- | ---------- | ----------------- | ------ |
| US1 (AI配置)     | 1          | 1                 | 2      |
| US2 (系统提示词) | 1          | 1                 | 2      |
| US3 (语言检测)   | 1          | 1                 | 2      |
| US4 (主题切换)   | 1          | 1                 | 2      |
| US5 (外观设置)   | 2          | 1                 | 3      |
| US6 (日志管理)   | 1          | 1                 | 2      |
| **Total**        | **7**      | **6**             | **13** |

**回归测试**: 3个（批量翻译、术语库、配置持久化）  
**总测试数**: 16个新测试 + 现有73个 = 89个测试

---

## Complexity Metrics

- **Total Tasks**: 53
- **Test Tasks**: 13 (24.5%)
- **Implementation Tasks**: 31 (58.5%)
- **Setup/Polish Tasks**: 9 (17%)
- **Parallelizable Tasks**: 23 (43.4% marked with [P])
- **User Stories**: 6 (US1-US6)
- **Average Tasks per Story**: 约7个任务

---

## Risk Mitigation

### High Risk Items

1. **T021 (参数命名修复)**: 影响关键功能
   - 缓解：先写测试，逐个验证
2. **T040-T042 (新命令实现)**: 跨平台兼容性
   - 缓解：参考 tauri_plugin_shell 文档，在3个OS测试

3. **T033 (系统主题监听)**: 平台差异
   - 缓解：优雅降级，Linux可能不完全支持

### Low Risk Items

- US1-US3修复：已明确根因，方案简单
- US4修复：状态管理优化，风险低
- US6：纯新增功能，不影响现有流程
