import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'app/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'app/renderer/index.html')
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'app/renderer'),
      '@shared': resolve(__dirname, 'app/shared'),
      '@types': resolve(__dirname, 'app/types')
    }
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
