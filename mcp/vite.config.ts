import { defineConfig } from 'vite'
import path from 'path'
import { builtinModules } from 'node:module'

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'index.mjs',
    },
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    sourcemap: true,
    target: 'node20',
    rollupOptions: {
      external: [
        ...builtinModules,
        ...builtinModules.map(m => `node:${m}`),
        '@modelcontextprotocol/sdk',
      ],
    },
  },
})
