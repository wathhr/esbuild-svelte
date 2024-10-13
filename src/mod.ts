// NOTE: `node:` imports are used so this plugin should hypothetically work with most js runtimes
import process from 'node:process';
import { basename, dirname, join, relative } from 'node:path/posix'; // this being posix might cause problems (?)
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import type { compile, preprocess, CompileOptions, CompileError, PreprocessorGroup, ModuleCompileOptions } from 'svelte/compiler';
import type * as esbuild from 'esbuild';
import { errorToLocation } from '#/convert.ts';

type Props = {
  /**
   * The Svelte compile function
   *
   * @example
   * ```ts
   * import { compile } from 'svelte/compiler';
   *
   * esbuild.build({
   *   plugins: [sveltePlugin({ compile })],
   *   ...
   * });
   * ```
   */
  compile: typeof compile;
  /** The Svelte compiler options */
  compilerOptions?: CompileOptions;

  /** The Svelte module compile function */
  compileModule?: typeof compile;
  /** The Svelte module compiler options */
  moduleCompilerOptions?: ModuleCompileOptions;
} & ({ preprocessors?: never } | {
  // TODO: It would likely be better to replace this with my own solution, since it will likely be deprecated in the future https://github.com/sveltejs/svelte/issues/12749
  /** The Svelte preprocess function */
  preprocess: typeof preprocess;
  /**
   * The preprocessor(s) the Svelte code is ran through before compiling
   *
   * Does not preprocess Svelte modules. https://github.com/sveltejs/svelte/issues/12749
   */
  preprocessors: PreprocessorGroup | PreprocessorGroup[];
});

export const pluginName = 'Svelte';
const externalCssExtension = `.${pluginName.toLowerCase()}__styles`
const externalCssFilter = new RegExp(`${externalCssExtension.replaceAll('.', '\\.')}$`);

/**
 * @example
 * ```ts
 * import * as svelte from 'npm:svelte@next/compiler';
 * import * as esbuild from 'npm:esbuild@latest';
 * import { sveltePlugin } from 'jsr:@wathhr/esbuild-svelte';
 *
 * esbuild.build({
 *   plugins: [sveltePlugin({
 *     ...svelte,
 *     compilerOptions: { css: 'external' }
 *   })],
 *   // rest of config
 * });
 * ```
 *
 * @returns The compiled JS code
 */
export const sveltePlugin = (props: Props): esbuild.Plugin => ({
  name: pluginName,
  setup(build) {
    const cssMap = new Map<string, { code: string; map: import('npm:magic-string@latest').SourceMap }>();

    // This is required for svelte modules, no clue why
    build.onResolve({ filter: /\.svelte(?:\.[cm]?[jt]s)?$/ }, async ({ path, importer }) => {
      const importDir = dirname(importer);
      if (importDir.trim() === '.') return { path };

      const realPath = join(importDir, path);
      if (existsSync(realPath)) return {
        pluginName,
        path: realPath,
      };

      const dir = dirname(realPath);
      const file = await readdir(dir).then(files => files.find(file => basename(file).startsWith(basename(path))));
      if (file) return {
        pluginName,
        path: join(dir, file),
      };

      return {};
    });

    build.onLoad({ filter: /\.svelte$/ }, async ({ path }) => {
      const filename = relative(process.cwd(), path);
      const code = await readFile(path, 'utf8')
        .catch((err: Error) => ({
          pluginName,
          watchFiles: [path],
          errors: [{
            id: 'read-file-error',
            text: err.message,
            pluginName,
          }],
        }) as esbuild.OnLoadResult);
      if (typeof code !== 'string') return code;

      // Let this throw since there's not really a good way to handle its errors
      const preprocessResult = props.preprocessors
        ? await props.preprocess(code, props.preprocessors ?? [], { filename })
        : { code };

      try {
        const compilerOptions: CompileOptions = {
          ...props.compilerOptions,
          filename,
          // TODO: Don't overwrite sourcemap if it exists, (somehow) combine it instead
          ...(preprocessResult.map ? { sourcemap: preprocessResult.map } : {}),
        };

        const result = props.compile(preprocessResult.code, compilerOptions);

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

    build.onLoad({ filter: /\.svelte\.[cm]?[jt]s$/, namespace: 'svelte-module' }, async ({ path }) => {
      if (!props.compileModule) return {
        errors: [{
          pluginName,
          id: 'missing-module-compiler',
          text: 'No `compileModule` function provided.',
          notes: [{
            text: 'This can be fixed by passing Svelte\'s `compileModule` to the plugin\'s options',
          }],
        }],
      }

      const filename = relative(process.cwd(), path);
      const code = await readFile(path, 'utf8')
        .catch((err: Error) => ({
          pluginName,
          watchFiles: [path],
          errors: [{
            id: 'read-file-error',
            text: err.message,
            pluginName,
          }],
        }) as esbuild.OnLoadResult);
      if (typeof code !== 'string') return code;

      try {
        const result = props.compileModule(code, {
          ...props.moduleCompilerOptions,
          filename,
        });

        return {
          watchFiles: [
            path,
            ...result.js.map.sources,
            ...(result.css?.map.sources ?? []),
          ],
          contents: result.js.code + `\n//# sourceMappingURL=${result.js.map.toUrl()}`,
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
