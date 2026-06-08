import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

// Without this file, the Svelte language server falls back to loading vite.config.ts,
// where vitePreprocess() calls vite.resolveConfig for style processing — an API removed
// in Vite 6+. style: false skips that path; TypeScript preprocessing via esbuild still works.
export default {
  preprocess: vitePreprocess({ style: false })
}
