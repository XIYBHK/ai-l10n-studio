/**
 * 参数转换工具测试
 * 
 * 测试 camelCase ↔ snake_case 转换逻辑
 * 
 * TDD 测试优先 - 此文件编写时功能尚未实现
 */

import { describe, it, expect } from 'vitest';
import {
  toSnakeCase,
  toCamelCase,
  convertKeysToSnakeCase,
  convertKeysToCamelCase,
} from '@/utils/paramConverter';

describe('参数转换工具', () => {
  describe('toSnakeCase', () => {
    it('应该将 camelCase 转换为 snake_case', () => {
      expect(toSnakeCase('sourceLangCode')).toBe('source_lang_code');
      expect(toSnakeCase('apiKey')).toBe('api_key');
      expect(toSnakeCase('targetLanguage')).toBe('target_language');
    });

    it('应该处理单个单词（无大写字母）', () => {
      expect(toSnakeCase('config')).toBe('config');
      expect(toSnakeCase('role')).toBe('role');
    });

    it('应该处理首字母大写', () => {
      expect(toSnakeCase('ProviderType')).toBe('_provider_type');
    });

    it('应该处理连续大写字母', () => {
      expect(toSnakeCase('HTTPRequest')).toBe('_h_t_t_p_request');
      expect(toSnakeCase('AIConfig')).toBe('_a_i_config');
    });
  });

  describe('toCamelCase', () => {
    it('应该将 snake_case 转换为 camelCase', () => {
      expect(toCamelCase('source_lang_code')).toBe('sourceLangCode');
      expect(toCamelCase('api_key')).toBe('apiKey');
      expect(toCamelCase('target_language')).toBe('targetLanguage');
    });

    it('应该处理单个单词（无下划线）', () => {
      expect(toCamelCase('config')).toBe('config');
      expect(toCamelCase('role')).toBe('role');
    });

    it('应该处理前导下划线', () => {
      expect(toCamelCase('_provider_type')).toBe('ProviderType');
    });

    it('应该处理多个下划线', () => {
      expect(toCamelCase('some__value')).toBe('someValue');
    });
  });

  describe('convertKeysToSnakeCase', () => {
    it('应该转换对象的所有键为 snake_case', () => {
      const input = {
        sourceLangCode: 'en',
        targetLanguage: 'zh-CN',
        apiKey: 'test-key',
      };

      const output = convertKeysToSnakeCase(input);

      expect(output).toEqual({
        source_lang_code: 'en',
        target_language: 'zh-CN',
        api_key: 'test-key',
      });
    });

    it('应该处理空对象', () => {
      expect(convertKeysToSnakeCase({})).toEqual({});
    });

    it('应该保留值的类型', () => {
      const input = {
        stringValue: 'test',
        numberValue: 123,
        booleanValue: true,
        nullValue: null,
        arrayValue: [1, 2, 3],
        objectValue: { nested: 'data' },
      };

      const output = convertKeysToSnakeCase(input);

      expect(output.string_value).toBe('test');
      expect(output.number_value).toBe(123);
      expect(output.boolean_value).toBe(true);
      expect(output.null_value).toBe(null);
      expect(output.array_value).toEqual([1, 2, 3]);
      expect(output.object_value).toEqual({ nested: 'data' });
    });
  });

  describe('convertKeysToCamelCase', () => {
    it('应该转换对象的所有键为 camelCase', () => {
      const input = {
        source_lang_code: 'en',
        target_language: 'zh-CN',
        api_key: 'test-key',
      };

      const output = convertKeysToCamelCase(input);

      expect(output).toEqual({
        sourceLangCode: 'en',
        targetLanguage: 'zh-CN',
        apiKey: 'test-key',
      });
    });

    it('应该处理空对象', () => {
      expect(convertKeysToCamelCase({})).toEqual({});
    });

    it('应该保留值的类型', () => {
      const input = {
        string_value: 'test',
        number_value: 123,
        boolean_value: true,
        null_value: null,
        array_value: [1, 2, 3],
        object_value: { nested: 'data' },
      };

      const output = convertKeysToCamelCase(input);

      expect(output.stringValue).toBe('test');
      expect(output.numberValue).toBe(123);
      expect(output.booleanValue).toBe(true);
      expect(output.nullValue).toBe(null);
      expect(output.arrayValue).toEqual([1, 2, 3]);
      expect(output.objectValue).toEqual({ nested: 'data' });
    });
  });

  describe('集成测试：AI配置保存场景', () => {
    it('应该正确转换 AI 配置对象', () => {
      const frontendConfig = {
        name: 'Moonshot AI',
        providerType: 'moonshot',
        apiKey: 'sk-test123',
        apiUrl: 'https://api.moonshot.cn/v1',
        model: 'moonshot-v1-8k',
      };

      const backendConfig = convertKeysToSnakeCase(frontendConfig);

      expect(backendConfig).toEqual({
        name: 'Moonshot AI',
        provider_type: 'moonshot',
        api_key: 'sk-test123',
        api_url: 'https://api.moonshot.cn/v1',
        model: 'moonshot-v1-8k',
      });
    });
  });

  describe('集成测试：语言检测场景', () => {
    it('应该正确转换语言检测参数', () => {
      const frontendParams = {
        sourceLangCode: 'en',
      };

      const backendParams = convertKeysToSnakeCase(frontendParams);

      expect(backendParams).toEqual({
        source_lang_code: 'en',
      });
    });
  });
});

