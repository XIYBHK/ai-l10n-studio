#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
使用配置文件进行批量翻译
"""

import os
import sys
# 添加src目录到路径
sys.path.insert(0, os.path.dirname(__file__))
from batch_translate import batch_translate


def load_env():
    """加载.env配置文件"""
    env_file = '.env'
    if not os.path.exists(env_file):
        print("错误: 未找到.env配置文件")
        print("请复制.env.example为.env并填入你的API密钥")
        return None

    config = {}
    with open(env_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                config[key.strip()] = value.strip()

    return config


def main():
    """主函数"""
    config = load_env()
    if not config:
        return

    api_key = config.get('MOONSHOT_API_KEY')
    if not api_key or api_key == 'your_api_key_here':
        print("错误: 请在.env文件中设置有效的MOONSHOT_API_KEY")
        return

    batch_size = int(config.get('BATCH_SIZE', 10))
    po_dir = config.get('PO_DIR', 'localization')
    lang = config.get('LANGUAGE', '')  # 可选配置

    print("配置信息:")
    print(f"  PO目录: {po_dir}")
    if lang:
        print(f"  目标语言: {lang}")
    print(f"  批量大小: {batch_size}")
    print()

    batch_translate(api_key, po_dir, batch_size, lang if lang else None)


if __name__ == '__main__':
    main()
