import { join, relative } from 'node:path';
import { assert, assertObjectMatch } from '@std/assert';
import { build } from '&/mod.ts';

Deno.test('injected css', async () => {
  const result = await build(join(import.meta.dirname!, './svelte/Counter.svelte'), { css: 'injected' });
  const text = new TextDecoder().decode(result.outputFiles[0]!.contents);

  assert(Object.keys(result.outputFiles).length === 1);
  assert(text.includes('<button class='));
  assert(text.includes('button.svelte'));
});

Deno.test('external css', async () => {
  const result = await build(join(import.meta.dirname!, './svelte/Counter.svelte'), { css: 'external' });
  const jsText = new TextDecoder().decode(result.outputFiles[0]!.contents);
  const cssText = new TextDecoder().decode(result.outputFiles[1]!.contents);

  assert(Object.keys(result.outputFiles).length === 2);
  assert(jsText.includes('<button class='));
  assert(cssText.includes('button.svelte'));
});

Deno.test('css import', async () => {
  const result = await build(join(import.meta.dirname!, './svelte/Wrapper.svelte'));
  const jsText = new TextDecoder().decode(result.outputFiles[0]!.contents);
  const cssText = new TextDecoder().decode(result.outputFiles[1]!.contents);

  assert(Object.keys(result.outputFiles).length === 2);
  assert(jsText.includes('<button class='));
  assert(cssText.includes('button.svelte'));
});
