# 项目结构说明

## 📁 目录结构

```
po翻译/
├── README.md                 # 项目说明文档
├── requirements.txt          # Python依赖
├── .env                      # 配置文件（需自行创建）
├── .gitignore               # Git忽略规则
│
├── run.py                    # 主菜单入口（推荐使用）
├── setup.py                  # 安装向导
│
├── src/                      # 核心源代码
│   ├── po_translator.py     # 核心翻译类
│   ├── batch_translate.py   # 批量翻译模块
│   └── translate.py         # 一键翻译脚本
│
├── tools/                    # 辅助工具
│   ├── analyze_po.py        # 统计分析工具
│   ├── compare_translations.py  # 翻译预览工具
│   ├── quick_check.py       # 快速验证工具
│   └── test_translator.py   # 单元测试
│
├── docs/                     # 项目文档
│   ├── CHANGELOG.md         # 更新日志
│   ├── Token优化说明.md     # Token优化详解
│   ├── 专业翻译提示词.md    # 翻译规范
│   ├── 升级说明.md          # 使用指南
│   ├── 对话上下文架构说明.md  # 架构设计
│   └── 更新总结.md          # 版本总结
│
├── fy/                       # PO文件目录
│   ├── en/                  # 英文PO文件（参考）
│   └── zh-Hans/             # 中文PO文件（待翻译）
│
├── data/                     # 运行时数据文件
│   └── translation_memory.json  # 翻译记忆库
│
└── log/                      # 翻译报告日志
    └── translation_report_*.txt
```

## 📋 文件说明

### 主程序文件

| 文件 | 说明 | 用途 |
|------|------|------|
| `run.py` | 主菜单程序 | **推荐使用**，提供图形化菜单界面 |
| `setup.py` | 安装向导 | 首次安装依赖和配置环境 |
| `.env` | 配置文件 | 存储API密钥等配置（需手动创建） |

### src/ - 核心源代码

| 文件 | 说明 | 功能 |
|------|------|------|
| `po_translator.py` | 核心翻译类 | POEntry数据结构、POTranslator翻译器类、对话历史管理 |
| `batch_translate.py` | 批量翻译模块 | 批量处理多个PO文件、生成翻译报告 |
| `translate.py` | 一键翻译脚本 | 读取.env配置，自动执行批量翻译 |

### tools/ - 辅助工具

| 文件 | 说明 | 使用场景 |
|------|------|----------|
| `analyze_po.py` | 统计分析工具 | 分析翻译工作量、预估Token消耗和费用 |
| `compare_translations.py` | 翻译预览工具 | 预览翻译结果、检查翻译质量 |
| `quick_check.py` | 快速验证工具 | 快速检查PO文件结构和翻译进度 |
| `test_translator.py` | 单元测试 | 测试PO文件解析和翻译功能 |

### docs/ - 项目文档

| 文件 | 说明 | 内容 |
|------|------|------|
| `CHANGELOG.md` | 更新日志 | 记录所有版本更新内容 |
| `Token优化说明.md` | Token优化详解 | Token使用优化策略和成本分析 |
| `专业翻译提示词.md` | 翻译规范 | 经过验证的UE翻译规则 |
| `升级说明.md` | 使用指南 | 完整的安装和使用教程 |
| `对话上下文架构说明.md` | 架构设计 | 对话历史管理架构详解 |
| `更新总结.md` | 版本总结 | v2.0/v3.0更新总结 |

### fy/ - PO文件目录

| 目录 | 说明 |
|------|------|
| `fy/en/` | 英文PO文件（参考用，可选） |
| `fy/zh-Hans/` | 中文PO文件（待翻译的目标文件） |

### log/ - 翻译报告

自动生成的翻译报告，包含：
- 翻译时间和统计信息
- 完整的原文-译文对照表
- Token使用和费用统计

## 🚀 使用流程

### 1. 首次使用

```bash
# 安装依赖
python setup.py

# 编辑配置文件 .env
# 填入 Moonshot API 密钥
```

### 2. 日常使用

```bash
# 启动主菜单
python run.py

# 或直接运行一键翻译
python src/translate.py
```

### 3. 查看分析

```bash
# 分析PO文件
python tools/analyze_po.py --dir fy/zh-Hans

# 预览翻译进度
python tools/compare_translations.py --file fy/zh-Hans/X_ToolkitTest.po
```

## 🔧 核心架构

### POTranslator类（src/po_translator.py）

```python
class POTranslator:
    def __init__(self, api_key):
        self.client = OpenAI(...)
        self.conversation_history = []  # 对话历史管理
        
    def translate_batch(self, texts):
        # 批量翻译，维护对话上下文
        
    def translate_po_file(self, po_file):
        # 完整的文件翻译流程
```

**核心特性：**
- 对话历史管理（保持翻译一致性）
- Token使用统计
- 自动备份
- 质量验证（占位符、换行符）

### 批量翻译模块（src/batch_translate.py）

```python
def batch_translate(api_key, po_dir, batch_size):
    # 扫描目录
    # 批量翻译
    # 生成报告
```

**功能：**
- 自动扫描PO文件
- 批量处理
- 生成详细报告（log/目录）

## 📝 配置说明

### .env 配置文件

```ini
# Moonshot AI API 密钥
MOONSHOT_API_KEY=sk-xxxxx

# PO文件目录
PO_DIR=fy/zh-Hans

# 批量大小（每批翻译的条目数）
BATCH_SIZE=10
```

### 批量大小建议

| 文本长度 | 推荐值 | 说明 |
|----------|--------|------|
| 短文本（<50字符） | 15-20 | 更快完成 |
| 中等文本（50-200字符） | 10 | 平衡点（推荐） |
| 长文本（>200字符） | 5-8 | 避免超时 |

## 🎯 设计理念

### 模块化设计

- **src/** - 核心业务逻辑
- **tools/** - 独立的辅助工具
- **docs/** - 完整的文档体系
- **fy/** - 数据文件隔离
- **log/** - 运行时日志

### 路径管理

所有工具和模块都使用相对路径，通过`sys.path.insert()`动态添加src目录：

```python
# tools中的脚本
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
from po_translator import POTranslator
```

### 对话上下文架构

采用业界最佳实践（参考吴恩达Translation Agent）：
- 维护完整对话历史
- AI保持翻译一致性
- 智能历史长度管理
- Token消耗可控

## 📊 性能指标

| 指标 | 数值 |
|------|------|
| Token节省 | 无上下文相比原始方案 |
| 翻译一致性 | ⭐⭐⭐⭐⭐ |
| 批量处理速度 | ~10条/次 |
| 费用（100条） | ~¥0.07 |
| 历史管理 | 保留5-10轮对话 |

## 🔄 版本历史

- **v3.0** - 对话上下文管理架构
- **v2.0** - Python脚本替换批处理 + Token优化
- **v1.0** - 基础翻译功能

## 📖 延伸阅读

- [CHANGELOG.md](docs/CHANGELOG.md) - 详细更新日志
- [对话上下文架构说明.md](docs/对话上下文架构说明.md) - 架构设计详解
- [Token优化说明.md](docs/Token优化说明.md) - Token优化策略
- [专业翻译提示词.md](docs/专业翻译提示词.md) - 翻译规范

---

**版本：** v3.0  
**更新日期：** 2025-10-06  
**架构模式：** 模块化 + 对话上下文管理
