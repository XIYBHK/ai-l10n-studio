/**
 * 配置同步管理器
 *
 * 架构原则：
 * 1. 后端是配置的唯一权威来源（Single Source of Truth）
 * 2. 前端只读访问配置，不持有敏感数据（如 API Key）
 * 3. 配置变更时触发事件通知
 * 4. 定期验证前后端配置一致性
 */

import { invoke } from '@tauri-apps/api/core';
import { eventDispatcher } from './eventDispatcher';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('ConfigSync');

interface ConfigVersion {
  version: number;
  timestamp: string;
  activeConfigIndex: number | null;
  configCount: number;
}

interface ConfigValidationResult {
  isValid: boolean;
  frontendVersion?: ConfigVersion;
  backendVersion?: ConfigVersion;
  issues: string[];
}

class ConfigSyncManager {
  private currentVersion: ConfigVersion | null = null;
  private validationInterval: number | null = null;
  private unsubscribeConfigChanges: (() => void) | null = null;
  private readonly VALIDATION_INTERVAL_MS = 5000; // 5秒验证一次

  /**
   * 初始化配置同步
   */
  async initialize(): Promise<void> {
    log.info('🔄 初始化配置同步管理器');

    try {
      // 1. 从后端获取初始配置版本
      await this.syncFromBackend();

      // 2. 启动定期验证
      this.startValidation();

      // 3. 监听配置变更事件
      this.subscribeToConfigChanges();

      log.info('✅ 配置同步管理器初始化成功');
    } catch (error) {
      log.error('❌ 配置同步管理器初始化失败', { error });
      throw error;
    }
  }

  /**
   * 从后端同步配置版本信息
   */
  async syncFromBackend(): Promise<void> {
    try {
      const version = await invoke<ConfigVersion>('get_config_version');
      this.currentVersion = version;
      log.debug('📥 配置版本已同步', version);

      // 触发配置同步事件
      eventDispatcher.emit('config:synced', version);
    } catch (error) {
      log.error('配置同步失败', { error });
      throw error;
    }
  }

  /**
   * 验证前后端配置一致性
   */
  async validate(): Promise<ConfigValidationResult> {
    const issues: string[] = [];

    try {
      const backendVersion = await invoke<ConfigVersion>('get_config_version');

      if (!this.currentVersion) {
        issues.push('前端配置未初始化');
        return {
          isValid: false,
          backendVersion,
          issues,
        };
      }

      // 检查版本号
      if (this.currentVersion.version !== backendVersion.version) {
        issues.push(
          `配置版本不一致: 前端=${this.currentVersion.version}, 后端=${backendVersion.version}`
        );
      }

      // 检查配置数量
      if (this.currentVersion.configCount !== backendVersion.configCount) {
        issues.push(
          `配置数量不一致: 前端=${this.currentVersion.configCount}, 后端=${backendVersion.configCount}`
        );
      }

      // 检查启用配置索引
      if (this.currentVersion.activeConfigIndex !== backendVersion.activeConfigIndex) {
        issues.push(
          `启用配置不一致: 前端=${this.currentVersion.activeConfigIndex}, 后端=${backendVersion.activeConfigIndex}`
        );
      }

      const isValid = issues.length === 0;

      if (!isValid) {
        log.warn('⚠️ 配置验证失败', { issues });
        // 自动同步
        this.currentVersion = backendVersion;
        eventDispatcher.emit('config:out-of-sync', { issues, backendVersion });
      }

      return {
        isValid,
        frontendVersion: this.currentVersion,
        backendVersion,
        issues,
      };
    } catch (error) {
      issues.push(`验证失败: ${error}`);
      return {
        isValid: false,
        issues,
      };
    }
  }

  /**
   * 启动定期验证
   */
  private startValidation(): void {
    if (this.validationInterval) {
      return; // 已经在运行
    }

    this.validationInterval = window.setInterval(async () => {
      await this.validate();
    }, this.VALIDATION_INTERVAL_MS);

    log.debug('⏰ 配置验证定时器已启动', {
      intervalMs: this.VALIDATION_INTERVAL_MS,
    });
  }

  /**
   * 停止定期验证
   */
  stopValidation(): void {
    if (this.validationInterval) {
      window.clearInterval(this.validationInterval);
      this.validationInterval = null;
      log.debug('⏰ 配置验证定时器已停止');
    }
  }

  /**
   * 订阅配置变更事件
   */
  private subscribeToConfigChanges(): void {
    // 当配置被修改时，立即同步
    this.unsubscribeConfigChanges = eventDispatcher.on('config:updated', async () => {
      log.info('🔄 检测到配置变更，正在同步...');
      await this.syncFromBackend();
    });
  }

  /**
   * 获取当前配置版本
   */
  getCurrentVersion(): ConfigVersion | null {
    return this.currentVersion;
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.stopValidation();
    if (this.unsubscribeConfigChanges) {
      this.unsubscribeConfigChanges();
      this.unsubscribeConfigChanges = null;
    }
    log.info('🧹 配置同步管理器已清理');
  }
}

// 单例实例
export { ConfigSyncManager };
export const configSyncManager = new ConfigSyncManager();
