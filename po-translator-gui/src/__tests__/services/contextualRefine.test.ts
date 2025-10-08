// Phase 7: Contextual Refine API 测试

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { translatorApi } from '../../services/api';
import type { ContextualRefineRequest } from '../../types/tauri';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));

describe('Contextual Refine API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('translatorApi.contextualRefine', () => {
    it('应该正确调用 Tauri 命令', async () => {
      const requests: ContextualRefineRequest[] = [
        {
          msgid: 'Hello',
          msgctxt: 'Greeting',
          comment: 'Friendly greeting',
          previous_entry: 'Welcome',
          next_entry: 'Goodbye',
        },
      ];

      const apiKey = 'test-api-key';
      const targetLanguage = 'zh-CN';
      const expectedResults = ['你好'];

      mockInvoke.mockResolvedValue(expectedResults);

      const results = await translatorApi.contextualRefine(
        requests,
        apiKey,
        targetLanguage
      );

      expect(mockInvoke).toHaveBeenCalledWith(
        'contextual_refine',
        {
          requests,
          apiKey,
          targetLanguage,
        }
      );
      expect(results).toEqual(expectedResults);
    });

    it('应该处理多个精翻请求', async () => {
      const requests: ContextualRefineRequest[] = [
        { msgid: 'Save', msgctxt: 'Button' },
        { msgid: 'Cancel', msgctxt: 'Button' },
        { msgid: 'OK', msgctxt: 'Button' },
      ];

      const expectedResults = ['保存', '取消', '确定'];
      mockInvoke.mockResolvedValue(expectedResults);

      const results = await translatorApi.contextualRefine(
        requests,
        'test-key',
        'zh-CN'
      );

      expect(results).toHaveLength(3);
      expect(results).toEqual(expectedResults);
    });

    it('应该处理空请求数组', async () => {
      mockInvoke.mockResolvedValue([]);

      const results = await translatorApi.contextualRefine(
        [],
        'test-key',
        'zh-CN'
      );

      expect(results).toEqual([]);
    });

    it('应该处理 API 错误', async () => {
      const errorMessage = '精翻失败：API 限流';
      mockInvoke.mockRejectedValue(new Error(errorMessage));

      await expect(
        translatorApi.contextualRefine(
          [{ msgid: 'Test' }],
          'test-key',
          'zh-CN'
        )
      ).rejects.toThrow();
    });

    it('应该支持可选的上下文字段', async () => {
      const requests: ContextualRefineRequest[] = [
        {
          msgid: 'Hello',
          // 所有可选字段都不提供
        },
      ];

      mockInvoke.mockResolvedValue(['你好']);

      await translatorApi.contextualRefine(requests, 'test-key', 'zh-CN');

      expect(mockInvoke).toHaveBeenCalledWith(
        'contextual_refine',
        expect.objectContaining({
          requests: expect.arrayContaining([
            expect.objectContaining({
              msgid: 'Hello',
            }),
          ]),
        })
      );
    });

    it('应该正确传递所有上下文信息', async () => {
      const fullContextRequest: ContextualRefineRequest = {
        msgid: 'Save File',
        msgctxt: 'Menu action',
        comment: 'Save current file to disk',
        previous_entry: '打开文件',
        next_entry: '另存为',
      };

      mockInvoke.mockResolvedValue(['保存文件']);

      await translatorApi.contextualRefine(
        [fullContextRequest],
        'test-key',
        'zh-CN'
      );

      expect(mockInvoke).toHaveBeenCalledWith(
        'contextual_refine',
        expect.objectContaining({
          requests: [fullContextRequest],
        })
      );
    });

    it('应该支持不同的目标语言', async () => {
      const request = { msgid: 'Hello' };
      
      const testCases = [
        { lang: 'zh-CN', expected: '你好' },
        { lang: 'en-US', expected: 'Hello' },
        { lang: 'ja-JP', expected: 'こんにちは' },
      ];

      for (const { lang, expected } of testCases) {
        mockInvoke.mockResolvedValue([expected]);

        await translatorApi.contextualRefine(
          [request],
          'test-key',
          lang
        );

        expect(mockInvoke).toHaveBeenCalledWith(
          'contextual_refine',
          expect.objectContaining({
            targetLanguage: lang,
          })
        );
      }
    });
  });

  describe('ContextualRefineRequest 类型验证', () => {
    it('msgid 是必需字段', () => {
      const request: ContextualRefineRequest = {
        msgid: 'Required field',
      };

      expect(request.msgid).toBeDefined();
      expect(typeof request.msgid).toBe('string');
    });

    it('所有其他字段都是可选的', () => {
      const request: ContextualRefineRequest = {
        msgid: 'Test',
        msgctxt: undefined,
        comment: undefined,
        previous_entry: undefined,
        next_entry: undefined,
      };

      expect(request.msgctxt).toBeUndefined();
      expect(request.comment).toBeUndefined();
      expect(request.previous_entry).toBeUndefined();
      expect(request.next_entry).toBeUndefined();
    });

    it('可选字段可以是字符串', () => {
      const request: ContextualRefineRequest = {
        msgid: 'Test',
        msgctxt: 'Context',
        comment: 'Comment',
        previous_entry: 'Previous',
        next_entry: 'Next',
      };

      expect(typeof request.msgctxt).toBe('string');
      expect(typeof request.comment).toBe('string');
      expect(typeof request.previous_entry).toBe('string');
      expect(typeof request.next_entry).toBe('string');
    });
  });

  describe('边界情况测试', () => {
    it('应该处理超长文本', async () => {
      const longText = 'A'.repeat(10000);
      const request: ContextualRefineRequest = {
        msgid: longText,
        comment: longText,
      };

      mockInvoke.mockResolvedValue(['翻译结果']);

      await translatorApi.contextualRefine([request], 'test-key', 'zh-CN');

      expect(mockInvoke).toHaveBeenCalled();
    });

    it('应该处理特殊字符', async () => {
      const request: ContextualRefineRequest = {
        msgid: 'Hello "World" \n\t',
        msgctxt: 'Context with 中文',
        comment: 'Comment with émojis 🚀',
      };

      mockInvoke.mockResolvedValue(['特殊字符测试']);

      await translatorApi.contextualRefine([request], 'test-key', 'zh-CN');

      expect(mockInvoke).toHaveBeenCalled();
    });

    it('应该处理空字符串字段', async () => {
      const request: ContextualRefineRequest = {
        msgid: '',
        msgctxt: '',
        comment: '',
      };

      mockInvoke.mockResolvedValue(['']);

      await translatorApi.contextualRefine([request], 'test-key', 'zh-CN');

      expect(mockInvoke).toHaveBeenCalled();
    });
  });
});

