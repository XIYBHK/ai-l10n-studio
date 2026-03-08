import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

function matchesPackagePath(id: string, pkg: string): boolean {
  return id.includes(`/node_modules/${pkg}/`) || id.includes(`\\node_modules\\${pkg}\\`);
}

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // 3. tell vite to ignore watching `src-tauri` and reference projects
      ignored: ['**/src-tauri/**', '**/ref/**'],
    },
    hmr: {
      overlay: false,
    },
  },
  // 4. esbuild options to avoid TypeScript config issues
  esbuild: {
    target: 'es2020',
  },
  // 5. optimize dependencies to exclude src-tauri and reference projects
  optimizeDeps: {
    exclude: ['src-tauri', 'ref'],
    entries: ['index.html', 'src/**/*.{ts,tsx}'],
  },
  // 6. resolve configuration
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    restoreMocks: true,
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/devtools.tsx',
        'src/i18n/locales/**',
        'src/types/generated/**',
        'src/test/**',
      ],
    },
  },
  // 7. build configuration for multiple entry points
  build: {
    modulePreload: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        devtools: resolve(__dirname, 'devtools.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('/src/services/') || id.includes('\\src\\services\\')) {
            return 'services-runtime';
          }

          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (matchesPackagePath(id, 'react') || matchesPackagePath(id, 'react-dom')) {
            return 'react-vendor';
          }

          if (
            matchesPackagePath(id, 'lodash') ||
            matchesPackagePath(id, 'i18next') ||
            matchesPackagePath(id, 'react-i18next') ||
            matchesPackagePath(id, 'dayjs')
          ) {
            return 'utils-vendor';
          }

          if (matchesPackagePath(id, '@ant-design/icons')) {
            return 'antd-icons';
          }

          return undefined;
        },
      },
    },
  },
}));
