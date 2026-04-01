// vite.config.js
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        acoes: resolve(__dirname, 'main.html'),
        relatorio: resolve(__dirname, 'relatorio.html'),
        contato: resolve(__dirname, 'contato.html'),
        template: resolve(__dirname, 'template.html'),
      }
    }
  }
});