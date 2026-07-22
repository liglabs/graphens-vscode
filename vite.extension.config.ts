import { defineConfig } from 'vite'
import { builtinModules } from 'node:module'

const external = ['vscode', ...builtinModules, ...builtinModules.map(m => `node:${m}`)]

export default defineConfig({
  build: {
    lib: {
      entry: 'src/extension.ts',
      formats: ['cjs'],
      fileName: () => 'extension.js',
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: false,
    rollupOptions: {
      external,
    },
  },
})
