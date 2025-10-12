#!/usr/bin/env node
/**
 * 临时脚本：批量重构错误处理（轻量级方案）
 * 
 * 策略：参考 clash-verge-rev 项目
 * - 只在 Tauri 命令入口使用 wrap_err!
 * - 内部函数保持简单的 map_err
 * - 避免日志冗余和性能开销
 * 
 * 使用方式：
 * - Dry-run: node scripts/refactor-error-handling.js --dry-run
 * - 执行替换: node scripts/refactor-error-handling.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDryRun = process.argv.includes('--dry-run');

// 需要处理的命令文件
const targetFiles = [
  'src-tauri/src/commands/translator.rs',
  'src-tauri/src/commands/ai_config.rs',
  'src-tauri/src/commands/file_format.rs',
  'src-tauri/src/commands/language.rs',
  'src-tauri/src/commands/system.rs',
  'src-tauri/src/commands/prompt_log.rs',
];

/**
 * 检查一行是否是 Tauri 命令定义
 */
function isTauriCommand(lines, index) {
  // 向前查找最多 5 行
  for (let i = Math.max(0, index - 5); i <= index; i++) {
    if (lines[i].includes('#[tauri::command]')) {
      return true;
    }
  }
  return false;
}

/**
 * 分析并建议在哪些位置添加 wrap_err!
 */
function analyzeFile(filePath) {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  文件不存在: ${filePath}`);
    return { suggestions: [], stats: { total: 0, commands: 0 } };
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');
  
  const suggestions = [];
  let inCommand = false;
  let commandStart = -1;
  let bracketDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 检测命令开始
    if (line.includes('#[tauri::command]')) {
      inCommand = true;
      commandStart = i;
      bracketDepth = 0;
      continue;
    }

    if (inCommand) {
      // 统计花括号深度
      bracketDepth += (line.match(/{/g) || []).length;
      bracketDepth -= (line.match(/}/g) || []).length;

      // 查找需要包裹的位置
      // 1. 直接返回的 Result
      if (line.match(/^\s+\w+.*\.await\s*$/)) {
        const nextLine = lines[i + 1];
        if (nextLine && nextLine.match(/^\s+\.map_err\(\|e\|\s*e\.to_string\(\)\)/)) {
          suggestions.push({
            lineNum: i + 1,
            type: 'await_chain',
            context: `${line.trim()}\n${nextLine.trim()}`,
            suggestion: '使用 wrap_err!(..., async)',
          });
        }
      }

      // 2. 函数调用后直接 ?
      if (line.match(/\)\?;?\s*$/)) {
        const prevLine = lines[i - 1];
        if (prevLine && prevLine.match(/^\s+\w+.*\(/)) {
          // 检查是否已经有 wrap_err!
          if (!line.includes('wrap_err!') && !prevLine.includes('wrap_err!')) {
            suggestions.push({
              lineNum: i + 1,
              type: 'function_call',
              context: `${prevLine.trim()}\n${line.trim()}`,
              suggestion: '考虑使用 wrap_err!',
            });
          }
        }
      }

      // 命令结束
      if (bracketDepth === 0 && line.includes('}')) {
        inCommand = false;
      }
    }
  }

  const stats = {
    total: suggestions.length,
    commands: content.match(/#\[tauri::command\]/g)?.length || 0,
  };

  return { suggestions, stats };
}

let totalSuggestions = 0;
let totalCommands = 0;

console.log(isDryRun ? '🔍 DRY RUN MODE - 分析模式\n' : '✅ EXECUTION MODE\n');
console.log('📋 分析策略：');
console.log('   ✓ 只标记 Tauri 命令入口的错误处理');
console.log('   ✓ 内部函数保持 .map_err(|e| e.to_string())');
console.log('   ✓ 参考 clash-verge-rev 的轻量级模式\n');
console.log('='.repeat(70) + '\n');

targetFiles.forEach(filePath => {
  const { suggestions, stats } = analyzeFile(filePath);
  
  if (suggestions.length > 0) {
    console.log(`📄 ${filePath}`);
    console.log(`   命令数: ${stats.commands} | 建议优化: ${suggestions.length}\n`);
    
    suggestions.slice(0, 5).forEach((sug, idx) => {
      console.log(`   [${idx + 1}] 行 ${sug.lineNum} - ${sug.type}`);
      console.log(`       ${sug.suggestion}`);
      console.log(`       上下文:`);
      sug.context.split('\n').forEach(line => {
        console.log(`         ${line}`);
      });
      console.log('');
    });

    if (suggestions.length > 5) {
      console.log(`   ... 还有 ${suggestions.length - 5} 处建议\n`);
    }
  }

  totalSuggestions += suggestions.length;
  totalCommands += stats.commands;
});

console.log('='.repeat(70));
console.log(`\n📊 统计:`);
console.log(`   扫描文件: ${targetFiles.length}`);
console.log(`   Tauri 命令: ${totalCommands}`);
console.log(`   建议优化点: ${totalSuggestions}`);

console.log('\n💡 下一步：');
console.log('   1. 检查建议的优化点是否合理');
console.log('   2. 手动在命令入口添加 wrap_err!');
console.log('   3. 确保导入了 wrap_err 宏: use crate::wrap_err;');
console.log('   4. 运行 cargo check 验证');

console.log('\n📖 参考模式 (clash-verge-rev):');
console.log('   ✅ wrap_err!(some_function().await)');
console.log('   ✅ let x = wrap_err!(get_something())?;');
console.log('   ❌ 不要在内部函数使用 wrap_err!');

console.log('\n' + '='.repeat(70));
