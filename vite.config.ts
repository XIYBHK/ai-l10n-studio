import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
}));
