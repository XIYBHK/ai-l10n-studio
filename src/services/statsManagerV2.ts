/**
 * 统计管理器 V2 - 使用 StatsEngine 的健壮实现
 *
 * 职责：
 * 1. 监听后端事件并转换为 StatsEvent
 * 2. 调用 StatsEngine 处理事件
 * 3. 更新 Zustand Store
 */

import { eventDispatcher } from './eventDispatcher';
import { statsEngine, StatsEvent, StatsEventType } from './statsEngine';
import { useSessionStore, useStatsStore } from '../store';
import { createModuleLogger } from '../utils/logger';
import { nanoid } from 'nanoid';

const log = createModuleLogger('StatsManagerV2');

let initialized = false;
let currentTaskId: string | null = null;

export function initializeStatsManagerV2() {
  if (initialized) {
    log.debug('已初始化，跳过');
    return;
  }
  initialized = true;

  log.info('🚀 初始化 StatsManager V2（基于事件溯源）');

  // ========== 监听翻译开始事件 ==========
  eventDispatcher.on('translation:before', () => {
    // 为每个翻译任务生成唯一ID
    currentTaskId = nanoid();
    log.info('🎯 新翻译任务开始', { taskId: currentTaskId });
  });

  // ========== 监听批量进度事件（Channel API） ==========
  eventDispatcher.on('translation-stats-update', (rawData: any) => {
    if (!currentTaskId) {
      log.warn('⚠️ 收到批量进度统计但无当前任务ID，可能是旧事件');
      currentTaskId = nanoid(); // 兼容性：创建一个临时任务ID
    }

    const event: StatsEvent = {
      meta: {
        eventId: `${currentTaskId}-progress-${nanoid(6)}`,
        type: StatsEventType.BATCH_PROGRESS,
        translationMode: 'channel',
        timestamp: Date.now(),
        taskId: currentTaskId,
      },
      data: normalizeStats(rawData),
    };

    // 批量进度只更新会话统计（实时UI反馈）
    statsEngine.processEvent(event, 'session');

    // 更新 Store
    const sessionStats = statsEngine.getSessionStats();
    useSessionStore.getState().setSessionStats(sessionStats);

    log.debug('📊 批量进度统计已处理', {
      eventId: event.meta.eventId,
      stats: event.data,
    });
  });

  // ========== 监听任务完成事件（所有翻译） ==========
  eventDispatcher.on('translation:after', (payload: any) => {
    const rawStats = payload?.stats;
    if (!rawStats) {
      log.warn('⚠️ translation:after 无 stats 数据');
      return;
    }

    if (!currentTaskId) {
      log.warn('⚠️ 收到任务完成统计但无当前任务ID');
      currentTaskId = nanoid(); // 兼容性：创建一个临时任务ID
    }

    const event: StatsEvent = {
      meta: {
        eventId: `${currentTaskId}-complete`,
        type: StatsEventType.TASK_COMPLETE,
        translationMode: detectTranslationMode(rawStats),
        timestamp: Date.now(),
        taskId: currentTaskId,
      },
      data: normalizeStats(rawStats),
    };

    // 🔧 任务完成：只更新累计统计，不更新会话统计（会话统计已由批量进度事件累加）
    // 注意：translation:after 发送的是全量统计，不是增量，所以不能再累加到会话统计

    // 更新 Store
    const sessionStats = statsEngine.getSessionStats();

    useSessionStore.getState().setSessionStats(sessionStats);
    // 🔧 累计统计使用 Store 的累加方法
    useStatsStore.getState().updateCumulativeStats(event.data);

    log.info('✅ 任务完成统计已处理', {
      eventId: event.meta.eventId,
      stats: event.data,
      sessionStats,
    });

    // 任务完成，清空任务ID
    currentTaskId = null;
  });

  log.info('✅ StatsManager V2 初始化完成');
}

/** 归一化统计数据 */
function normalizeStats(input: any): any {
  const token = input?.token_stats || input?.tokens || {};
  const prompt = token.prompt_tokens ?? token.input_tokens ?? 0;
  const completion = token.completion_tokens ?? token.output_tokens ?? 0;
  const totalTokens = token.total_tokens ?? prompt + completion;
  const cost = token.cost ?? 0;

  return {
    total: input?.total ?? 0,
    tm_hits: input?.tm_hits ?? 0,
    deduplicated: input?.deduplicated ?? 0,
    ai_translated: input?.ai_translated ?? 0,
    tm_learned: input?.tm_learned ?? 0,
    token_stats: {
      input_tokens: prompt ?? 0,
      output_tokens: completion ?? 0,
      total_tokens: totalTokens ?? 0,
      cost: cost ?? 0,
    },
  };
}

/** 检测翻译模式 */
function detectTranslationMode(stats: any): 'channel' | 'event' | 'single' | 'refine' {
  const total = stats?.total ?? 0;

  if (total === 1) {
    return 'single';
  } else if (total > 1 && total <= 20) {
    return 'event';
  } else {
    return 'channel';
  }
}

/** 重置会话统计 */
export function resetSessionStats() {
  statsEngine.resetSession();
  useSessionStore.getState().setSessionStats({
    total: 0,
    tm_hits: 0,
    deduplicated: 0,
    ai_translated: 0,
    tm_learned: 0,
    token_stats: {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      cost: 0,
    },
  });
  log.info('🔄 会话统计已重置');
}

/** 重置累计统计 */
export function resetCumulativeStats() {
  // 累计统计由 Store 持久化管理，直接重置 Store
  useStatsStore.getState().resetCumulativeStats();
  log.info('🔄 累计统计已重置');
}

/** 获取调试信息 */
export function getStatsDebugInfo() {
  return statsEngine.getDebugInfo();
}
