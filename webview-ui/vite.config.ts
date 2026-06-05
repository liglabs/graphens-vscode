import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import { createHtmlPlugin } from 'vite-plugin-html'
import path from 'path'
import type { Plugin } from 'vite'

function scriptsToBody(): Plugin {
  return {
    name: 'scripts-to-body',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const scripts: string[] = []
        const cleaned = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (match) => {
          scripts.push(match)
          return ''
        })
        return cleaned.replace('</body>', scripts.join('\n') + '\n</body>')
      },
    },
  }
}

export default defineConfig({
  plugins: [svelte({ preprocess: vitePreprocess() }), tailwindcss(), createHtmlPlugin(), scriptsToBody()],
  root: path.resolve(__dirname, 'src'),
  base: './',
  resolve: {
    dedupe: ['svelte'],
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        chat: path.resolve(__dirname, 'src/chat/index.html'),
        config: path.resolve(__dirname, 'src/config/index.html'),
      },
    },
  },
})
