#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
统计PO文件信息
分析翻译工作量和成本预估
"""

import os
import sys
# 添加src目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
from po_translator import POTranslator


def analyze_po_file(file_path: str):
    """
    分析单个PO文件

    Args:
        file_path: PO文件路径

    Returns:
        统计信息字典
    """
    translator = POTranslator(api_key="dummy")
    _, entries = translator.parse_po_file(file_path)

    total_entries = len(entries)
    has_msgid = sum(1 for e in entries if e.msgid)
    has_msgstr = sum(1 for e in entries if e.msgstr)
    needs_trans = sum(1 for e in entries if e.needs_translation())

    # 估算字符数
    total_chars = sum(len(e.msgid) for e in entries if e.msgid)

    return {
        'total_entries': total_entries,
        'has_msgid': has_msgid,
        'has_msgstr': has_msgstr,
        'needs_trans': needs_trans,
        'total_chars': total_chars
    }


def find_po_files(base_dir: str):
    """
    递归查找目录下的所有PO文件
    
    Args:
        base_dir: 基础目录路径
        
    Returns:
        list: PO文件的完整路径列表
    """
    po_files = []
    
    if not os.path.exists(base_dir):
        return po_files
    
    for root, dirs, files in os.walk(base_dir):
        for file in files:
            if file.endswith('.po'):
                po_files.append(os.path.join(root, file))
    
    return po_files


def analyze_directory(directory: str):
    """
    分析目录下所有PO文件（递归搜索）

    Args:
        directory: PO文件目录
    """
    if not os.path.exists(directory):
        print(f"[错误] 目录不存在: {directory}")
        return

    # 递归查找所有PO文件
    po_files = find_po_files(directory)

    if not po_files:
        print(f"[错误] 在 {directory} 及其子目录中未找到PO文件")
        return

    print(f"分析目录: {directory} (递归搜索)")
    print("=" * 80)

    total_stats = {
        'files': 0,
        'total_entries': 0,
        'has_msgid': 0,
        'has_msgstr': 0,
        'needs_trans': 0,
        'total_chars': 0
    }

    for file_path in po_files:
        rel_path = os.path.relpath(file_path, directory)
        print(f"\n文件: {rel_path}")

        stats = analyze_po_file(file_path)

        print(f"  总条目数: {stats['total_entries']}")
        print(f"  有源文本: {stats['has_msgid']}")
        print(f"  已翻译: {stats['has_msgstr']}")
        print(f"  需翻译: {stats['needs_trans']}")
        print(f"  字符总数: {stats['total_chars']:,}")

        total_stats['files'] += 1
        for key in stats:
            total_stats[key] += stats[key]

    print("\n" + "=" * 80)
    print(f"\n汇总统计 ({total_stats['files']} 个文件):")
    print(f"  总条目数: {total_stats['total_entries']:,}")
    print(f"  有源文本: {total_stats['has_msgid']:,}")
    print(f"  已翻译: {total_stats['has_msgstr']:,}")
    print(f"  需翻译: {total_stats['needs_trans']:,}")
    print(f"  字符总数: {total_stats['total_chars']:,}")

    # 成本估算（Moonshot按token计费，约1000 tokens = ¥0.012）
    # 粗略估算：1个字符 ≈ 0.5 token（英文），翻译需要输入+输出约2倍
    estimated_tokens = total_stats['total_chars'] * 0.5 * 2
    estimated_cost = estimated_tokens / 1000 * 0.012

    print(f"\n预估成本 (Moonshot API):")
    print(f"  预估Tokens: {estimated_tokens:,.0f}")
    print(f"  预估费用: ¥{estimated_cost:.2f}")
    print(f"  (此为粗略估算，实际费用可能有差异)")


def main():
    """主函数"""
    import argparse
    
    # 默认搜索localization目录

    parser = argparse.ArgumentParser(description='分析PO文件统计信息（递归搜索）')
    parser.add_argument('--dir', default='localization',
                       help='PO文件目录，会递归搜索所有子目录（默认: localization）')

    args = parser.parse_args()

    analyze_directory(args.dir)


if __name__ == '__main__':
    main()
