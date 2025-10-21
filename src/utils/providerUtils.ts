/**
 * 供应商相关工具函数
 *
 * 提供 providerId 到显示名称的映射等实用工具
 */

import type { ProviderInfo } from '../types/generated/ProviderInfo';

/**
 * 从供应商列表中获取供应商的显示名称
 *
 * @param providerId 供应商ID（如 "openai", "deepseek", "moonshot"）
 * @param providers 供应商信息列表
 * @returns 供应商显示名称，如果未找到则返回 providerId
 *
 * @example
 * ```typescript
 * const providers = await aiProviderCommands.getAll();
 * const displayName = getProviderDisplayName('openai', providers);
 * // 返回 "OpenAI"
 * ```
 */
export function getProviderDisplayName(providerId: string, providers: ProviderInfo[]): string {
  const provider = providers.find((p) => p.id === providerId);
  return provider?.display_name || providerId;
}

/**
 * 从供应商列表中获取供应商的默认URL
 *
 * @param providerId 供应商ID
 * @param providers 供应商信息列表
 * @returns 供应商默认URL，如果未找到则返回 undefined
 */
export function getProviderDefaultUrl(
  providerId: string,
  providers: ProviderInfo[]
): string | undefined {
  const provider = providers.find((p) => p.id === providerId);
  return provider?.default_url;
}

/**
 * 从供应商列表中获取供应商的默认模型
 *
 * @param providerId 供应商ID
 * @param providers 供应商信息列表
 * @returns 供应商默认模型，如果未找到则返回 undefined
 */
export function getProviderDefaultModel(
  providerId: string,
  providers: ProviderInfo[]
): string | undefined {
  const provider = providers.find((p) => p.id === providerId);
  return provider?.default_model;
}

/**
 * 从供应商列表中获取完整的供应商信息
 *
 * @param providerId 供应商ID
 * @param providers 供应商信息列表
 * @returns 供应商信息，如果未找到则返回 null
 */
export function getProviderInfo(
  providerId: string,
  providers: ProviderInfo[]
): ProviderInfo | null {
  return providers.find((p) => p.id === providerId) || null;
}
