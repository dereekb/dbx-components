import { describe, it, expect } from 'vitest';
import { DEFAULT_LOAD_WITHOUT_EVALUATING_TIMEOUT, itShouldLoadWithoutEvaluating, readModulesEvaluatedOnLoad } from './shared.import';

describe('readModulesEvaluatedOnLoad()', () => {
  it('should report a watched module the load imports directly', async () => {
    const evaluated = await readModulesEvaluatedOnLoad({ modules: 'make-error', load: () => import('make-error') });
    expect(evaluated).toEqual(['make-error']);
  });

  it('should report a watched module the load imports transitively', async () => {
    // shared.fail.ts imports make-error
    const evaluated = await readModulesEvaluatedOnLoad({ modules: ['make-error'], load: () => import('./shared.fail') });
    expect(evaluated).toEqual(['make-error']);
  });

  it('should report nothing when the load does not import a watched module', async () => {
    const evaluated = await readModulesEvaluatedOnLoad({ modules: ['make-error'], load: async () => undefined });
    expect(evaluated).toEqual([]);
  });

  it('should report only the watched modules the load evaluated', async () => {
    const evaluated = await readModulesEvaluatedOnLoad({ modules: ['arktype', 'make-error'], load: () => import('./shared.fail') });
    expect(evaluated).toEqual(['make-error']);
  });

  it('should refuse a relative module id', async () => {
    await expect(readModulesEvaluatedOnLoad({ modules: './shared.fail', load: async () => undefined })).rejects.toThrow('./shared.fail');
  });

  it('should leave the watched module importable after the probe', async () => {
    await readModulesEvaluatedOnLoad({ modules: 'make-error', load: () => import('make-error') });
    const makeError = await import('make-error');
    expect(makeError.BaseError).toBeTypeOf('function');
  });
});

describe('itShouldLoadWithoutEvaluating()', () => {
  it('should default to a budget well beyond the 5s test default', () => {
    expect(DEFAULT_LOAD_WITHOUT_EVALUATING_TIMEOUT).toBeGreaterThan(5000);
  });

  itShouldLoadWithoutEvaluating({ modules: 'arktype', load: () => import('./shared.fail') });
  itShouldLoadWithoutEvaluating({ title: 'should accept a custom title and timeout', timeout: 60_000, modules: ['arktype'], load: async () => undefined });
});
