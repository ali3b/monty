import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5197,
    host: '0.0.0.0',
    // The checks write screenshots and the asset build rewrites public/assets while the page is open: neither is
    // the game's source, so neither should reload the page under a running game.
    watch: { ignored: ['**/test-results/**', '**/public/assets/**', '**/dist/**'] },
  },
  preview: { port: 5197, host: '0.0.0.0' },
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
});