import { mutate } from 'swr';
import { eventDispatcher } from './eventDispatcher';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('SWREvents');

// 将后端事件映射到 SWR key 的轻量 revalidate 机制

export function initializeSWRRevalidators() {
  log.info('🚀 初始化 SWR 事件监听器...');

  // 文件保存后：刷新文件元数据
  eventDispatcher.on('file:saved', ({ path }) => {
    if (path) {
      log.debug('收到 file:saved 事件，刷新文件元数据/格式', { path });
      mutate(['get_file_metadata', { filePath: path }]);
      mutate(['detect_file_format', { filePath: path }]);
    }
  });

  // 术语库更新：刷新术语库镜像
  eventDispatcher.on('term:updated', () => {
    log.debug('收到 term:updated 事件，刷新术语库');
    mutate(['get_term_library']);
  });

  // 翻译生命周期：可按需扩展刷新统计/日志
  eventDispatcher.on('translation:after', () => {
    log.debug('收到 translation:after 事件，刷新翻译记忆库和日志');
    mutate(['get_translation_memory']);
    mutate(['get_app_logs']);
    mutate(['get_prompt_logs']);
  });

  // 配置更新：刷新 AI 配置和应用配置
  eventDispatcher.on('config:updated', () => {
    log.debug('收到 config:updated 事件，刷新 AI 配置和应用配置');
    mutate('ai_configs');
    mutate('active_ai_config');
    mutate('app_config');
  });

  log.info('✅ SWR 事件监听器初始化完成');
}


