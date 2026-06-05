import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import path from 'path'

export default defineConfig({
  plugins: [svelte({ preprocess: vitePreprocess() }), tailwindcss()],
  root: path.resolve(__dirname, 'src'),
  base: './',

  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        chat: path.resolve(__dirname, 'src/chat/index.html'),
        config: path.resolve(__dirname, 'src/config/index.html'),
        preview: path.resolve(__dirname, 'src/preview/index.html'),
      },
    },
  },
})
