import { describe, it, expect, beforeEach } from 'vitest';
import { createModuleLogger } from '@/utils/logger';

describe('Logger Utils', () => {
  let logger: ReturnType<typeof createModuleLogger>;

  beforeEach(() => {
    logger = createModuleLogger('TestModule');
  });

  describe('createModuleLogger', () => {
    it('应该创建带模块名称的 logger', () => {
      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.debug).toBeDefined();
    });

    it('应该记录 info 日志', () => {
      // 这里主要测试函数不会抛出错误
      expect(() => logger.info('测试信息')).not.toThrow();
      expect(() => logger.info('测试信息', { data: 'test' })).not.toThrow();
    });

    it('应该记录 warn 日志', () => {
      expect(() => logger.warn('警告信息')).not.toThrow();
      expect(() => logger.warn('警告信息', { reason: 'test' })).not.toThrow();
    });

    it('应该记录 error 日志', () => {
      expect(() => logger.error('错误信息')).not.toThrow();
      expect(() => logger.error('错误信息', new Error('测试错误'))).not.toThrow();
    });

    it('应该记录 debug 日志', () => {
      expect(() => logger.debug('调试信息')).not.toThrow();
      expect(() => logger.debug('调试信息', { debug: true })).not.toThrow();
    });

    it('应该正确处理 logError 方法', () => {
      const error = new Error('测试错误');
      expect(() => logger.logError(error, '发生错误')).not.toThrow();
    });

    it('应该处理不同类型的错误对象', () => {
      expect(() => logger.logError('字符串错误', '上下文')).not.toThrow();
      expect(() => logger.logError({ message: '对象错误' }, '上下文')).not.toThrow();
      expect(() => logger.logError(null, '空错误')).not.toThrow();
    });
  });

  describe('Module isolation', () => {
    it('不同模块应该有独立的 logger', () => {
      const logger1 = createModuleLogger('Module1');
      const logger2 = createModuleLogger('Module2');

      expect(logger1).not.toBe(logger2);

      // 两个 logger 都应该正常工作
      expect(() => logger1.info('Module1 log')).not.toThrow();
      expect(() => logger2.info('Module2 log')).not.toThrow();
    });
  });
});
