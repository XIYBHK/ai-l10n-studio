import { useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { POEntry, TranslationStats } from '../types/tauri';

interface BatchResult {
  translations: string[];
  stats: TranslationStats;
}

export const useTranslator = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsePOFile = async (filePath: string): Promise<POEntry[]> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const entries = await invoke<POEntry[]>('parse_po_file', { filePath });
      return entries;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const translateEntry = async (text: string, apiKey: string): Promise<string> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const translation = await invoke<string>('translate_entry', { text, apiKey });
      return translation;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const translateBatch = async (
    texts: string[], 
    apiKey: string,
    onProgress?: (index: number, translation: string) => void
  ): Promise<string[]> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const batchSize = 5; // 限制并发数，避免过多请求
      const translations: string[] = [];
      
      // 批量并行翻译
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(text => invoke<string>('translate_entry', { text, apiKey }))
        );
        
        // 处理结果和进度回调
        batchResults.forEach((translation, batchIndex) => {
          const globalIndex = i + batchIndex;
          translations.push(translation);
          
          // 调用进度回调
          if (onProgress) {
            onProgress(globalIndex, translation);
          }
        });
      }
      
      return translations;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const translateBatchWithStats = async (
    texts: string[],
    apiKey: string
  ): Promise<BatchResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await invoke<BatchResult>('translate_batch_with_stats', { texts, apiKey });
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const getTranslationMemory = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const memory = await invoke('get_translation_memory');
      return memory;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    error,
    parsePOFile,
    translateEntry,
    translateBatch,
    translateBatchWithStats,
    getTranslationMemory,
  };
};
