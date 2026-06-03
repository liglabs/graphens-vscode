import { defineConfig } from 'vite'
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import path from 'path'

export default defineConfig({
  plugins: [svelte({ preprocess: vitePreprocess() })],
  build: {
    outDir: path.resolve(__dirname, '../media'),
    emptyOutDir: false, // preserve media/icon.svg
    rollupOptions: {
      input: {
        chat: path.resolve(__dirname, 'src/chat/main.ts'),
        config: path.resolve(__dirname, 'src/config/main.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].[hash].js',
        assetFileNames: (info) => (info.names[0] ?? '').endsWith('.css') ? '[name].css' : '[name].[ext]',
      },
    },
  },
})
