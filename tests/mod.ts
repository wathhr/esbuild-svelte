import * as esbuild from 'https://deno.land/x/esbuild@v0.24.0/mod.js';
import { compile, type CompileOptions } from 'svelte/compiler';
import { svelte } from '#/mod.ts';

export async function build(path: string, opts: CompileOptions = {}, inspect = false) {
  const result = await esbuild.build({
    entryPoints: [path],
    bundle: true,
    plugins: [svelte(compile, { compilerOptions: opts })],
    external: ['svelte'], // for speed
    logLevel: 'silent',
    write: false,
    outdir: import.meta.dirname!,
    metafile: true,
  }).finally(async () => await esbuild.stop());

  if (inspect) {
    const copy = structuredClone(result);
    console.log(copy);
  }

  return result;
}
