import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The UI calls the backend through relative '/api' URLs. Vite proxies them to the
// running bilokat-api (default :4600) so there is no CORS / hardcoded-origin issue.
const API_TARGET = process.env.API_TARGET || 'http://localhost:4600';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    // The live preview loads the app under an e2b.app host; allow it so the dev
    // server doesn't 403 the iframe. Never restrict to a single dev origin here.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
});
