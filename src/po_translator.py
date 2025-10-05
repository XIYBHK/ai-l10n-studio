#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PO文件自动翻译工具
使用Moonshot AI API批量翻译UE本地化PO文件
"""

import re
import os
import sys
from typing import List, Dict, Tuple
from openai import OpenAI
from translation_memory import TranslationMemory


class POEntry:
    """PO文件条目"""
    def __init__(self):
        self.comments = []  # 注释行
        self.msgctxt = ""   # 上下文
        self.msgid = ""     # 源文本
        self.msgstr = ""    # 翻译文本
        self.line_start = 0 # 起始行号

    def needs_translation(self) -> bool:
        """判断是否需要翻译"""
        return bool(self.msgid and not self.msgstr)


class POTranslator:
    """PO文件翻译器"""

    def __init__(self, api_key: str, base_url: str = "https://api.moonshot.cn/v1", use_tm: bool = True):
        """
        初始化翻译器

        Args:
            api_key: Moonshot API密钥
            base_url: API基础URL
            use_tm: 是否使用翻译记忆库
        """
        self.client = OpenAI(
            api_key=api_key,
            base_url=base_url
        )
        self.model = "moonshot-v1-auto"
        
        # Token统计
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.total_cost = 0.0
        
        # 翻译记忆库
        self.use_tm = use_tm
        self.tm = TranslationMemory() if use_tm else None
        if self.use_tm:
            print("[TM] 翻译记忆库已启用")
        
        # 详细的System Message（完整翻译规范）
        self.system_prompt = """你是一位专业的游戏开发和Unreal Engine本地化专家，精通中英文翻译。

【翻译规则】
1. 术语保留英文: Actor/Blueprint/Component/Transform/Mesh/Material/Widget/Collision/Array/Float/Integer
2. 固定翻译: Asset→资产, Unique→去重, Slice→截取, Primitives→基础类型, Constant Speed→匀速, Stream→流送, Ascending→升序, Descending→降序
3. Category翻译: 保持XTools等命名空间和|符号, 如 XTools|Sort|Actor → XTools|排序|Actor
4. 格式保留: 必须保持|、{}、%%、[]、()、\\n、\\t、{0}、{1}等所有特殊符号和占位符
5. 翻译风格: 准确(信)、流畅(达)、专业(雅), 无多余空格
6. 特殊表达: in-place→原地, by value→按值, True→为True, False→为False

请保持翻译风格一致，参考之前的翻译术语。"""
        
        # 对话历史（用于维护上下文）
        self.conversation_history = []
        self.max_history_tokens = 2000  # 历史记录最大token数（防止过长）

    def parse_po_file(self, file_path: str) -> Tuple[List[str], List[POEntry]]:
        """
        解析PO文件

        Args:
            file_path: PO文件路径

        Returns:
            (头部行列表, 条目列表)
        """
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        header = []
        entries = []
        current_entry = None
        in_header = True
        i = 0

        while i < len(lines):
            line = lines[i].rstrip('\n')

            # 跳过BOM
            if i == 0 and line.startswith('\ufeff'):
                line = line[1:]
                lines[i] = line + '\n'

            # 头部结束标记
            if in_header and line.startswith('msgid ""'):
                # 读取头部的msgid和msgstr
                while i < len(lines) and not lines[i].startswith('#.'):
                    header.append(lines[i])
                    i += 1
                in_header = False
                continue

            if in_header:
                header.append(lines[i])
                i += 1
                continue

            # 新条目开始（注释行）
            if line.startswith('#.'):
                if current_entry:
                    entries.append(current_entry)
                current_entry = POEntry()
                current_entry.line_start = i

            # 处理当前条目
            if current_entry:
                if line.startswith('#'):
                    current_entry.comments.append(lines[i])
                elif line.startswith('msgctxt'):
                    # msgctxt "..."
                    match = re.match(r'msgctxt\s+"(.+)"', line)
                    if match:
                        current_entry.msgctxt = match.group(1)
                elif line.startswith('msgid'):
                    # msgid "..."
                    match = re.match(r'msgid\s+"(.+)"', line)
                    if match:
                        current_entry.msgid = match.group(1)
                elif line.startswith('msgstr'):
                    # msgstr "..."
                    match = re.match(r'msgstr\s+"(.+)"', line)
                    if match:
                        current_entry.msgstr = match.group(1)
                    else:
                        # msgstr "" 空翻译
                        current_entry.msgstr = ""

            i += 1

        # 添加最后一个条目
        if current_entry:
            entries.append(current_entry)

        return header, entries

    def translate_batch(self, texts: List[str], source_lang: str = "en",
                       target_lang: str = "zh-Hans") -> List[str]:
        """
        批量翻译文本（支持翻译记忆库）

        Args:
            texts: 待翻译文本列表
            source_lang: 源语言
            target_lang: 目标语言

        Returns:
            翻译结果列表
        """
        if not texts:
            return []
        
        # 使用翻译记忆库预处理
        if self.use_tm and self.tm:
            need_ai_translation, cached = self.tm.preprocess_batch(texts)
            
            # 如果全部命中缓存
            if not need_ai_translation:
                print(f"[TM] 全部命中缓存 ({len(texts)}/{len(texts)})")
                return [cached.get(i, texts[i]) for i in range(len(texts))]
            
            # 部分命中缓存
            if cached:
                print(f"[TM] 缓存命中 {len(cached)}/{len(texts)}, 需AI翻译 {len(need_ai_translation)}")
            
            # AI翻译未缓存的部分
            ai_translations = self._translate_with_ai(need_ai_translation)
            
            # 合并结果并学习
            result = []
            ai_idx = 0
            learned_count = 0
            
            for i in range(len(texts)):
                if i in cached:
                    result.append(cached[i])
                else:
                    translation = ai_translations[ai_idx]
                    result.append(translation)
                    
                    # 学习新翻译（仅简单短语，且翻译也要简单）
                    original = texts[i]
                    if self.tm.is_simple_phrase(original) and translation:
                        # 确保翻译结果也是简短的（避免AI翻译异常长）
                        if len(translation) <= 50:  # 译文不超过50字符
                            self.tm.add(original, translation)
                            learned_count += 1
                    
                    ai_idx += 1
            
            # 显示学习统计
            if learned_count > 0:
                print(f"[TM] 学习了 {learned_count} 个新短语")
            
            return result
        else:
            # 不使用翻译记忆库，直接AI翻译
            return self._translate_with_ai(texts)
    
    def _translate_with_ai(self, texts: List[str]) -> List[str]:
        """
        使用AI翻译文本（内部方法）

        Args:
            texts: 待翻译文本列表

        Returns:
            翻译结果列表
        """
        if not texts:
            return []

        # 构建用户提示词（简洁版）
        user_prompt = "请翻译:\n"
        user_prompt += "\n".join([f'{i+1}. {text}' for i, text in enumerate(texts)])

        # 准备messages数组
        # 如果是第一批，初始化对话历史
        if not self.conversation_history:
            messages = [
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        else:
            # 使用对话历史维持上下文
            messages = self.conversation_history + [
                {"role": "user", "content": user_prompt}
            ]

        try:
            completion = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.3,
            )

            # 统计token使用
            usage = completion.usage
            self.total_input_tokens += usage.prompt_tokens
            self.total_output_tokens += usage.completion_tokens
            # Moonshot定价：¥0.012/1K tokens（输入输出同价）
            batch_cost = (usage.prompt_tokens + usage.completion_tokens) / 1000 * 0.012
            self.total_cost += batch_cost

            result = completion.choices[0].message.content.strip()
            
            # 更新对话历史（用于下一批翻译）
            # 添加当前对话到历史
            if not self.conversation_history:
                # 第一次：保存system message
                self.conversation_history = [
                    {"role": "system", "content": self.system_prompt}
                ]
            
            self.conversation_history.append({"role": "user", "content": user_prompt})
            self.conversation_history.append({"role": "assistant", "content": result})
            
            # 防止历史过长：如果超过限制，只保留最近的对话
            # 估算：每条消息约100 tokens，保留最近10轮对话
            if len(self.conversation_history) > 21:  # system + 10轮对话(20条消息)
                # 保留system message和最近5轮对话
                self.conversation_history = [self.conversation_history[0]] + self.conversation_history[-10:]
            
            translations = [line.strip() for line in result.split('\n') if line.strip()]

            # 清理可能的序号前缀
            cleaned = []
            for i, trans in enumerate(translations):
                # 移除可能的序号（如 "1. ", "1) ", "1、"等）
                trans = re.sub(r'^\d+[\.\)、]\s*', '', trans)
                
                # 验证特殊字符是否保留
                if i < len(texts):
                    original = texts[i]
                    # 检查原文中的换行符
                    if '\\n' in original and '\\n' not in trans:
                        # 如果原文有\n但译文没有，尝试恢复
                        if original.endswith('\\n') and not trans.endswith('\\n'):
                            trans += '\\n'
                    
                    # 检查原文中的占位符数量
                    original_placeholders = re.findall(r'\{[0-9]+\}', original)
                    trans_placeholders = re.findall(r'\{[0-9]+\}', trans)
                    if len(original_placeholders) != len(trans_placeholders):
                        print(f"  [警告] 占位符数量不匹配: {original} -> {trans}")
                
                cleaned.append(trans)

            return cleaned

        except Exception as e:
            print(f"翻译出错: {e}")
            return [""] * len(texts)

    def translate_po_file(self, po_file: str, batch_size: int = 10):
        """
        直接翻译PO文件（原地更新）

        Args:
            po_file: PO文件路径（包含msgid和待翻译的msgstr）
            batch_size: 每批翻译的条目数
            
        Returns:
            翻译报告字典
        """
        # 重置对话历史（每个文件开始时重新建立上下文）
        self.conversation_history = []
        
        print(f"正在解析文件: {po_file}")
        header, entries = self.parse_po_file(po_file)

        # 统计需要翻译的条目
        need_translation = [e for e in entries if e.needs_translation()]
        print(f"总条目数: {len(entries)}")
        print(f"需要翻译: {len(need_translation)}")

        # 翻译报告
        report = {
            'file': po_file,
            'total_entries': len(entries),
            'need_translation': len(need_translation),
            'translated': 0,
            'failed': 0,
            'translations': [],  # 存储翻译对照
            'tm_stats': {
                'cache_hits': 0,
                'total_queries': 0,
                'hit_rate': 0.0
            },
            'token_stats': {
                'input_tokens': 0,
                'output_tokens': 0,
                'total_tokens': 0,
                'cost': 0.0
            }
        }

        # 去重优化：提取唯一的待翻译文本
        unique_texts = {}  # {msgid: [entry索引列表]}
        for idx, entry in enumerate(need_translation):
            if entry.msgid not in unique_texts:
                unique_texts[entry.msgid] = []
            unique_texts[entry.msgid].append(idx)
        
        unique_count = len(unique_texts)
        duplicate_count = len(need_translation) - unique_count
        
        if duplicate_count > 0:
            print(f"[优化] 发现 {duplicate_count} 个重复条目，实际需翻译 {unique_count} 个")
        
        # 翻译唯一的文本
        translation_map = {}  # {msgid: translation}
        unique_list = list(unique_texts.keys())
        
        translated_count = 0
        failed_count = 0
        
        for i in range(0, len(unique_list), batch_size):
            batch_texts = unique_list[i:i+batch_size]
            
            print(f"正在翻译 {i+1}-{i+len(batch_texts)}/{unique_count}...")
            translations = self.translate_batch(batch_texts)

            # 构建翻译映射
            for text, trans in zip(batch_texts, translations):
                if trans:
                    translation_map[text] = trans
                    translated_count += 1
                else:
                    translation_map[text] = None
                    failed_count += 1
        
        # 应用翻译到所有条目（包括重复的）
        for entry in need_translation:
            trans = translation_map.get(entry.msgid)
            if trans:
                entry.msgstr = trans
                # 记录翻译对照（只记录唯一的）
                if entry.msgid not in [t['original'] for t in report['translations']]:
                    report['translations'].append({
                        'original': entry.msgid,
                        'translation': trans
                    })

        report['translated'] = translated_count
        report['failed'] = failed_count
        report['deduplication'] = {
            'total_entries': len(need_translation),
            'unique_entries': unique_count,
            'duplicate_entries': duplicate_count,
            'optimization_rate': f"{(duplicate_count / len(need_translation) * 100):.1f}%" if need_translation else "0%"
        }
        
        # 收集翻译记忆库统计
        if self.use_tm and self.tm:
            tm_stats = self.tm.get_statistics()
            report['tm_stats'] = {
                'cache_hits': self.tm.stats['hits'],
                'total_queries': tm_stats['total_queries'],
                'hit_rate': self.tm.stats['hits'] / tm_stats['total_queries'] * 100 if tm_stats['total_queries'] > 0 else 0.0
            }
        
        report['token_stats'] = {
            'input_tokens': self.total_input_tokens,
            'output_tokens': self.total_output_tokens,
            'total_tokens': self.total_input_tokens + self.total_output_tokens,
            'cost': self.total_cost
        }

        # 显示翻译结果
        print(f"翻译完成: {translated_count}/{unique_count} 唯一条目")
        print(f"实际填充: {len(need_translation)} 条目（包含重复）")
        if duplicate_count > 0:
            print(f"去重优化: 节省了 {duplicate_count} 次翻译调用 ({duplicate_count/len(need_translation)*100:.1f}%)")
        if failed_count > 0:
            print(f"翻译失败: {failed_count} 条")
        
        # 显示token使用统计
        print(f"\nToken使用统计:")
        print(f"  输入tokens: {self.total_input_tokens:,}")
        print(f"  输出tokens: {self.total_output_tokens:,}")
        print(f"  总计tokens: {self.total_input_tokens + self.total_output_tokens:,}")
        print(f"  实际费用: ¥{self.total_cost:.4f}")

        # 创建备份
        backup_file = po_file + '.backup'
        import shutil
        shutil.copy2(po_file, backup_file)
        print(f"已备份原文件: {backup_file}")

        # 写入原文件
        self._write_po_file(po_file, header, entries)
        print(f"已更新文件: {po_file}")
        
        # 保存翻译记忆库
        if self.use_tm and self.tm:
            self.tm.save_to_file()
            self.tm.print_statistics()
        
        return report

    def _write_po_file(self, file_path: str, header: List[str],
                      entries: List[POEntry]):
        """
        写入PO文件

        Args:
            file_path: 输出文件路径
            header: 头部行
            entries: 条目列表
        """
        with open(file_path, 'w', encoding='utf-8') as f:
            # 写入头部
            for line in header:
                f.write(line)

            # 写入条目
            for entry in entries:
                # 写入注释
                for comment in entry.comments:
                    f.write(comment)

                # 写入msgctxt
                if entry.msgctxt:
                    f.write(f'msgctxt "{entry.msgctxt}"\n')

                # 写入msgid
                f.write(f'msgid "{entry.msgid}"\n')

                # 写入msgstr
                f.write(f'msgstr "{entry.msgstr}"\n')

                # 空行
                f.write('\n')


def main():
    """主函数"""
    import argparse

    parser = argparse.ArgumentParser(description='PO文件自动翻译工具（使用Moonshot AI）')
    parser.add_argument('po_file', help='PO文件路径（直接翻译此文件）')
    parser.add_argument('--api-key', required=True, help='Moonshot API密钥')
    parser.add_argument('--batch-size', type=int, default=10,
                       help='每批翻译的条目数（默认10）')

    args = parser.parse_args()

    if not os.path.exists(args.po_file):
        print(f"错误: 文件不存在: {args.po_file}")
        sys.exit(1)

    translator = POTranslator(args.api_key)
    translator.translate_po_file(args.po_file, args.batch_size)


if __name__ == '__main__':
    main()
