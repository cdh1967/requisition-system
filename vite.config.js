import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0', // Gitugotan ang pag-access sa network, sayon ra para sa Laragon
    port: 5173,      // Default nga port sa Vite
  }
});