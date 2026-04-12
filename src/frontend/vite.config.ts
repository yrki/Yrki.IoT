import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const apiTarget = process.env.VITE_API_TARGET ?? 'http://localhost:8081';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 4000,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-three', test: /node_modules\/three/ },
            { name: 'vendor-webifc', test: /node_modules\/web-ifc/ },
            { name: 'vendor-maplibre', test: /node_modules\/@maplibre|node_modules\/maplibre-gl/ },
            { name: 'vendor-mui', test: /node_modules\/@mui/ },
            { name: 'vendor-react', test: /node_modules\/react/ },
            { name: 'vendor-signalr', test: /node_modules\/@microsoft/ },
            { name: 'vendor', test: /node_modules/ },
          ],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/hubs': {
        target: apiTarget,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.ts',
    testTimeout: 15000,
  },
});
