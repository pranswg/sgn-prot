/**
 * Test-only module resolution hook.
 *
 * Application source uses the `@/` path alias (configured for Vite and tsc),
 * which Node cannot resolve on its own. This maps `@/x` to `src/x` so tests can
 * import the real modules instead of duplicating their logic.
 *
 * It is registered via `node --import` in the `test` script and never runs in
 * the application bundle.
 */

import { registerHooks } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const srcDir = path.resolve(process.cwd(), 'src')

function resolveFile(base) {
  const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
  }
  return null
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const file = resolveFile(path.join(srcDir, specifier.slice(2)))
      if (file) return { url: pathToFileURL(file).href, shortCircuit: true }
    }

    // Application source omits file extensions (Vite and tsc both allow it),
    // but Node's ESM resolver requires them. Fill in the extension when the
    // bare path does not exist but a `.ts`/`.tsx` sibling does.
    if (/^\.{1,2}\//.test(specifier) && !path.extname(specifier) && context.parentURL) {
      const base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier)
      const file = resolveFile(base)
      if (file) return { url: pathToFileURL(file).href, shortCircuit: true }
    }

    return nextResolve(specifier, context)
  },
})
