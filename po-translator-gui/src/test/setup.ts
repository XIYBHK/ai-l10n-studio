import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// 清理每个测试后的 DOM
afterEach(() => {
  cleanup();
});

// Mock window.crypto
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: (arr: Uint32Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 0xFFFFFFFF);
      }
      return arr;
    },
  },
});

// Mock Tauri API
const mockTauriInvoke = vi.fn();

Object.defineProperty(global.window, '__TAURI__', {
  value: {
    invoke: mockTauriInvoke,
    event: {
      listen: vi.fn(),
      emit: vi.fn(),
    },
  },
  writable: true,
});

// 导出 mock 函数供测试使用
export { mockTauriInvoke };

