import { defineConfig } from 'vite'
import path from 'path'
import fs from 'node:fs'
import { builtinModules } from 'node:module'

function versionJsonPlugin() {
  return {
    name: 'generate-version-json',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist')
      if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true })
      }
      const versionData = {
        version: new Date().toISOString()
      }
      fs.writeFileSync(
        path.join(distDir, 'version.json'),
        JSON.stringify(versionData, null, 2)
      )
    }
  }
}

export default defineConfig({
  plugins: [versionJsonPlugin()],
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
