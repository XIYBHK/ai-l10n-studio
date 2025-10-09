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

// Mock Tauri Core API
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

// Mock @tauri-apps/plugin-store
vi.mock('@tauri-apps/plugin-store', () => {
  const memoryStore = new Map<string, any>();
  class MockStore {
    path: string;
    constructor(path: string) {
      this.path = path;
    }
    static async load(path: string) {
      return new MockStore(path);
    }
    async set(key: string, value: any) {
      memoryStore.set(key, value);
      return Promise.resolve();
    }
    async get(key: string) {
      return Promise.resolve(memoryStore.get(key));
    }
    async has(key: string) {
      return Promise.resolve(memoryStore.has(key));
    }
    async delete(key: string) {
      return Promise.resolve(memoryStore.delete(key));
    }
    async clear() {
      memoryStore.clear();
      return Promise.resolve();
    }
    async save() {
      return Promise.resolve(); // In-memory, no need to save
    }
    async entries() {
      return Promise.resolve(Array.from(memoryStore.entries()));
    }
    async keys() {
      return Promise.resolve(Array.from(memoryStore.keys()));
    }
    async values() {
      return Promise.resolve(Array.from(memoryStore.values()));
    }
    async onKeyChange(key: string, cb: (value: any) => void) {
      // Mock implementation if needed
      return Promise.resolve(() => {});
    }
    async onChange(cb: (key: string, value: any) => void) {
      // Mock implementation if needed
      return Promise.resolve(() => {});
    }
  }
  return { Store: MockStore };
});


// 导出 mock 函数供测试使用
export { mockTauriInvoke };

