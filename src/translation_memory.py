#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
翻译记忆库（Translation Memory）模块
用于缓存和复用常见短语的翻译，减少重复的AI调用
"""

import json
import os
from typing import Dict, List, Tuple, Set
from datetime import datetime


class TranslationMemory:
    """翻译记忆库"""
    
    # 内置的常见短语翻译（基于UE专业术语）
    BUILTIN_PHRASES = {
        # XTools 命名空间
        "XTools|Random": "XTools|随机",
        "XTools|Sort": "XTools|排序",
        "XTools|Array": "XTools|数组",
        "XTools|Collision": "XTools|碰撞",
        "XTools|Math": "XTools|数学",
        "XTools|String": "XTools|字符串",
        "XTools|Transform": "XTools|Transform",
        "XTools|Utilities": "XTools|工具",
        "XTools|Debug": "XTools|调试",
        
        # Asset Naming 相关
        "Asset Naming": "资产命名",
        "Asset Naming|Validation": "资产命名|验证",
        "Asset Naming|Exclusion Rules": "资产命名|排除规则",
        "Asset Naming|Prefix": "资产命名|前缀",
        "Asset Naming|Suffix": "资产命名|后缀",
        
        # 常见术语
        "Connection": "连接",
        "Connection Mode": "连接模式",
        "Ascending": "升序",
        "Descending": "降序",
        "Input Array": "输入数组",
        "Output Array": "输出数组",
        "Return Value": "返回值",
        "Start Index": "起始索引",
        "End Index": "结束索引",
        "Max Distance": "最大距离",
        "Min Distance": "最小距离",
        "Random Stream": "随机流送",
        "Reference Location": "参考位置",
        "Sorted Actors": "排序后的Actors",
        "Original Indices": "原始索引",
        "Static Mesh": "静态网格体",
        "Skeletal Mesh": "骨骼网格体",
        "Is Valid": "是否有效",
        "In Place": "原地",
        "By Value": "按值",
        "By Reference": "按引用",
        
        # 常见短语
        "Unique": "去重",
        "Slice": "截取",
        "Primitives": "基础类型",
        "Constant Speed": "匀速",
        "Stream": "流送",
        "Asset": "资产",
        "Index": "索引",
        "Indices": "索引",
        "Value": "值",
        "Weight": "权重",
        "Probability": "概率",
        "Distance": "距离",
        "Speed": "速度",
        "Direction": "方向",
        "Location": "位置",
        "Rotation": "旋转",
        "Scale": "缩放",
        "True": "True",
        "False": "False",
        "None": "无",
        "Default": "默认",
        "Custom": "自定义",
    }
    
    def __init__(self, memory_file: str = "data/translation_memory.json"):
        """
        初始化翻译记忆库
        
        Args:
            memory_file: 翻译记忆库文件路径
        """
        self.memory_file = memory_file
        self.memory: Dict[str, str] = {}
        self.stats = {
            "total_entries": 0,
            "builtin_entries": 0,
            "learned_entries": 0,
            "hits": 0,
            "misses": 0,
            "last_updated": None
        }
        
        # 加载内置短语
        self.memory.update(self.BUILTIN_PHRASES)
        self.stats["builtin_entries"] = len(self.BUILTIN_PHRASES)
        
        # 从文件加载学习的翻译
        self._load_from_file()
        
    def _load_from_file(self):
        """从文件加载翻译记忆"""
        # 确保data目录存在
        data_dir = os.path.dirname(self.memory_file)
        if data_dir and not os.path.exists(data_dir):
            os.makedirs(data_dir, exist_ok=True)
        
        if os.path.exists(self.memory_file):
            try:
                with open(self.memory_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    learned = data.get("learned", {})
                    self.memory.update(learned)
                    self.stats["learned_entries"] = len(learned)
                    self.stats["last_updated"] = data.get("last_updated")
                print(f"[TM] 加载翻译记忆库: {len(learned)} 条学习记录")
            except Exception as e:
                print(f"[TM] 加载翻译记忆库失败: {e}")
        
        self.stats["total_entries"] = len(self.memory)
    
    def save_to_file(self):
        """保存翻译记忆到文件"""
        try:
            # 分离内置和学习的翻译
            learned = {k: v for k, v in self.memory.items() 
                      if k not in self.BUILTIN_PHRASES}
            
            data = {
                "learned": learned,
                "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "stats": self.stats
            }
            
            with open(self.memory_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            
            print(f"[TM] 保存翻译记忆库: {len(learned)} 条学习记录")
        except Exception as e:
            print(f"[TM] 保存翻译记忆库失败: {e}")
    
    def get(self, text: str) -> str:
        """
        查询翻译记忆
        
        Args:
            text: 原文
            
        Returns:
            翻译文本，如果不存在则返回None
        """
        # 精确匹配
        if text in self.memory:
            self.stats["hits"] += 1
            return self.memory[text]
        
        # 大小写不敏感匹配（针对首字母大写等情况）
        text_lower = text.lower()
        for key, value in self.memory.items():
            if key.lower() == text_lower:
                self.stats["hits"] += 1
                return value
        
        self.stats["misses"] += 1
        return None
    
    def add(self, original: str, translation: str):
        """
        添加翻译到记忆库
        
        Args:
            original: 原文
            translation: 译文
        """
        # 过滤空值
        if not original or not translation:
            return
        
        # 不覆盖内置短语
        if original in self.BUILTIN_PHRASES:
            return
        
        # 添加新的学习记录
        if original not in self.memory:
            self.memory[original] = translation
            self.stats["learned_entries"] += 1
            self.stats["total_entries"] += 1
    
    def batch_add(self, translations: List[Tuple[str, str]]):
        """
        批量添加翻译
        
        Args:
            translations: [(原文, 译文)] 列表
        """
        for original, translation in translations:
            self.add(original, translation)
    
    def is_simple_phrase(self, text: str) -> bool:
        """
        判断是否是简单短语（适合记忆库）
        
        严格条件：
        1. 长度较短（≤35字符）
        2. 不包含句子标点（.!?）
        3. 单词数量较少（≤5个单词）
        4. 不包含占位符（{0}, {1}等）
        5. 不包含转义字符（\\n, \\t等）
        6. 不包含特殊符号（括号说明、箭头等）
        7. 不以疑问词开头（Whether, How, What等）
        
        Args:
            text: 文本
            
        Returns:
            是否是简单短语
        """
        # 长度检查（更严格：35字符）
        if len(text) > 35:
            return False
        
        # 句子标点检查
        sentence_endings = ['. ', '! ', '? ', '。', '！', '？']
        if any(ending in text for ending in sentence_endings):
            return False
        
        # 单词数量检查（更严格：5个单词）
        word_count = len(text.split())
        if word_count > 5:
            return False
        
        # 占位符检查
        if '{0}' in text or '{1}' in text or '{2}' in text:
            return False
        
        # 转义字符检查
        if '\\n' in text or '\\t' in text or '\\r' in text:
            return False
        
        # 特殊符号检查（括号说明、方括号、箭头、项目符号）
        special_symbols = ['(', ')', '[', ']', '→', '•', '|']
        if any(sym in text for sym in special_symbols):
            return False
        
        # 疑问句开头检查
        question_starters = ['Whether', 'How', 'What', 'When', 'Where', 'Why', 'Which', 'Who']
        first_word = text.split()[0] if text.split() else ''
        if first_word in question_starters:
            return False
        
        # 介词短语检查（通常是描述性文本，但要排除一些例外）
        # 不检查"to"开头，因为有"To"这样的术语
        preposition_phrases = ['for ', 'of ', 'in the ', 'on the ', 'at the ', 'by the ', 'with the ']
        text_lower = text.lower()
        if any(prep in text_lower for prep in preposition_phrases):
            return False
        
        # 如果包含"duration", "spacing", "radius"等描述性词，不缓存
        descriptive_words = ['duration', 'spacing', 'radius', 'distance', 'example', 'tips']
        if any(word in text_lower for word in descriptive_words):
            return False
        
        # 如果包含"Prefix Mappings"这种复数+Mappings的模式，通常太具体
        if 'mappings' in text_lower or 'examples' in text_lower:
            return False
        
        return True
    
    def extract_phrases(self, texts: List[str]) -> Dict[str, List[int]]:
        """
        从文本列表中提取可缓存的短语
        
        Args:
            texts: 文本列表
            
        Returns:
            {短语: [索引列表]} 字典
        """
        phrase_map: Dict[str, List[int]] = {}
        
        for idx, text in enumerate(texts):
            # 只提取简单短语
            if self.is_simple_phrase(text):
                if text not in phrase_map:
                    phrase_map[text] = []
                phrase_map[text].append(idx)
        
        return phrase_map
    
    def preprocess_batch(self, texts: List[str]) -> Tuple[List[str], Dict[int, str]]:
        """
        预处理批次，提取已知翻译
        
        Args:
            texts: 待翻译文本列表
            
        Returns:
            (需要AI翻译的文本列表, {原索引: 翻译} 字典)
        """
        need_translation = []
        cached_translations = {}
        
        for idx, text in enumerate(texts):
            translation = self.get(text)
            if translation:
                cached_translations[idx] = translation
            else:
                need_translation.append(text)
        
        return need_translation, cached_translations
    
    def get_statistics(self) -> Dict:
        """获取统计信息"""
        hit_rate = 0.0
        total = self.stats["hits"] + self.stats["misses"]
        if total > 0:
            hit_rate = self.stats["hits"] / total * 100
        
        return {
            **self.stats,
            "hit_rate": f"{hit_rate:.1f}%",
            "total_queries": total
        }
    
    def print_statistics(self):
        """打印统计信息"""
        stats = self.get_statistics()
        print("\n" + "=" * 60)
        print("  翻译记忆库统计")
        print("=" * 60)
        print(f"记忆库条目: {stats['total_entries']} (内置: {stats['builtin_entries']}, 学习: {stats['learned_entries']})")
        print(f"查询命中: {stats['hits']} / {stats['total_queries']} ({stats['hit_rate']})")
        print(f"最后更新: {stats['last_updated'] or '从未'}")
        print("=" * 60)


if __name__ == "__main__":
    # 测试翻译记忆库
    tm = TranslationMemory()
    
    # 测试查询
    test_texts = [
        "XTools|Random",
        "Asset Naming|Validation",
        "Connection",
        "Ascending",
        "Some unknown text"
    ]
    
    print("测试翻译记忆库:")
    for text in test_texts:
        translation = tm.get(text)
        if translation:
            print(f"[OK] {text} -> {translation}")
        else:
            print(f"[X] {text} -> (未找到)")
    
    # 测试学习
    print("\n学习新翻译:")
    tm.add("Custom Phrase", "自定义短语")
    print(f"[OK] Custom Phrase -> {tm.get('Custom Phrase')}")
    
    # 打印统计
    tm.print_statistics()

