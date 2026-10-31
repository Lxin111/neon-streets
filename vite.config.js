import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: { outDir: 'dist', sourcemap: true },
  server: { host: '0.0.0.0' }
});