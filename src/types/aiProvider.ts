/**
 * AI 供应商相关类型
 */

// 导出自动生成的类型
export type { ProxyConfig } from './generated/ProxyConfig';
export type { AIConfig } from './generated/AIConfig';

/**
 * AI 连接测试结果
 */
export interface TestConnectionResult {
  success: boolean;
  message: string;
  response_time_ms?: number;
}
