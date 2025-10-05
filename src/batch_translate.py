#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量翻译PO文件
自动扫描目录下的所有PO文件并直接翻译
"""

import os
import sys
import argparse
from datetime import datetime

# 添加src目录到路径
sys.path.insert(0, os.path.dirname(__file__))
from po_translator import POTranslator


def _generate_translation_report(reports):
    """
    生成翻译报告并保存到log文件夹
    
    Args:
        reports: 翻译报告列表
    """
    if not reports:
        return
    
    # 创建log目录
    log_dir = "log"
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
        print(f"\n已创建日志目录: {log_dir}")
    
    # 生成报告文件名（使用时间戳）
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_file = os.path.join(log_dir, f"translation_report_{timestamp}.txt")
    
    # 统计总数
    total_files = len(reports)
    total_translated = sum(r['translated'] for r in reports)
    total_failed = sum(r['failed'] for r in reports)
    total_entries = sum(r['total_entries'] for r in reports)
    
    # Token统计
    total_input_tokens = sum(r['token_stats']['input_tokens'] for r in reports)
    total_output_tokens = sum(r['token_stats']['output_tokens'] for r in reports)
    total_tokens = sum(r['token_stats']['total_tokens'] for r in reports)
    total_cost = sum(r['token_stats']['cost'] for r in reports)
    
    # 写入报告
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write("=" * 80 + "\n")
        f.write("PO文件翻译报告\n")
        f.write("=" * 80 + "\n")
        f.write(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"翻译文件数: {total_files}\n")
        f.write(f"总条目数: {total_entries}\n")
        
        # 需要翻译的总数
        total_need_translation = sum(r['need_translation'] for r in reports)
        f.write(f"需要翻译: {total_need_translation}\n")
        
        # 去重统计
        if any('deduplication' in r for r in reports):
            total_unique = sum(r['deduplication']['unique_entries'] for r in reports if 'deduplication' in r)
            total_duplicate = sum(r['deduplication']['duplicate_entries'] for r in reports if 'deduplication' in r)
            f.write(f"唯一条目: {total_unique}\n")
            if total_duplicate > 0:
                f.write(f"重复条目: {total_duplicate}\n")
        
        # 翻译记忆库统计
        if any('tm_stats' in r for r in reports):
            total_tm_hits = sum(r['tm_stats']['cache_hits'] for r in reports if 'tm_stats' in r)
            total_tm_queries = sum(r['tm_stats']['total_queries'] for r in reports if 'tm_stats' in r)
            if total_tm_queries > 0:
                tm_hit_rate = total_tm_hits / total_tm_queries * 100
                f.write(f"记忆库命中: {total_tm_hits}/{total_tm_queries} ({tm_hit_rate:.1f}%)\n")
        
        f.write(f"翻译成功: {total_translated}/{total_need_translation}\n")
        if total_failed > 0:
            f.write(f"翻译失败: {total_failed}\n")
        f.write("\n" + "-" * 80 + "\n")
        f.write("Token使用统计:\n")
        f.write(f"  输入tokens: {total_input_tokens:,}\n")
        f.write(f"  输出tokens: {total_output_tokens:,}\n")
        f.write(f"  总计tokens: {total_tokens:,}\n")
        f.write(f"  实际费用: ¥{total_cost:.4f}\n")
        f.write("=" * 80 + "\n\n")
        
        # 每个文件的详细报告
        for i, report in enumerate(reports, 1):
            f.write(f"\n{'=' * 80}\n")
            f.write(f"文件 [{i}/{total_files}]: {os.path.basename(report['file'])}\n")
            f.write(f"{'=' * 80}\n")
            f.write(f"文件路径: {report['file']}\n")
            f.write(f"总条目数: {report['total_entries']}\n")
            f.write(f"需要翻译: {report['need_translation']}\n")
            
            # 去重信息
            if 'deduplication' in report:
                dedup = report['deduplication']
                f.write(f"唯一条目: {dedup['unique_entries']}\n")
                if dedup['duplicate_entries'] > 0:
                    f.write(f"重复条目: {dedup['duplicate_entries']}\n")
            
            # 翻译记忆库统计
            if 'tm_stats' in report:
                tm = report['tm_stats']
                if tm['total_queries'] > 0:
                    f.write(f"记忆库命中: {tm['cache_hits']}/{tm['total_queries']} ({tm['hit_rate']:.1f}%)\n")
            
            f.write(f"翻译成功: {report['translated']}/{report['need_translation']}\n")
            if report['failed'] > 0:
                f.write(f"翻译失败: {report['failed']}\n")
            
            # Token统计
            stats = report['token_stats']
            f.write(f"\nToken使用:\n")
            f.write(f"  输入tokens: {stats['input_tokens']:,}\n")
            f.write(f"  输出tokens: {stats['output_tokens']:,}\n")
            f.write(f"  总计tokens: {stats['total_tokens']:,}\n")
            f.write(f"  费用: ¥{stats['cost']:.4f}\n")
            
            f.write(f"\n{'-' * 80}\n")
            f.write("翻译对照表:\n")
            f.write(f"{'-' * 80}\n\n")
            
            # 翻译对照
            for j, trans in enumerate(report['translations'], 1):
                f.write(f"[{j}]\n")
                f.write(f"原文: {trans['original']}\n")
                f.write(f"译文: {trans['translation']}\n")
                f.write("\n")
        
        f.write("\n" + "=" * 80 + "\n")
        f.write("报告结束\n")
        f.write("=" * 80 + "\n")
    
    print(f"\n翻译报告已保存: {report_file}")
    print(f"\n翻译汇总:")
    print(f"  文件数: {total_files}")
    print(f"  总条目: {total_entries}")
    print(f"  成功翻译: {total_translated}")
    if total_failed > 0:
        print(f"  翻译失败: {total_failed}")
    print(f"\nToken使用:")
    print(f"  总计tokens: {total_tokens:,}")
    print(f"  实际费用: ¥{total_cost:.4f}")
    print(f"\n报告位置: {report_file}")


def find_language_dirs(base_dir: str):
    """
    查找localization目录下的语言目录
    
    Args:
        base_dir: 基础目录路径（如 localization）
        
    Returns:
        list: 语言目录列表（如 ['en', 'zh-Hans', 'ja']）
    """
    lang_dirs = []
    
    if not os.path.exists(base_dir):
        return lang_dirs
    
    # 只查找第一层子目录
    try:
        for item in os.listdir(base_dir):
            item_path = os.path.join(base_dir, item)
            if os.path.isdir(item_path):
                # 检查该目录下是否有.po文件
                has_po = any(f.endswith('.po') for f in os.listdir(item_path) if os.path.isfile(os.path.join(item_path, f)))
                if has_po:
                    lang_dirs.append(item)
    except Exception as e:
        print(f"[警告] 扫描目录时出错: {e}")
    
    return sorted(lang_dirs)


def find_po_files(lang_dir: str):
    """
    查找指定语言目录下的所有PO文件
    
    Args:
        lang_dir: 语言目录路径（如 localization/zh-Hans）
        
    Returns:
        list: PO文件的完整路径列表
    """
    po_files = []
    
    if not os.path.exists(lang_dir):
        return po_files
    
    for root, dirs, files in os.walk(lang_dir):
        for file in files:
            if file.endswith('.po'):
                po_files.append(os.path.join(root, file))
    
    return po_files


def batch_translate(api_key: str, po_dir: str = "localization", batch_size: int = 10, lang: str = None):
    """
    批量翻译目录下的所有PO文件

    Args:
        api_key: Moonshot API密钥
        po_dir: PO文件基础目录（如 localization）
        batch_size: 每批翻译的条目数
        lang: 指定语言目录（如 zh-Hans），不指定则列出所有可用语言让用户选择
    """
    if not os.path.exists(po_dir):
        print(f"[错误] 目录不存在: {po_dir}")
        sys.exit(1)

    # 查找所有语言目录
    lang_dirs = find_language_dirs(po_dir)
    
    if not lang_dirs:
        print(f"[错误] 在 {po_dir} 中未找到包含PO文件的语言目录")
        print("提示: 预期目录结构如 localization/zh-Hans/*.po")
        sys.exit(1)
    
    # 如果没有指定语言，让用户选择
    if not lang:
        print("发现以下语言目录:")
        print("=" * 60)
        for i, lang_dir in enumerate(lang_dirs, 1):
            lang_path = os.path.join(po_dir, lang_dir)
            po_count = len([f for f in os.listdir(lang_path) if f.endswith('.po')])
            print(f"  [{i}] {lang_dir} ({po_count} 个PO文件)")
        print("=" * 60)
        
        try:
            choice = input("\n请选择要翻译的语言 (输入序号或语言代码): ").strip()
            
            # 尝试作为序号
            if choice.isdigit():
                idx = int(choice) - 1
                if 0 <= idx < len(lang_dirs):
                    lang = lang_dirs[idx]
                else:
                    print("[错误] 无效的序号")
                    sys.exit(1)
            # 尝试作为语言代码
            elif choice in lang_dirs:
                lang = choice
            else:
                print(f"[错误] 未找到语言: {choice}")
                sys.exit(1)
        except KeyboardInterrupt:
            print("\n\n[!] 操作已取消")
            sys.exit(0)
    
    # 验证语言目录
    lang_path = os.path.join(po_dir, lang)
    if not os.path.exists(lang_path):
        print(f"[错误] 语言目录不存在: {lang_path}")
        sys.exit(1)
    
    # 查找该语言下的所有PO文件
    po_files = find_po_files(lang_path)

    if not po_files:
        print(f"[错误] 在 {lang_path} 中未找到PO文件")
        sys.exit(1)

    print(f"\n翻译目标: {lang}")
    print(f"找到 {len(po_files)} 个PO文件")
    
    # 显示找到的文件列表
    print("\n待翻译文件列表:")
    for i, po_file in enumerate(po_files, 1):
        filename = os.path.basename(po_file)
        print(f"  [{i}] {filename}")
    
    print("=" * 60)

    translator = POTranslator(api_key)
    all_reports = []

    for i, po_file in enumerate(po_files, 1):
        rel_path = os.path.relpath(po_file, po_dir)
        
        print(f"\n[{i}/{len(po_files)}] 处理文件: {rel_path}")
        print("-" * 60)

        try:
            report = translator.translate_po_file(po_file, batch_size)
            all_reports.append(report)
        except Exception as e:
            print(f"[错误] 翻译失败: {e}")
            continue

    print("\n" + "=" * 60)
    print("批量翻译完成！")
    
    # 生成翻译报告
    _generate_translation_report(all_reports)


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='批量翻译PO文件（使用Moonshot AI）')
    parser.add_argument('--api-key', required=True, help='Moonshot API密钥')
    parser.add_argument('--dir', default='localization',
                       help='PO文件基础目录（默认: localization）')
    parser.add_argument('--lang', help='语言代码（如 zh-Hans, en, ja），不指定则交互选择')
    parser.add_argument('--batch-size', type=int, default=10,
                       help='每批翻译的条目数（默认: 10）')

    args = parser.parse_args()

    batch_translate(args.api_key, args.dir, args.batch_size, args.lang)


if __name__ == '__main__':
    main()
