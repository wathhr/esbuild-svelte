import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import type { CompileError, Warning } from 'svelte/compiler';
import type { PartialMessage } from 'esbuild';

export function errorToLocation(error: CompileError | Warning, sourcemap?: string): PartialMessage['location'] {
  if (!error.filename || !error.start) return null;

  if (sourcemap) {
    const traceMap = new TraceMap(sourcemap);
    const position = originalPositionFor(traceMap, {
      line: error.start.line,
      column: error.start.column,
    });

    if (position.source) {
      error.start.line = position.line;
      error.start.column = position.column;
    }
  }

  return {
    file: error.filename,
    column: error.start.column,
    line: error.start.line,
    lineText: error.frame!
      .split('\n')
      .find(line => line.startsWith(error.start!.line.toString()))!
      .slice(3),

    length: ((error.position?.[0] ?? 0) - (error.position?.[1] ?? 1)) || 1,
  };
}
