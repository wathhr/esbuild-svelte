import { join } from 'node:path';
import { assert } from '@std/assert';
import { build } from '../mod.ts';

const decoder = new TextDecoder();

Deno.test('injected css', async () => {
  const result = await build(join(import.meta.dirname!, './svelte/Counter.svelte'), { compilerOptions: { css: 'injected' } });
  const text = decoder.decode(result.outputFiles[0]!.contents);

  assert(Object.keys(result.outputFiles).length === 1);
  assert(text.includes('<button class='));
  assert(text.includes('button.svelte'));
});

Deno.test('external css', async () => {
  const result = await build(join(import.meta.dirname!, './svelte/Counter.svelte'), { compilerOptions: { css: 'external' } });
  const jsText = decoder.decode(result.outputFiles[0]!.contents);
  const cssText = decoder.decode(result.outputFiles[1]!.contents);

  assert(Object.keys(result.outputFiles).length === 2);
  assert(jsText.includes('<button class='));
  assert(cssText.includes('button.svelte'));
});

Deno.test('css import', async () => {
  const result = await build(join(import.meta.dirname!, './svelte/Wrapper.svelte'));
  const jsText = decoder.decode(result.outputFiles[0]!.contents);
  const cssText = decoder.decode(result.outputFiles[1]!.contents);

  assert(Object.keys(result.outputFiles).length === 2);
  assert(jsText.includes('<button class='));
  assert(cssText.includes('button.svelte'));
});
