/**
 * 统计状态管理（持久化）
 * 
 * 管理累计统计数据，应用关闭后保留
 * 使用 TauriStore 替代 localStorage
 */

import { create } from 'zustand';
import { TranslationStats } from '../types/tauri';
import { tauriStore } from './tauriStore';

interface StatsState {
  // 累计统计
  cumulativeStats: TranslationStats;
  
  // Actions
  updateCumulativeStats: (stats: TranslationStats) => void;
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
    const newStats = {
      total: cumulativeStats.total + stats.total,
      tm_hits: cumulativeStats.tm_hits + stats.tm_hits,
      deduplicated: cumulativeStats.deduplicated + stats.deduplicated,
      ai_translated: cumulativeStats.ai_translated + stats.ai_translated,
      token_stats: {
        input_tokens: cumulativeStats.token_stats.input_tokens + stats.token_stats.input_tokens,
        output_tokens: cumulativeStats.token_stats.output_tokens + stats.token_stats.output_tokens,
        total_tokens: cumulativeStats.token_stats.total_tokens + stats.token_stats.total_tokens,
        cost: cumulativeStats.token_stats.cost + stats.token_stats.cost,
      },
      tm_learned: cumulativeStats.tm_learned + stats.tm_learned,
    };
    set({ cumulativeStats: newStats });
    
    // 异步保存到 TauriStore
    tauriStore.updateCumulativeStats({
      totalTranslated: newStats.total,
      totalTokens: newStats.token_stats.total_tokens,
      totalCost: newStats.token_stats.cost,
      sessionCount: cumulativeStats.total > 0 ? 1 : 0,
      lastUpdated: Date.now(),
    }).catch(err => 
      console.error('[useStatsStore] 保存累计统计失败:', err)
    );
  },
  
  resetCumulativeStats: () => {
    set({ cumulativeStats: initialStats });
    // 异步保存到 TauriStore
    tauriStore.updateCumulativeStats({
      totalTranslated: 0,
      totalTokens: 0,
      totalCost: 0,
      sessionCount: 0,
      lastUpdated: Date.now(),
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
        tm_hits: 0,
        deduplicated: 0,
        ai_translated: 0,
        token_stats: {
          input_tokens: 0,
          output_tokens: 0,
          total_tokens: stats.totalTokens,
          cost: stats.totalCost
        },
        tm_learned: 0
      }
    });
    
    console.log('[useStatsStore] 统计加载成功', stats);
  } catch (error) {
    console.error('[useStatsStore] 加载统计失败:', error);
  }
}

