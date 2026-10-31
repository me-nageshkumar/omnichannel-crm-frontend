import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';

/**
 * The tests run through esbuild, the browser build through tsc at the tsconfig target, and only the latter breaks a
 * class that extends Error. So this compiles the client the way the browser build does and runs the result.
 */
function builtClient() {
  const { config } = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
  const { target } = ts.parseJsonConfigFileContent(config, ts.sys, '.').options;
  const { outputText } = ts.transpileModule(readFileSync('src/app/api/client.ts', 'utf8'), {
    compilerOptions: { target, module: ts.ModuleKind.CommonJS },
  });
  const exports: Record<string, unknown> = {};
  runInNewContext(outputText, { exports, require: () => ({}) });
  return exports as { ApiError: new (status: number, code?: string) => Error & { status: number; code?: string } };
}

describe('ApiError in the browser build', () => {
  it('isStillAnApiError', () => {
    const { ApiError } = builtClient();
    const error = new ApiError(409, 'VERSION_CONFLICT');
    expect(error instanceof ApiError).toBe(true);
    expect(error.status).toBe(409);
    expect(error.code).toBe('VERSION_CONFLICT');
    expect(error.name).toBe('ApiError');
  });
});
