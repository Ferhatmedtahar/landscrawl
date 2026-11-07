import { defineConfig, type Plugin } from 'vitest/config'
import { viteSingleFile } from 'vite-plugin-singlefile'

/** Strict policy for the shipped file: nothing can load or contact anything. Left out in dev, where Vite serves modules and hot reload. */
export const CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'"

const csp = (): Plugin => ({
  name: 'landscrawl-csp',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<!--csp-->', `<meta http-equiv="Content-Security-Policy" content="${CSP}">`),
})

export default defineConfig({
  plugins: [viteSingleFile(), csp()],
  build: { target: 'es2022', assetsInlineLimit: Infinity },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
})
