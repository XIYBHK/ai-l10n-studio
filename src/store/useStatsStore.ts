/**
 * 统计状态管理（持久化）
 *
 * 管理累计统计数据，应用关闭后保留
 * 使用 TauriStore 替代 localStorage
 *
 * 注意：累计统计主要由 useAppStore 管理，此 Store 仅用于特殊场景
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { TranslationStats } from '../types/tauri';
import { tauriStore } from './tauriStore';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('useStatsStore');

const INITIAL_STATS: TranslationStats = {
  total: 0,
  tm_hits: 0,
  deduplicated: 0,
  ai_translated: 0,
  token_stats: {
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    cost: 0,
  },
  tm_learned: 0,
};

interface StatsState {
  // 累计统计
  cumulativeStats: TranslationStats;

  // Actions
  setCumulativeStats: (stats: TranslationStats) => void;
  resetCumulativeStats: () => void;
}

export const useStatsStore = create<StatsState>()(
  devtools(
    (set) => ({
      // 初始状态
      cumulativeStats: INITIAL_STATS,

      // Actions
      setCumulativeStats: (stats) => {
        set({ cumulativeStats: stats });
        log.info('累计统计已更新', stats);

        tauriStore
          .updateCumulativeStats({
            totalTranslated: stats.total,
            totalTokens: stats.token_stats.total_tokens,
            totalCost: stats.token_stats.cost,
            sessionCount: stats.total > 0 ? 1 : 0,
            lastUpdated: Date.now(),
            tmHits: stats.tm_hits,
            deduplicated: stats.deduplicated,
            aiTranslated: stats.ai_translated,
            tmLearned: stats.tm_learned,
            inputTokens: stats.token_stats.input_tokens,
            outputTokens: stats.token_stats.output_tokens,
          })
          .catch((err) => log.error('保存累计统计失败', err));
      },

      resetCumulativeStats: () => {
        set({ cumulativeStats: INITIAL_STATS });
        log.warn('累计统计已重置');

        tauriStore
          .updateCumulativeStats({
            totalTranslated: 0,
            totalTokens: 0,
            totalCost: 0,
            sessionCount: 0,
            lastUpdated: Date.now(),
            tmHits: 0,
            deduplicated: 0,
            aiTranslated: 0,
            tmLearned: 0,
            inputTokens: 0,
            outputTokens: 0,
          })
          .catch((err) => log.error('重置累计统计失败', err));
      },
    }),
    { name: 'StatsStore' }
  )
);

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
        tm_hits: stats.tmHits,
        deduplicated: stats.deduplicated,
        ai_translated: stats.aiTranslated,
        token_stats: {
          input_tokens: stats.inputTokens,
          output_tokens: stats.outputTokens,
          total_tokens: stats.totalTokens,
          cost: stats.totalCost,
        },
        tm_learned: stats.tmLearned,
      },
    });

    log.info('统计加载成功', stats);
  } catch (error) {
    log.error('加载统计失败', error);
  }
}
