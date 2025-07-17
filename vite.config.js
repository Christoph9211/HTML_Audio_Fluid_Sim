// vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 3000
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  // Ensure all assets are properly handled
  assetsInclude: ['**/*.{png,jpg,jpeg,gif,svg,webp,mp3,wav,ogg,mp4,webm}'],
  // Base path for production (useful for GitHub Pages or similar deployments)
  base: './'
});