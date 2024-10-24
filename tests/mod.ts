import * as esbuild from 'https://deno.land/x/esbuild@v0.24.0/mod.js'; // the npm version of esbuild causes problems on deno
import * as s from 'svelte/compiler';
import { sveltePlugin, type Props } from '#/mod.ts';

export async function build(path: string, opts: Partial<Props> = {}, inspect = false) {
  const result = await esbuild.build({
    entryPoints: [path],
    bundle: true,
    plugins: [sveltePlugin({ ...s, ...opts })],
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
