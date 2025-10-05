#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
翻译记忆库管理工具
用于查看、编辑、导入导出翻译记忆库
"""

import os
import sys
import json
import argparse

# 添加src目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
from translation_memory import TranslationMemory


def list_entries(tm: TranslationMemory, filter_type: str = "all"):
    """列出记忆库条目"""
    print("\n" + "=" * 80)
    print(f"  翻译记忆库条目 ({filter_type})")
    print("=" * 80)
    
    entries = []
    if filter_type == "builtin":
        entries = list(tm.BUILTIN_PHRASES.items())
    elif filter_type == "learned":
        entries = [(k, v) for k, v in tm.memory.items() 
                  if k not in tm.BUILTIN_PHRASES]
    else:  # all
        entries = list(tm.memory.items())
    
    if not entries:
        print("(无条目)")
        return
    
    # 按原文排序
    entries.sort(key=lambda x: x[0])
    
    for i, (original, translation) in enumerate(entries, 1):
        print(f"{i:3d}. {original:40s} -> {translation}")
    
    print("=" * 80)
    print(f"共 {len(entries)} 条")


def search_entries(tm: TranslationMemory, keyword: str):
    """搜索记忆库条目"""
    print("\n" + "=" * 80)
    print(f"  搜索结果: '{keyword}'")
    print("=" * 80)
    
    results = []
    keyword_lower = keyword.lower()
    
    for original, translation in tm.memory.items():
        if (keyword_lower in original.lower() or 
            keyword_lower in translation.lower()):
            results.append((original, translation))
    
    if not results:
        print("(未找到匹配项)")
        return
    
    for i, (original, translation) in enumerate(results, 1):
        print(f"{i:3d}. {original:40s} -> {translation}")
    
    print("=" * 80)
    print(f"找到 {len(results)} 条")


def add_entry(tm: TranslationMemory, original: str, translation: str):
    """添加新条目"""
    if original in tm.BUILTIN_PHRASES:
        print(f"[!] 无法修改内置短语: {original}")
        return
    
    if original in tm.memory:
        old_translation = tm.memory[original]
        print(f"[!] 条目已存在，将覆盖:")
        print(f"    原文: {original}")
        print(f"    旧译文: {old_translation}")
        print(f"    新译文: {translation}")
    
    tm.add(original, translation)
    tm.save_to_file()
    print(f"[OK] 已添加: {original} -> {translation}")


def delete_entry(tm: TranslationMemory, original: str):
    """删除条目"""
    if original in tm.BUILTIN_PHRASES:
        print(f"[!] 无法删除内置短语: {original}")
        return
    
    if original not in tm.memory:
        print(f"[!] 条目不存在: {original}")
        return
    
    translation = tm.memory[original]
    del tm.memory[original]
    tm.stats["learned_entries"] -= 1
    tm.stats["total_entries"] -= 1
    tm.save_to_file()
    print(f"[OK] 已删除: {original} -> {translation}")


def export_tm(tm: TranslationMemory, output_file: str, export_type: str = "all"):
    """导出翻译记忆库"""
    entries = {}
    
    if export_type == "builtin":
        entries = tm.BUILTIN_PHRASES.copy()
    elif export_type == "learned":
        entries = {k: v for k, v in tm.memory.items() 
                  if k not in tm.BUILTIN_PHRASES}
    else:  # all
        entries = tm.memory.copy()
    
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(entries, f, ensure_ascii=False, indent=2)
        print(f"[OK] 已导出 {len(entries)} 条到: {output_file}")
    except Exception as e:
        print(f"[错误] 导出失败: {e}")


def import_tm(tm: TranslationMemory, input_file: str):
    """导入翻译记忆库"""
    if not os.path.exists(input_file):
        print(f"[错误] 文件不存在: {input_file}")
        return
    
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            entries = json.load(f)
        
        if not isinstance(entries, dict):
            print(f"[错误] 文件格式不正确，应该是 JSON 对象")
            return
        
        imported = 0
        skipped = 0
        
        for original, translation in entries.items():
            if original in tm.BUILTIN_PHRASES:
                skipped += 1
                continue
            tm.add(original, translation)
            imported += 1
        
        tm.save_to_file()
        print(f"[OK] 已导入 {imported} 条")
        if skipped > 0:
            print(f"[!] 跳过 {skipped} 条内置短语")
    except Exception as e:
        print(f"[错误] 导入失败: {e}")


def clear_learned(tm: TranslationMemory):
    """清空学习的翻译"""
    learned = [k for k in tm.memory.keys() if k not in tm.BUILTIN_PHRASES]
    
    if not learned:
        print("[!] 没有学习的翻译可清空")
        return
    
    print(f"[!] 即将清空 {len(learned)} 条学习的翻译")
    confirm = input("确认? (yes/no): ")
    
    if confirm.lower() == 'yes':
        for key in learned:
            del tm.memory[key]
        tm.stats["learned_entries"] = 0
        tm.stats["total_entries"] = len(tm.BUILTIN_PHRASES)
        tm.save_to_file()
        print(f"[OK] 已清空 {len(learned)} 条学习的翻译")
    else:
        print("[!] 已取消")


def main():
    parser = argparse.ArgumentParser(
        description="翻译记忆库管理工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 查看所有条目
  python manage_tm.py --list all
  
  # 查看内置短语
  python manage_tm.py --list builtin
  
  # 查看学习的翻译
  python manage_tm.py --list learned
  
  # 搜索条目
  python manage_tm.py --search "Connection"
  
  # 添加新条目
  python manage_tm.py --add "Custom Phrase" "自定义短语"
  
  # 删除条目
  python manage_tm.py --delete "Custom Phrase"
  
  # 导出翻译记忆库
  python manage_tm.py --export tm_export.json
  
  # 导入翻译记忆库
  python manage_tm.py --import tm_export.json
  
  # 查看统计信息
  python manage_tm.py --stats
  
  # 清空学习的翻译
  python manage_tm.py --clear-learned
        """
    )
    
    parser.add_argument('--list', choices=['all', 'builtin', 'learned'],
                       help='列出记忆库条目')
    parser.add_argument('--search', metavar='KEYWORD',
                       help='搜索条目')
    parser.add_argument('--add', nargs=2, metavar=('ORIGINAL', 'TRANSLATION'),
                       help='添加新条目')
    parser.add_argument('--delete', metavar='ORIGINAL',
                       help='删除条目')
    parser.add_argument('--export', metavar='FILE',
                       help='导出翻译记忆库到JSON文件')
    parser.add_argument('--export-type', choices=['all', 'builtin', 'learned'],
                       default='all', help='导出类型')
    parser.add_argument('--import', dest='import_file', metavar='FILE',
                       help='从JSON文件导入翻译记忆库')
    parser.add_argument('--stats', action='store_true',
                       help='显示统计信息')
    parser.add_argument('--clear-learned', action='store_true',
                       help='清空学习的翻译（保留内置短语）')
    
    args = parser.parse_args()
    
    # 初始化翻译记忆库
    tm = TranslationMemory()
    
    # 执行操作
    if args.list:
        list_entries(tm, args.list)
    elif args.search:
        search_entries(tm, args.search)
    elif args.add:
        add_entry(tm, args.add[0], args.add[1])
    elif args.delete:
        delete_entry(tm, args.delete)
    elif args.export:
        export_tm(tm, args.export, args.export_type)
    elif args.import_file:
        import_tm(tm, args.import_file)
    elif args.stats:
        tm.print_statistics()
    elif args.clear_learned:
        clear_learned(tm)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

