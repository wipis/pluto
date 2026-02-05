import { defineConfig, type Plugin } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'

// Resolve cloudflare:workers correctly per environment:
// - SSR: mark as external (provided by Workers runtime)
// - Client: stub with empty module (not available in browser)
function cloudflareWorkersResolve(): Plugin {
  return {
    name: 'cloudflare-workers-resolve',
    resolveId(id) {
      if (id === 'cloudflare:workers') {
        if (this.environment?.name === 'client') {
          return '\0cloudflare-workers-stub'
        }
        return { id, external: true }
      }
    },
    load(id) {
      if (id === '\0cloudflare-workers-stub') {
        return 'export const env = {};'
      }
    },
  }
}

const config = defineConfig({
  plugins: [
    devtools(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    cloudflareWorkersResolve(),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
