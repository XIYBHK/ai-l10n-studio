/**
 * AI 供应商配置类型
 *
 * 参考 clash-verge-rev 最佳实践：
 * - 前后端类型统一（通过 serde camelCase 自动转换）
 * - 零转换成本，直接 JSON 序列化/反序列化
 * - 使用 ts-rs 生成类型，避免手动同步
 */

// 🔧 导入 ts-rs 生成的类型（与后端 Rust 类型自动同步）
import type { ProxyConfig } from './generated/ProxyConfig';

/**
 * 代理配置
 * 🔧 使用 ts-rs 生成的类型（与后端 Rust 类型自动同步）
 * @see ./generated/ProxyConfig.ts
 */
export type { ProxyConfig };

/**
 * AI 配置
 * 🔧 与后端 Rust AIConfig 完全一致（通过 serde camelCase 自动转换）
 *
 * 参考 clash-verge-rev 最佳实践：前后端类型统一，零转换成本
 */
export interface AIConfig {
  /** 供应商ID（如 "openai", "deepseek", "moonshot"） */
  providerId: string;
  apiKey: string;
  baseUrl?: string; // 可选的自定义URL
  model?: string; // 可选的自定义模型
  proxy?: ProxyConfig;
}

/**
 * AI 连接测试结果
 */
export interface TestConnectionResult {
  success: boolean;
  message: string;
  response_time_ms?: number;
}
