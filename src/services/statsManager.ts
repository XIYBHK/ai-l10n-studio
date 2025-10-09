import { eventDispatcher } from './eventDispatcher';
import { createModuleLogger } from '../utils/logger';
import { normalizeStats } from '../utils/statsAggregator';
import { useSessionStore } from '../store';
import { useStatsStore } from '../store';

const log = createModuleLogger('StatsManager');
let initialized = false;

export function initializeStatsManager() {
  if (initialized) {
    log.debug('已初始化，跳过');
    return;
  }
  initialized = true;

  log.info('🚀 初始化 StatsManager（统一统计聚合）');

  // 1) 批次统计：逐批累加到会话统计（UI 实时刷新）
  const onBatchStats = (raw: any) => {
    // 仅累计“增量”，total 固定 0，避免命中/AI累计与 after 的总量不一致
    const stats = normalizeStats(raw);
    stats.total = 0;
    log.info('🧮 批次统计（归一化，增量）', stats);
    useSessionStore.getState().updateSessionStats(stats);
  };
  eventDispatcher.on('translation:stats', onBatchStats);
  // 兼容桥接事件名
  eventDispatcher.on('translation-stats-update', onBatchStats as any);

  // 2) 完成统计：仅在完成时累加到累计统计（持久化）
  eventDispatcher.on('translation:after', (payload: any) => {
    const raw = payload?.stats;
    if (!raw) {
      log.warn('translation:after 无 stats');
      return;
    }
    const stats = normalizeStats(raw);
    log.info('📦 任务完成（归一化）', stats);
    useStatsStore.getState().updateCumulativeStats(stats);
  });

  log.info('✅ StatsManager 初始化完成');
}


