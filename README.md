# PO文件自动翻译工具

使用Moonshot AI API自动翻译Unreal Engine本地化PO文件。

## 工作原理

直接翻译PO文件:
- PO文件包含 `msgid`（原文）和 `msgstr`（译文）
- 工具读取msgid，翻译后填入msgstr
- 自动备份原文件，原地更新
- 递归搜索 `localization/` 目录下的所有 `.po` 文件

## 快速开始

### 第一步: 安装

**推荐方式（跨平台）:**
```bash
python setup.py
```

**手动安装:**
```bash
pip install -r requirements.txt
```

### 第二步: 配置API密钥

1. 访问 https://platform.moonshot.cn/ 获取API密钥
2. 复制 `env.example` 为 `.env`
3. 编辑 `.env`:
   ```ini
   MOONSHOT_API_KEY=sk-xxxxx
   PO_DIR=localization
   LANGUAGE=zh-Hans  # 可选，不设置则每次交互选择
   BATCH_SIZE=10
   ```

**目录结构示例:**
```
localization/
  ├── zh-Hans/       # 简体中文
  │   └── Game.po
  ├── en/            # 英文
  │   └── Game.po
  └── ja/            # 日文
      └── Game.po
```

### 第三步: 开始翻译

```bash
# 方式1: 使用菜单（推荐）
python run.py

# 方式2: 命令行
python translate.py
```

## 核心命令

```bash
# 一键翻译（使用.env配置）
python translate.py

# 分析翻译工作量
python analyze_po.py

# 预览翻译进度
python compare_translations.py

# 单文件翻译
python po_translator.py fy/zh-Hans/X_ToolkitTest.po --api-key YOUR_KEY

# 批量翻译
python batch_translate.py --api-key YOUR_KEY --dir fy/zh-Hans
```

## 翻译记忆库（Translation Memory）⭐

**v3.1 新功能** - 智能缓存系统，自动复用常见短语翻译：

### 核心优势
- **节省Token** - 减少50-70%的AI调用成本
- **提高一致性** - 相同短语使用相同翻译  
- **加快速度** - 缓存命中无需等待AI响应

### 内置短语库（57+条）
```
XTools|Random     → XTools|随机
Asset Naming      → 资产命名
Connection Mode   → 连接模式
Unique            → 去重
...
```

### 使用示例
```bash
# 自动启用，无需配置
python run.py

# 输出示例：
# [TM] 翻译记忆库已启用
# [TM] 缓存命中 45/100, 需AI翻译 55
# [TM] 学习 12 条新短语
# [TM] 节省费用: ¥0.11 (61%)

# 管理记忆库
python tools/manage_tm.py --list all
python tools/manage_tm.py --search "Connection"
python tools/manage_tm.py --export tm_backup.json
```

详细说明：[docs/翻译记忆库说明.md](docs/翻译记忆库说明.md)

## 费用说明

- Moonshot API定价: 约 ¥0.012/1000 tokens
- 典型5300行PO文件预估费用: ¥0.5-2.0（使用TM后: ¥0.2-0.8）
- 使用 `python analyze_po.py` 可获得精确预估

## 工具列表

| 工具 | 说明 |
|------|------|
| **run.py** | 菜单界面（推荐） |
| **translate.py** | 一键翻译 |
| **setup.py** | 安装向导 |
| **po_translator.py** | 单文件翻译 |
| **batch_translate.py** | 批量翻译 |
| **analyze_po.py** | 统计分析 |
| **compare_translations.py** | 预览进度 |
| **quick_check.py** | 快速检查 |
| **manage_tm.py** | 翻译记忆库管理 |

## 文件结构

```
po翻译/
├── run.py                # 主菜单（推荐使用）
├── setup.py              # 安装向导
├── requirements.txt      # Python依赖
├── .env                  # 配置文件
│
├── src/                  # 核心源代码
│   ├── po_translator.py # 核心翻译类
│   ├── batch_translate.py # 批量翻译
│   └── translate.py     # 一键翻译
│
├── tools/                # 辅助工具
│   ├── analyze_po.py    # 统计分析
│   ├── compare_translations.py # 预览进度
│   ├── quick_check.py   # 快速检查
│   ├── manage_tm.py     # 翻译记忆库管理
│   └── test_translator.py # 单元测试
│
├── docs/                 # 项目文档
├── fy/zh-Hans/          # PO文件目录
├── log/                 # 翻译报告
└── README.md            # 本文件
```

详细说明请查看：[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)

## 示例

翻译前:
```po
msgid "XTools|Collision"
msgstr ""
```

翻译后:
```po
msgid "XTools|Collision"
msgstr "XTools|碰撞"
```

同时生成备份文件 `*.po.backup`

## 翻译报告

每次翻译完成后，系统会自动在 `log/` 目录下生成详细的翻译报告：

```
log/translation_report_20251006_001418.txt
```

报告内容包括：
- 翻译时间和统计信息
- 每个文件的翻译详情
- 完整的原文-译文对照表
- 翻译成功/失败统计

这样可以方便地：
- 追踪翻译历史
- 验证翻译质量
- 定位问题条目
- 进行人工审核
