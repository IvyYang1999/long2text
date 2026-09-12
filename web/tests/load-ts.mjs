import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

export function loadTs(relative, overrides = {}) {
  const file = resolve(import.meta.dirname, '..', relative);
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  const nativeRequire = createRequire(file);
  const require = name => name in overrides ? overrides[name]
    : name.startsWith('@/') ? loadTs(`src/${name.slice(2)}.ts`, overrides)
    : name.startsWith('.') ? loadTs(`${resolve(dirname(file), name)}.ts`, overrides)
    : nativeRequire(name);
  new Function('require', 'module', 'exports', code)(require, mod, mod.exports);
  return mod.exports;
}
