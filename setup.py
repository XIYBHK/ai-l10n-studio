#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PO文件自动翻译工具 - 安装向导
替代 setup.bat，提供更好的中文支持
"""

import os
import sys
import subprocess
import shutil


def print_header(title):
    """打印标题"""
    print()
    print("=" * 60)
    print(f"  {title}")
    print("=" * 60)
    print()


def print_step(step, total, message):
    """打印步骤信息"""
    print(f"[{step}/{total}] {message}")


def check_python():
    """检查Python环境"""
    print_step(1, 3, "检查 Python 环境...")
    
    version = sys.version_info
    print(f"[OK] Python {version.major}.{version.minor}.{version.micro}")
    
    if version.major < 3 or (version.major == 3 and version.minor < 7):
        print()
        print("[错误] Python 版本过低")
        print("   需要 Python 3.7 或更高版本")
        print("   下载地址: https://www.python.org/downloads/")
        return False
    
    print()
    return True


def install_dependencies():
    """安装依赖包"""
    print_step(2, 3, "安装依赖包...")
    
    if not os.path.exists("requirements.txt"):
        print("[错误] 未找到 requirements.txt 文件")
        return False
    
    try:
        # 使用 subprocess 调用 pip
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "-r", "requirements.txt"],
            capture_output=True,
            text=True,
            encoding='utf-8'
        )
        
        if result.returncode != 0:
            print("[错误] 依赖安装失败")
            print(result.stderr)
            return False
        
        print("[OK] 依赖安装成功")
        print()
        return True
        
    except Exception as e:
        print(f"[错误] {e}")
        return False


def create_env_file():
    """创建配置文件"""
    print_step(3, 3, "创建配置文件...")
    
    if os.path.exists(".env"):
        print("[OK] .env 配置文件已存在")
        print()
        return True
    
    # 创建 .env.example 如果不存在
    if not os.path.exists(".env.example"):
        env_example_content = """# Moonshot AI API 配置
MOONSHOT_API_KEY=your_api_key_here

# PO文件目录（相对路径）
PO_DIR=fy/zh-Hans

# 批量翻译大小（每批处理的条目数）
BATCH_SIZE=10
"""
        with open(".env.example", "w", encoding="utf-8") as f:
            f.write(env_example_content)
        print("[OK] 已创建 .env.example 模板文件")
    
    # 复制 .env.example 到 .env
    try:
        shutil.copy(".env.example", ".env")
        print("[OK] 已创建 .env 配置文件")
        print()
        print("-" * 60)
        print("[!] 重要提示:")
        print("   1. 请编辑 .env 文件")
        print("   2. 填入你的 Moonshot API 密钥")
        print("   3. 访问 https://platform.moonshot.cn/ 获取密钥")
        print("-" * 60)
        print()
        return True
        
    except Exception as e:
        print(f"[错误] 无法创建配置文件: {e}")
        return False


def main():
    """主函数"""
    print_header("PO文件自动翻译工具 - 安装向导")
    
    # 步骤1: 检查Python
    if not check_python():
        print()
        input("按回车键退出...")
        sys.exit(1)
    
    # 步骤2: 安装依赖
    if not install_dependencies():
        print()
        input("按回车键退出...")
        sys.exit(1)
    
    # 步骤3: 创建配置文件
    if not create_env_file():
        print()
        input("按回车键退出...")
        sys.exit(1)
    
    # 安装完成
    print_header("安装完成！")
    print("下一步操作:")
    print("  1. 编辑 .env 文件设置 API 密钥")
    print("  2. 运行: python run.py")
    print("     或直接运行: python translate.py")
    print()
    print("=" * 60)
    print()
    
    input("按回车键退出...")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n操作已取消")
        sys.exit(0)
    except Exception as e:
        print(f"\n\n[错误] 发生错误: {e}")
        import traceback
        traceback.print_exc()
        input("\n按回车键退出...")
        sys.exit(1)
