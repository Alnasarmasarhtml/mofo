import { defineConfig } from 'vite';
export default defineConfig({ base: './', server: { port: 5188, host: '127.0.0.1' }, build: { chunkSizeWarningLimit: 2000 } });
