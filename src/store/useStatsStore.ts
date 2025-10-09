/**
 * 统计状态管理（持久化）
 * 
 * 管理累计统计数据，应用关闭后保留
 * 使用 TauriStore 替代 localStorage
 */

import { create } from 'zustand';
import { TranslationStats } from '../types/tauri';
import { tauriStore } from './tauriStore';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('useStatsStore');

interface StatsState {
  // 累计统计
  cumulativeStats: TranslationStats;
  
  // Actions
  updateCumulativeStats: (stats: TranslationStats) => void;
  setCumulativeStats: (stats: TranslationStats) => void; // 直接设置（用于 StatsEngine）
  resetCumulativeStats: () => void;
}

const initialStats: TranslationStats = {
  total: 0,
  tm_hits: 0,
  deduplicated: 0,
  ai_translated: 0,
  token_stats: {
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    cost: 0
  },
  tm_learned: 0
};

export const useStatsStore = create<StatsState>()((set, get) => ({
  // 初始状态
  cumulativeStats: initialStats,
  
  // Actions (持久化到 TauriStore)
  updateCumulativeStats: (stats) => {
    const { cumulativeStats } = get();
    // 防御：确保所有字段有默认值，避免 NaN
    const delta = {
      total: stats.total ?? 0,
      tm_hits: stats.tm_hits ?? 0,
      deduplicated: stats.deduplicated ?? 0,
      ai_translated: stats.ai_translated ?? 0,
      token_stats: {
        input_tokens: stats.token_stats?.input_tokens ?? 0,
        output_tokens: stats.token_stats?.output_tokens ?? 0,
        total_tokens: stats.token_stats?.total_tokens ?? 0,
        cost: stats.token_stats?.cost ?? 0,
      },
      tm_learned: stats.tm_learned ?? 0,
    } as TranslationStats;
    log.debug('累计统计 +delta', {
      total: delta.total,
      tm_hits: delta.tm_hits,
      deduplicated: delta.deduplicated,
      ai_translated: delta.ai_translated,
      tokens: delta.token_stats.total_tokens,
      cost: delta.token_stats.cost,
    });
    const newStats = {
      total: cumulativeStats.total + delta.total,
      tm_hits: cumulativeStats.tm_hits + delta.tm_hits,
      deduplicated: cumulativeStats.deduplicated + delta.deduplicated,
      ai_translated: cumulativeStats.ai_translated + delta.ai_translated,
      token_stats: {
        input_tokens: cumulativeStats.token_stats.input_tokens + delta.token_stats.input_tokens,
        output_tokens: cumulativeStats.token_stats.output_tokens + delta.token_stats.output_tokens,
        total_tokens: cumulativeStats.token_stats.total_tokens + delta.token_stats.total_tokens,
        cost: cumulativeStats.token_stats.cost + delta.token_stats.cost,
      },
      tm_learned: cumulativeStats.tm_learned + delta.tm_learned,
    };
    set({ cumulativeStats: newStats });
    log.info('累计统计 => new', {
      total: newStats.total,
      tm_hits: newStats.tm_hits,
      deduplicated: newStats.deduplicated,
      ai_translated: newStats.ai_translated,
      tokens: newStats.token_stats.total_tokens,
      cost: newStats.token_stats.cost,
    });
    
    // 异步保存到 TauriStore（完整字段）
    tauriStore.updateCumulativeStats({
      totalTranslated: newStats.total,
      totalTokens: newStats.token_stats.total_tokens,
      totalCost: newStats.token_stats.cost,
      sessionCount: cumulativeStats.total > 0 ? 1 : 0,
      lastUpdated: Date.now(),
      // 🔧 保存所有统计字段
      tmHits: newStats.tm_hits,
      deduplicated: newStats.deduplicated,
      aiTranslated: newStats.ai_translated,
      tmLearned: newStats.tm_learned,
      inputTokens: newStats.token_stats.input_tokens,
      outputTokens: newStats.token_stats.output_tokens,
    }).catch(err => 
      console.error('[useStatsStore] 保存累计统计失败:', err)
    );
  },
  
  setCumulativeStats: (stats) => {
    set({ cumulativeStats: stats });
    log.info('累计统计 => new', stats);
    // 异步保存到 TauriStore
    tauriStore.updateCumulativeStats({
      totalTranslated: stats.total,
      totalTokens: stats.token_stats.total_tokens,
      totalCost: stats.token_stats.cost,
      sessionCount: stats.total > 0 ? 1 : 0,
      lastUpdated: Date.now(),
    }).catch(err => 
      console.error('[useStatsStore] 保存累计统计失败:', err)
    );
  },
  
  resetCumulativeStats: () => {
    set({ cumulativeStats: initialStats });
    log.warn('累计统计已重置为 0');
    // 异步保存到 TauriStore（完整字段）
    tauriStore.updateCumulativeStats({
      totalTranslated: 0,
      totalTokens: 0,
      totalCost: 0,
      sessionCount: 0,
      lastUpdated: Date.now(),
      // 🔧 重置所有统计字段
      tmHits: 0,
      deduplicated: 0,
      aiTranslated: 0,
      tmLearned: 0,
      inputTokens: 0,
      outputTokens: 0,
    }).catch(err => 
      console.error('[useStatsStore] 重置累计统计失败:', err)
    );
  },
}));

/**
 * 从 TauriStore 加载统计数据
 */
export async function loadStats() {
  try {
    await tauriStore.init();
    
    const stats = await tauriStore.getCumulativeStats();
    
    useStatsStore.setState({
      cumulativeStats: {
        total: stats.totalTranslated,
        tm_hits: stats.tmHits,              // 🔧 从持久化读取
        deduplicated: stats.deduplicated,    // 🔧 从持久化读取
        ai_translated: stats.aiTranslated,   // 🔧 从持久化读取
        token_stats: {
          input_tokens: stats.inputTokens,   // 🔧 从持久化读取
          output_tokens: stats.outputTokens, // 🔧 从持久化读取
          total_tokens: stats.totalTokens,
          cost: stats.totalCost
        },
        tm_learned: stats.tmLearned          // 🔧 从持久化读取
      }
    });
    
    console.log('[useStatsStore] 统计加载成功', stats);
  } catch (error) {
    console.error('[useStatsStore] 加载统计失败:', error);
  }
}

