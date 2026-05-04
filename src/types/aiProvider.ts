/**
 * AI 供应商相关类型
 */

// 导出自动生成的类型
export type { ProxyConfig } from './generated/ProxyConfig';
export type { AIConfig } from './generated/AIConfig';
import type { ProxyConfig } from './generated/ProxyConfig';

export interface AIConfigSummary {
  index: number;
  providerId: string;
  apiKeyPreview: string | null;
  hasApiKey: boolean;
  baseUrl: string | null;
  model: string | null;
  proxy: ProxyConfig | null;
  isActive: boolean;
}

/**
 * AI 连接测试结果
 */
export interface TestConnectionResult {
  success: boolean;
  message: string;
  response_time_ms?: number;
}
