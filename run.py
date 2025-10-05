#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PO文件自动翻译工具 - 主菜单
替代 run.bat，提供更好的中文支持和跨平台兼容性
"""

import os
import sys
import subprocess


def clear_screen():
    """清屏"""
    os.system('cls' if os.name == 'nt' else 'clear')


def print_menu():
    """打印菜单"""
    clear_screen()
    print()
    print("=" * 60)
    print("  PO文件自动翻译工具")
    print("=" * 60)
    print()
    print("  [1] 分析PO文件")
    print("  [2] 开始翻译")
    print("  [3] 预览翻译进度")
    print("  [4] 快速检查")
    print("  [0] 退出")
    print()
    print("=" * 60)
    print()


def run_script(script_name, args=None):
    """运行Python脚本"""
    cmd = [sys.executable, script_name]
    if args:
        cmd.extend(args)
    
    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as e:
        print(f"\n[错误] 执行出错: {e}")
    except KeyboardInterrupt:
        print("\n\n[!] 操作已取消")
    except Exception as e:
        print(f"\n[错误] 发生错误: {e}")


def analyze_po():
    """分析PO文件"""
    clear_screen()
    print()
    print("=" * 60)
    print("  分析PO文件")
    print("=" * 60)
    print()
    
    run_script("tools/analyze_po.py")
    
    print()
    print("=" * 60)
    input("\n按回车键返回菜单...")


def translate():
    """开始翻译"""
    clear_screen()
    print()
    print("=" * 60)
    print("  开始翻译")
    print("=" * 60)
    print()
    print("[!] 注意: 请确保已配置 .env 文件中的 API 密钥")
    print()
    
    # 检查配置文件
    if not os.path.exists(".env"):
        print("[错误] 未找到 .env 配置文件")
        print("   请先运行 python setup.py 进行安装配置")
        print()
        print("=" * 60)
        input("\n按回车键返回菜单...")
        return
    
    run_script("src/translate.py")
    
    print()
    print("=" * 60)
    input("\n按回车键返回菜单...")


def preview():
    """预览翻译进度"""
    clear_screen()
    print()
    print("=" * 60)
    print("  预览翻译进度")
    print("=" * 60)
    print()
    
    run_script("tools/compare_translations.py", ["--limit", "20"])
    
    print()
    print("=" * 60)
    input("\n按回车键返回菜单...")


def quick_check():
    """快速检查"""
    clear_screen()
    print()
    print("=" * 60)
    print("  快速检查")
    print("=" * 60)
    print()
    
    run_script("tools/quick_check.py")
    
    print()
    print("=" * 60)
    input("\n按回车键返回菜单...")


def main():
    """主函数"""
    menu_actions = {
        '1': analyze_po,
        '2': translate,
        '3': preview,
        '4': quick_check,
    }
    
    while True:
        print_menu()
        
        try:
            choice = input("请选择 (0-4): ").strip()
            
            if choice == '0':
                clear_screen()
                print()
                print("感谢使用！")
                print()
                break
            
            if choice in menu_actions:
                menu_actions[choice]()
            else:
                print("\n[错误] 无效选项，请重新选择")
                input("\n按回车键继续...")
                
        except KeyboardInterrupt:
            clear_screen()
            print()
            print("感谢使用！")
            print()
            break
        except Exception as e:
            print(f"\n[错误] 发生错误: {e}")
            input("\n按回车键继续...")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n[错误] 程序异常: {e}")
        import traceback
        traceback.print_exc()
        input("\n按回车键退出...")
        sys.exit(1)
