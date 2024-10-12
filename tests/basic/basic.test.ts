import process from 'node:process';
import { join, relative } from 'node:path';
import { assert, assertObjectMatch } from '@std/assert';
import type * as esbuild from 'https://deno.land/x/esbuild@v0.24.0/mod.js';
import { build } from '&/mod.ts';

Deno.test('counter', async () => {
  const result = await build(join(import.meta.dirname!, './svelte/Counter.svelte'));
  const text = new TextDecoder().decode(result.outputFiles[0]!.contents);

  assert(text.includes('</button>'));
});

Deno.test('counter .ts import', async () => {
  const result = await build(join(import.meta.dirname!, './svelte/counter.ts'));
  const text = new TextDecoder().decode(result.outputFiles[0]!.contents);

  assert(text.includes('</button>'));
  assert(/console\.log\((['"])Component: \1,\s*[_\w]+\)/.test(text));
});

Deno.test('counter .svelte import', async () => {
  const result = await build(join(import.meta.dirname!, './svelte/Wrapper.svelte'));
  const text = new TextDecoder().decode(result.outputFiles[0]!.contents);

  assert(text.includes('</button>'));
  assert(text.includes('Not mounted'));
});

Deno.test('.ts import', async () => {
  const result = await build(join(import.meta.dirname!, './svelte/Countdown.svelte'));
  const text = new TextDecoder().decode(result.outputFiles[0]!.contents);

  assert(text.includes('console.log('));
  assert(text.includes('</h1>'));
});

Deno.test('invalid', async () => {
  try {
    await build(join(import.meta.dirname!, './svelte/Invalid.svelte'));
    throw 'Reached unreachable code.';
  } catch (e: any) {
    if (typeof e === 'string') throw e;

    const error: esbuild.BuildFailure = e;
    assert(error.warnings.length === 0);
    assert(error.errors.length === 1);

    const errorMessage = error.errors[0]!;
    assert(errorMessage.detail === 'js_parse_error');
    assertObjectMatch(errorMessage.location!, {
      line: 5,
      column: 8,
      length: 1,
      file: relative(process.cwd(), join(import.meta.dirname!, 'svelte/Invalid.svelte')),
      namespace: 'file',
      lineText: '<h1>{a</h1>',
    });
  }
});
