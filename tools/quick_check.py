#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
快速验证脚本 - 测试PO文件解析（无需安装依赖）
"""

import os
import re


def quick_check_po_file(po_file):
    """快速检查PO文件结构"""
    if not os.path.exists(po_file):
        print(f"[错误] 文件不存在: {po_file}")
        return

    print(f"正在检查: {po_file}")
    print("=" * 60)

    with open(po_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # 统计（排除空msgid的文件头）
    # 找到所有 msgid/msgstr 对
    msgid_pattern = re.compile(r'^msgid\s+"(.*?)"$', re.MULTILINE)
    msgstr_pattern = re.compile(r'^msgstr\s+"(.*?)"$', re.MULTILINE)
    
    msgids = msgid_pattern.findall(content)
    msgstrs = msgstr_pattern.findall(content)
    
    # 只统计非空msgid的条目（排除文件头）
    valid_entries = [(mid, mst) for mid, mst in zip(msgids, msgstrs) if mid]
    
    total_count = len(valid_entries)
    translated_count = sum(1 for mid, mst in valid_entries if mst)
    untranslated_count = total_count - translated_count

    print(f"总条目数: {total_count}")
    print(f"未翻译: {untranslated_count}")
    print(f"已翻译: {translated_count}")
    if total_count > 0:
        print(f"翻译率: {translated_count / total_count * 100:.1f}%")
    else:
        print(f"翻译率: 0.0%")
    print()

    # 显示前3个未翻译条目
    if untranslated_count > 0:
        print("前3个未翻译条目:")
        print("-" * 60)

        lines = content.split('\n')
        count = 0
        i = 0

        while i < len(lines) and count < 3:
            if lines[i].startswith('msgid "') and i + 1 < len(lines):
                msgid = re.search(r'msgid\s+"(.+)"', lines[i])  # 只匹配非空msgid
                msgstr = re.search(r'msgstr\s+"(.*)"', lines[i+1])

                if msgid and msgstr and msgstr.group(1) == "":
                    count += 1
                    print(f"{count}. {msgid.group(1)}")
            i += 1
        
        if count == 0:
            print("(无未翻译条目)")
    else:
        print("\n[OK] 全部条目已翻译！")
        print("-" * 60)

    print("=" * 60)
    print("[OK] PO文件结构有效")


def find_best_po_file(base_dir="localization"):
    """
    智能查找最佳检查目标：
    1. 优先选择有待翻译条目的文件
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
    
    # 优先级1: 查找有未翻译条目的文件
    for po_file in all_po_files:
        try:
            with open(po_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 快速检查是否有未翻译条目
            msgid_pattern = re.compile(r'^msgid\s+"(.*?)"$', re.MULTILINE)
            msgstr_pattern = re.compile(r'^msgstr\s+"(.*?)"$', re.MULTILINE)
            
            msgids = msgid_pattern.findall(content)
            msgstrs = msgstr_pattern.findall(content)
            
            valid_entries = [(mid, mst) for mid, mst in zip(msgids, msgstrs) if mid]
            untranslated = sum(1 for mid, mst in valid_entries if not mst)
            
            if untranslated > 0:
                return po_file
        except Exception:
            continue
    
    # 优先级2: 选择非英文目录（通常是翻译目标）
    for po_file in all_po_files:
        if '/en/' not in po_file.replace('\\', '/') and '\\en\\' not in po_file:
            return po_file
    
    # 优先级3: 返回第一个文件
    return all_po_files[0]


def main():
    """主函数"""
    po_file = find_best_po_file("localization")
    
    if po_file and os.path.exists(po_file):
        quick_check_po_file(po_file)
    else:
        print("[!] 未找到PO文件")
        print("请确保 localization 目录下存在 .po 文件")


if __name__ == '__main__':
    main()
