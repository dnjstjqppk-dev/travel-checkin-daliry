import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && context.parentURL) {
    const url = new URL(specifier, context.parentURL)
    if (existsSync(fileURLToPath(url) + '.ts')) {
      return { url: url.href + '.ts', shortCircuit: true }
    }
  }
  return nextResolve(specifier, context)
}
export async function load(url, context, nextLoad) {
  if (url.endsWith('.ts')) {
    const source = await readFile(new URL(url), 'utf8')
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText }
  }
  return nextLoad(url, context)
}
