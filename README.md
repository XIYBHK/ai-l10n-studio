# UE 本地化 PO 文件 AI 翻译工具

> 使用 Moonshot AI 自动翻译 Unreal Engine 本地化文件，内置翻译记忆库，节省 50-70% 成本。

## ✨ 特性

- 🚀 **一键翻译** - 自动处理整个项目的 PO 文件
- 💾 **翻译记忆库** - 智能缓存常见短语，减少重复翻译
- 📊 **详细报告** - 自动生成翻译对照表和统计信息
- 🎯 **专业术语** - 内置 UE 术语库，保证翻译准确性
- 🌍 **多语言支持** - 自动识别语言目录（zh-Hans, ja, ko 等）
- 🔄 **去重优化** - 相同条目只翻译一次

## 🚀 快速开始

### 1. 安装依赖
```bash
python setup.py
```

### 2. 配置 API 密钥
```bash
# 复制配置文件
cp env.example .env

# 编辑 .env，填入 API 密钥
MOONSHOT_API_KEY=sk-xxxxx
```
获取密钥：https://platform.moonshot.cn/

### 3. 准备 PO 文件
```
localization/
  ├── zh-Hans/     # 目标语言
  │   └── Game.po
  └── en/          # 源语言
      └── Game.po
```

### 4. 开始翻译
```bash
python run.py
# 选择 [2] 开始翻译 → 选择目标语言 → 完成
```

## 📖 使用方式

### 菜单模式（推荐）
```bash
python run.py
```
```
[1] 分析PO文件      # 查看工作量和预估费用
[2] 开始翻译        # 自动翻译所有待翻译条目
[3] 预览翻译进度    # 查看翻译效果
[4] 快速检查        # 检查文件状态
```

### 命令行模式
```bash
# 一键翻译（读取 .env 配置）
python src/translate.py

# 指定语言翻译
python src/batch_translate.py --api-key xxx --lang zh-Hans
```

## 💡 翻译记忆库

自动缓存和复用常见短语，无需配置：

```bash
[TM] 缓存命中 45/100, 需AI翻译 55
[TM] 学习了 12 个新短语
[TM] 节省费用: ¥0.11 (61%)
```

**内置 90+ 条 UE 专业术语**，如：
- `XTools|Random` → `XTools|随机`
- `Asset Naming` → `资产命名`
- `Connection Mode` → `连接模式`

管理命令：
```bash
python tools/manage_tm.py --list all      # 查看所有
python tools/manage_tm.py --search "工具"  # 搜索
```

## 💰 费用说明

| 项目 | 费用 |
|------|------|
| **API 定价** | ¥0.012/1000 tokens |
| **典型项目** (800条) | ¥0.5-2.0 |
| **使用 TM 后** | ¥0.2-0.8 (节省 60%) |

使用 `python run.py` → `[1] 分析PO文件` 可获得精确预估。

## 📊 翻译报告

每次翻译自动生成详细报告：

```
log/translation_report_20251006_023921.txt

需要翻译: 103
唯一条目: 88
重复条目: 15 (14.6%)
记忆库命中: 45/88 (51.1%)
翻译成功: 88/103
Token使用: 12,450
实际费用: ¥0.35
```

## 📁 项目结构

```
├── run.py              # 主菜单
├── setup.py            # 安装向导
├── src/                # 核心代码
│   ├── po_translator.py
│   ├── batch_translate.py
│   └── translation_memory.py
├── tools/              # 辅助工具
│   ├── analyze_po.py
│   ├── compare_translations.py
│   └── manage_tm.py
├── localization/       # PO文件目录
├── log/                # 翻译报告
└── data/               # 翻译记忆库

```

详细说明：[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)

## 🤝 参与贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
