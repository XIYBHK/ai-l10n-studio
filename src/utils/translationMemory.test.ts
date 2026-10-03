import { describe, expect, it } from 'vitest';
import { buildMemoryKey, parseMemoryKey } from './translationMemory';

describe('translation memory keys', () => {
  it('preserves pipes, quotes and context through editing/export', () => {
    const key = buildMemoryKey('A|"B"', 'verb', 'zh-CN');
    expect(parseMemoryKey(key)).toEqual({ source: 'A|"B"', context: 'verb', language: 'zh-Hans' });
    expect(buildMemoryKey('A|"B"', 'noun', 'zh-CN')).not.toBe(key);
    expect(buildMemoryKey('A|"B"', 'verb', 'zh-TW')).not.toBe(key);
  });
  it('rejects ambiguous legacy keys and missing targets', () => {
    expect(() => parseMemoryKey('Hello|zh-CN')).toThrow();
    expect(() => buildMemoryKey('Hello', null, '')).toThrow();
  });
});
