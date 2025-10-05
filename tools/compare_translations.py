#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
预览翻译结果对比工具
对比原始英文和翻译后的中文，方便检查翻译质量
"""

import os
import sys
# 添加src目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
from po_translator import POTranslator


def compare_translations(en_file: str, zh_file: str, limit: int = 10):
    """
    对比英文和中文翻译

    Args:
        en_file: 英文PO文件路径
        zh_file: 中文PO文件路径
        limit: 显示条目数量限制
    """
    if not os.path.exists(en_file):
        print(f"错误: 英文文件不存在: {en_file}")
        return

    if not os.path.exists(zh_file):
        print(f"错误: 中文文件不存在: {zh_file}")
        return

    translator = POTranslator(api_key="dummy")

    print("正在解析文件...")
    _, en_entries = translator.parse_po_file(en_file)
    _, zh_entries = translator.parse_po_file(zh_file)

    print(f"\n英文条目数: {len(en_entries)}")
    print(f"中文条目数: {len(zh_entries)}")
    print("=" * 80)

    count = 0
    for en_entry, zh_entry in zip(en_entries, zh_entries):
        if en_entry.msgid and zh_entry.msgstr:
            print(f"\n[{count + 1}] 对比:")
            print(f"  EN: {en_entry.msgid}")
            print(f"  ZH: {zh_entry.msgstr}")

            count += 1
            if count >= limit:
                break

    print("\n" + "=" * 80)

    # 统计翻译覆盖率
    en_total = sum(1 for e in en_entries if e.msgid)
    zh_translated = sum(1 for e in zh_entries if e.msgstr)
    coverage = (zh_translated / en_total * 100) if en_total > 0 else 0

    print(f"\n翻译统计:")
    print(f"  总条目: {en_total}")
    print(f"  已翻译: {zh_translated}")
    print(f"  覆盖率: {coverage:.1f}%")


def main():
    """主函数"""
    import argparse

    parser = argparse.ArgumentParser(description='预览PO文件翻译进度')
    parser.add_argument('--file', help='PO文件路径（不指定则自动查找）')
    parser.add_argument('--limit', type=int, default=10,
                       help='显示条目数量（默认10）')

    args = parser.parse_args()
    
    # 如果没有指定文件，智能查找最佳预览目标
    po_file = args.file
    if not po_file:
        po_file = find_best_preview_file("localization")
        if po_file:
            print(f"自动选择: {po_file}\n")
    
    if not po_file:
        print("[错误] 未找到PO文件，请使用 --file 参数指定")
        return

    show_translation_preview(po_file, args.limit)


def find_best_preview_file(base_dir="localization"):
    """
    智能查找最佳预览目标：
    1. 优先选择有部分翻译的文件（可以对比）
    2. 否则选择非英文源文件（zh-Hans等）
    3. 最后选择任意PO文件
    """
    if not os.path.exists(base_dir):
        return None
    
    all_po_files = []
    
    # 收集所有PO文件
    for root, dirs, files in os.walk(base_dir):
        for file in files:
            if file.endswith('.po'):
                full_path = os.path.join(root, file)
                all_po_files.append(full_path)
    
    if not all_po_files:
        return None
    
    # 优先级1: 查找有翻译但未完成的文件（最适合预览进度）
    import re
    for po_file in all_po_files:
        try:
            with open(po_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            msgid_pattern = re.compile(r'^msgid\s+"(.*?)"$', re.MULTILINE)
            msgstr_pattern = re.compile(r'^msgstr\s+"(.*?)"$', re.MULTILINE)
            
            msgids = msgid_pattern.findall(content)
            msgstrs = msgstr_pattern.findall(content)
            
            valid_entries = [(mid, mst) for mid, mst in zip(msgids, msgstrs) if mid]
            translated = sum(1 for mid, mst in valid_entries if mst)
            total = len(valid_entries)
            
            # 有部分翻译（10%-99%）的文件最适合预览
            if total > 0 and 0 < translated < total:
                return po_file
        except Exception:
            continue
    
    # 优先级2: 选择已完成翻译的非英文文件
    for po_file in all_po_files:
        if '/en/' not in po_file.replace('\\', '/') and '\\en\\' not in po_file:
            return po_file
    
    # 优先级3: 返回第一个文件
    return all_po_files[0]


def show_translation_preview(po_file: str, limit: int = 10):
    """
    预览PO文件翻译进度

    Args:
        po_file: PO文件路径
        limit: 显示条目数量
    """
    if not os.path.exists(po_file):
        print(f"错误: 文件不存在: {po_file}")
        return

    translator = POTranslator(api_key="dummy")

    print("正在解析文件...")
    _, entries = translator.parse_po_file(po_file)

    print(f"\n文件: {po_file}")
    print(f"总条目数: {len(entries)}")
    print("=" * 80)

    count = 0
    for entry in entries:
        if entry.msgid:
            status = "[OK]" if entry.msgstr else "[X]"
            print(f"\n[{count + 1}] {status}")
            print(f"  原文: {entry.msgid}")
            print(f"  译文: {entry.msgstr if entry.msgstr else '(未翻译)'}")

            count += 1
            if count >= limit:
                break

    print("\n" + "=" * 80)

    # 统计翻译覆盖率
    total = sum(1 for e in entries if e.msgid)
    translated = sum(1 for e in entries if e.msgstr)
    coverage = (translated / total * 100) if total > 0 else 0

    print(f"\n翻译统计:")
    print(f"  总条目: {total}")
    print(f"  已翻译: {translated}")
    print(f"  覆盖率: {coverage:.1f}%")


if __name__ == '__main__':
    main()
