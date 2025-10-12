/**
 * 统计引擎 - 基于事件溯源的健壮统计系统
 *
 * 设计原则：
 * 1. 单一数据源：所有统计来自后端事件，前端只负责聚合和展示
 * 2. 事件溯源：记录所有统计事件，可追溯、可审计
 * 3. 幂等性：同一事件多次处理结果一致，防止重复计数
 * 4. 类型安全：完整的 TypeScript 类型定义
 * 5. 格式化集成：与 StatsFormatter 整合，提供 ready-to-display 数据
 */

import { TranslationStats } from '../types/tauri';
import { createModuleLogger } from '../utils/logger';
import { StatsFormatter, FormattedStatsSummary } from './statsFormatter';

const log = createModuleLogger('StatsEngine');

// ==================== 事件定义 ====================

/** 统计事件类型 */
export enum StatsEventType {
  /** 批量翻译增量统计（Channel API） */
  BATCH_PROGRESS = 'batch_progress',
  /** 任务完成统计（所有翻译） */
  TASK_COMPLETE = 'task_complete',
}

/** 统计事件元数据 */
export interface StatsEventMeta {
  /** 事件ID（用于去重） */
  eventId: string;
  /** 事件类型 */
  type: StatsEventType;
  /** 翻译方式 */
  translationMode: 'channel' | 'event' | 'single' | 'refine';
  /** 时间戳 */
  timestamp: number;
  /** 任务ID（同一任务的事件共享任务ID） */
  taskId?: string;
}

/** 统计事件 */
export interface StatsEvent {
  meta: StatsEventMeta;
  data: TranslationStats;
}

// ==================== 事件存储 ====================

/** 事件存储 */
class EventStore {
  private events: StatsEvent[] = [];
  private processedEventIds = new Set<string>();

  /** 添加事件（自动去重） */
  add(event: StatsEvent): boolean {
    if (this.processedEventIds.has(event.meta.eventId)) {
      log.warn('⚠️ 检测到重复事件，已忽略', { eventId: event.meta.eventId });
      return false;
    }

    this.events.push(event);
    this.processedEventIds.add(event.meta.eventId);
    log.debug('📝 事件已记录', {
      eventId: event.meta.eventId,
      type: event.meta.type,
    });
    return true;
  }

  /** 获取所有事件 */
  getAll(): StatsEvent[] {
    return [...this.events];
  }

  /** 按任务ID获取事件 */
  getByTaskId(taskId: string): StatsEvent[] {
    return this.events.filter((e) => e.meta.taskId === taskId);
  }

  /** 清空事件（用于会话重置） */
  clear() {
    this.events = [];
    this.processedEventIds.clear();
    log.info('🧹 事件存储已清空');
  }

  /** 获取事件数量 */
  size(): number {
    return this.events.length;
  }
}

// ==================== 统计聚合器 ====================

/** 统计聚合器 */
class StatsAggregator {
  /** 聚合事件列表为统计数据 */
  aggregate(events: StatsEvent[]): TranslationStats {
    const result: TranslationStats = {
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
    };

    for (const event of events) {
      // 根据事件类型决定聚合策略
      if (event.meta.type === StatsEventType.BATCH_PROGRESS) {
        // 批量进度：只累加增量字段（tm_hits, ai_translated, deduplicated, tokens）
        result.tm_hits += event.data.tm_hits ?? 0;
        result.deduplicated += event.data.deduplicated ?? 0;
        result.ai_translated += event.data.ai_translated ?? 0;
        result.tm_learned += event.data.tm_learned ?? 0;
        result.token_stats.input_tokens += event.data.token_stats?.input_tokens ?? 0;
        result.token_stats.output_tokens += event.data.token_stats?.output_tokens ?? 0;
        result.token_stats.total_tokens += event.data.token_stats?.total_tokens ?? 0;
        result.token_stats.cost += event.data.token_stats?.cost ?? 0;
      } else if (event.meta.type === StatsEventType.TASK_COMPLETE) {
        // 任务完成：累加所有字段
        result.total += event.data.total ?? 0;
        result.tm_hits += event.data.tm_hits ?? 0;
        result.deduplicated += event.data.deduplicated ?? 0;
        result.ai_translated += event.data.ai_translated ?? 0;
        result.tm_learned += event.data.tm_learned ?? 0;
        result.token_stats.input_tokens += event.data.token_stats?.input_tokens ?? 0;
        result.token_stats.output_tokens += event.data.token_stats?.output_tokens ?? 0;
        result.token_stats.total_tokens += event.data.token_stats?.total_tokens ?? 0;
        result.token_stats.cost += event.data.token_stats?.cost ?? 0;
      }
    }

    return result;
  }
}

// ==================== 统计引擎 ====================

/** 统计引擎 */
export class StatsEngine {
  private sessionStore = new EventStore();
  private aggregator = new StatsAggregator();

  /** 处理统计事件（仅用于会话统计，累计统计由 Store 持久化管理） */
  processEvent(event: StatsEvent, scope: 'session' = 'session') {
    const processed = this.sessionStore.add(event);

    if (processed) {
      log.info('✅ 统计事件已处理', {
        eventId: event.meta.eventId,
        type: event.meta.type,
        scope,
      });
    }
  }

  /** 获取会话统计（原始数据） */
  getSessionStats(): TranslationStats {
    return this.aggregator.aggregate(this.sessionStore.getAll());
  }

  /** 获取会话统计（格式化后，ready-to-display） */
  getFormattedSessionStats(locale?: string): FormattedStatsSummary {
    const rawStats = this.getSessionStats();
    return StatsFormatter.formatSummary(rawStats, locale);
  }

  /** 重置会话统计 */
  resetSession() {
    this.sessionStore.clear();
    log.info('🔄 会话统计已重置');
  }

  /** 获取调试信息 */
  getDebugInfo() {
    const sessionStats = this.getSessionStats();
    return {
      sessionEvents: this.sessionStore.size(),
      sessionStats,
      formatted: StatsFormatter.formatDebugInfo(sessionStats),
      eventHistory: this.sessionStore.getAll().map((e) => ({
        eventId: e.meta.eventId,
        type: e.meta.type,
        timestamp: new Date(e.meta.timestamp).toISOString(),
        taskId: e.meta.taskId,
        data: e.data,
      })),
    };
  }
}

// ==================== 全局单例 ====================

export const statsEngine = new StatsEngine();

// 在开发环境下暴露到 window 以便调试
if (import.meta.env.DEV) {
  (window as any).__statsEngine = statsEngine;
}
