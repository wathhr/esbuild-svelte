// NOTE: `node:` imports are used so this plugin should hypothetically work with most js runtimes
import process from 'node:process';
import { dirname, relative } from 'node:path';
import { readFile } from 'node:fs/promises';
import { preprocess } from 'svelte/compiler';
import type { compile, CompileOptions, CompileError, PreprocessorGroup } from 'svelte/compiler';
import type * as esbuild from 'npm:esbuild@latest';
import { errorToLocation } from '#/convert.ts';

export interface Props {
  /** The svelte compiler options */
  compilerOptions: CompileOptions;
  /** The preprocessors the svelte code is ran through before compiling */
  preprocessors: PreprocessorGroup | PreprocessorGroup[];
}

export const pluginName = 'Svelte';
const externalCssExtension = `.${pluginName.toLowerCase()}__styles`
const externalCssFilter = new RegExp(`${externalCssExtension.replaceAll('.', '\\.')}$`);

export const svelte = (svelteCompile: typeof compile, props: Partial<Props> = {}): esbuild.Plugin => ({
  name: pluginName,
  setup(build) {
    const cssMap = new Map<string, { code: string; map: import('npm:magic-string@latest').SourceMap }>();

    build.onLoad({ filter: /\.svelte(?:\.[cm]?[jt]s)?$/ }, async ({ path }) => {
      const filename = relative(process.cwd(), path);
      const compilerOptions: CompileOptions = {
        ...props.compilerOptions,
        filename,
      };

      const svelteCode = await readFile(path, 'utf8')
        .catch((err: Error) => ({
          pluginName,
          watchFiles: [path],
          errors: [{
            id: 'read-file-error',
            text: err.message,
            pluginName,
          }],
        }) as esbuild.OnLoadResult);
      if (typeof svelteCode !== 'string') return svelteCode;

      // Let this throw since there's not really a good way to handle its errors
      const preprocessResult = await preprocess(svelteCode, props.preprocessors ?? [], { filename });

      try {
        const result = svelteCompile(preprocessResult.code, compilerOptions);

        if (result.css) cssMap.set(path, result.css);
        const contents = result.css
          ? result.js.code + `;\nimport '${path.replaceAll('\\', '/')}${externalCssExtension}';`
          : result.js.code;

        return {
          watchFiles: [
            path,
            ...result.js.map.sources,
            ...(result.css?.map.sources ?? []),
          ],
          contents: contents + `\n//# sourceMappingURL=${result.js.map.toUrl()}`,
          warnings: result.warnings.map((warning): esbuild.PartialMessage => ({
            pluginName,
            id: 'compilation-warning',
            detail: warning.code,
            text: warning.message,
            location: errorToLocation(warning)!,
          })),
        };
      } catch (e) {
        const error = e as CompileError;

        return {
          pluginName,
          watchFiles: [path, ...(error.filename ? [error.filename] : [])],
          errors: [{
            pluginName,
            id: 'compilation-error',
            detail: error.code,
            text: error.message,
            location: errorToLocation(error)!,
          }],
        };
      }
    });

    build.onResolve({ filter: externalCssFilter }, ({ path }) => ({ path, namespace: 'external-css' }));
    build.onLoad({ filter: externalCssFilter, namespace: 'external-css' }, ({ path }) => {
      const realPath = path.replace(externalCssExtension, '');
      const value = cssMap.get(realPath);
      if (!value) return {
        errors: [{
          pluginName,
          text: `No associated styles with file "${realPath}"`,
        }],
      };

      return {
        pluginName,
        contents: value.code + `\n\n/*# sourceMappingURL=${value.map.toUrl()} */`,
        loader: 'css',
        resolveDir: dirname(path),
      };
    });
  },
});
