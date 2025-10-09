/**
 * 翻译相关的 React Hook
 * 使用统一的 API 层和 useAsync Hook
 */

import { poFileApi, translatorApi, translationMemoryApi } from '../services/api';
import { useAsync } from './useAsync';

/**
 * 翻译 Hook
 * 
 * @deprecated 建议直接使用 useAsync + API 函数的方式，更灵活
 * 
 * @example
 * ```tsx
 * // 旧方式（保留向后兼容）
 * const { translateEntry, isLoading } = useTranslator();
 * 
 * // 新方式（推荐）
 * const { execute: translateEntry, loading } = useAsync(translatorApi.translateEntry);
 * ```
 */
export const useTranslator = () => {
  const parsePOFile = useAsync(poFileApi.parse);
  const translateEntry = useAsync(translatorApi.translateEntry);
  const translateBatch = useAsync(translatorApi.translateBatch);
  const getTranslationMemory = useAsync(translationMemoryApi.get);

  return {
    // 向后兼容的接口
    isLoading: 
      parsePOFile.loading || 
      translateEntry.loading || 
      translateBatch.loading || 
      getTranslationMemory.loading,
    
    error: 
      parsePOFile.error?.message || 
      translateEntry.error?.message || 
      translateBatch.error?.message || 
      getTranslationMemory.error?.message || 
      null,
    
    // API 方法
    parsePOFile: parsePOFile.execute,
    translateEntry: translateEntry.execute,
    translateBatch: translateBatch.execute,
    getTranslationMemory: getTranslationMemory.execute,
  };
};
