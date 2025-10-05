#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试PO文件解析和翻译功能
"""

import os
import sys
# 添加src目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
from po_translator import POTranslator, POEntry


def test_parse():
    """测试PO文件解析"""
    print("=" * 60)
    print("测试PO文件解析")
    print("=" * 60)

    translator = POTranslator(api_key="test_key")
    header, entries = translator.parse_po_file("fy/en/X_ToolkitTest.po")

    print(f"✓ 头部行数: {len(header)}")
    print(f"✓ 总条目数: {len(entries)}")

    # 显示前3个条目
    print("\n前3个条目:")
    for i, entry in enumerate(entries[:3], 1):
        print(f"\n条目 {i}:")
        print(f"  msgid: {entry.msgid}")
        print(f"  msgstr: {entry.msgstr}")
        print(f"  需要翻译: {entry.needs_translation()}")

    # 统计需要翻译的条目
    need_trans = sum(1 for e in entries if e.needs_translation())
    print(f"\n✓ 需要翻译的条目: {need_trans}/{len(entries)}")


def test_write():
    """测试PO文件写入"""
    print("\n" + "=" * 60)
    print("测试PO文件写入")
    print("=" * 60)

    translator = POTranslator(api_key="test_key")
    header, entries = translator.parse_po_file("fy/en/X_ToolkitTest.po")

    # 模拟翻译前3个条目
    count = 0
    for entry in entries:
        if entry.needs_translation() and count < 3:
            entry.msgstr = f"[测试翻译] {entry.msgid}"
            count += 1

    # 写入测试文件
    test_output = "test_output.po"
    translator._write_po_file(test_output, header, entries)
    print(f"✓ 已写入测试文件: {test_output}")

    # 读取验证
    with open(test_output, 'r', encoding='utf-8') as f:
        content = f.read()
        if "[测试翻译]" in content:
            print("✓ 文件写入验证成功")
        else:
            print("✗ 文件写入验证失败")

    import os
    os.remove(test_output)
    print("✓ 已删除测试文件")


def test_api_format():
    """测试API调用格式"""
    print("\n" + "=" * 60)
    print("测试API调用格式")
    print("=" * 60)

    test_texts = [
        "XTools|Collision",
        "XTools|Random",
        "Array Operations"
    ]

    print("待翻译文本:")
    for i, text in enumerate(test_texts, 1):
        print(f"  {i}. {text}")

    print("\n注意: 此测试不会实际调用API")
    print("实际翻译需要提供有效的API密钥")


def main():
    """主函数"""
    try:
        test_parse()
        test_write()
        test_api_format()

        print("\n" + "=" * 60)
        print("所有测试完成！")
        print("=" * 60)

    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()
