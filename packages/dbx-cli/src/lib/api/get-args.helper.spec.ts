import { describe, expect, it } from 'vitest';
import type { CliModelManifest } from '../manifest/types';
import { parseGetArgs, parseGetManyArgs } from './get-args.helper';

const MANIFEST: CliModelManifest = [
  {
    modelType: 'jobWorkerSchedule',
    modelName: 'JobWorkerSchedule',
    identityConst: 'jobWorkerScheduleIdentity',
    collectionPrefix: 'jws',
    sourcePackage: 'hellosubs-firebase',
    sourceFile: 'job-worker-schedule.ts',
    fields: []
  },
  {
    modelType: 'jobWorkerRequirementSchedule',
    modelName: 'JobWorkerRequirementSchedule',
    identityConst: 'jobWorkerRequirementScheduleIdentity',
    collectionPrefix: 'jwr',
    sourcePackage: 'hellosubs-firebase',
    sourceFile: 'job-worker-requirement-schedule.ts',
    fields: []
  }
];

describe('parseGetArgs', () => {
  it('returns explicit modelType+key when both positionals are supplied', () => {
    const result = parseGetArgs({ modelOrKey: 'jobWorkerSchedule', key: 'abc123', manifest: MANIFEST });
    expect(result).toEqual({ modelType: 'jobWorkerSchedule', key: 'abc123' });
  });

  it('does not require manifest in the explicit-model form', () => {
    const result = parseGetArgs({ modelOrKey: 'anyModel', key: 'abc', manifest: undefined });
    expect(result).toEqual({ modelType: 'anyModel', key: 'abc' });
  });

  it('infers modelType from a full key prefix when only one positional is supplied', () => {
    const result = parseGetArgs({ modelOrKey: 'jws/abc123', key: undefined, manifest: MANIFEST });
    expect(result).toEqual({ modelType: 'jobWorkerSchedule', key: 'jws/abc123' });
  });

  it('rejects a bare doc id (no slash) without explicit modelType', () => {
    expect(() => parseGetArgs({ modelOrKey: 'abc123', key: undefined, manifest: MANIFEST })).toThrow(/bare doc id/);
  });

  it('rejects an unknown prefix and lists known prefixes', () => {
    expect(() => parseGetArgs({ modelOrKey: 'unknown/abc', key: undefined, manifest: MANIFEST })).toThrow(/Known prefixes: jwr, jws/);
  });

  it('rejects missing positional', () => {
    expect(() => parseGetArgs({ modelOrKey: undefined, key: undefined, manifest: MANIFEST })).toThrow(/missing required positional/);
  });

  it('errors when manifest is missing and inferred-form is needed', () => {
    expect(() => parseGetArgs({ modelOrKey: 'jws/abc', key: undefined, manifest: undefined })).toThrow(/no model manifest is wired/);
  });
});

describe('parseGetManyArgs', () => {
  it('infers modelType from keys when first positional contains a slash', () => {
    const result = parseGetManyArgs({ firstArg: 'jws/a', rest: ['jws/b', 'jws/c'], manifest: MANIFEST });
    expect(result).toEqual({ modelType: 'jobWorkerSchedule', keys: ['jws/a', 'jws/b', 'jws/c'] });
  });

  it('uses the explicit modelType when first positional has no slash', () => {
    const result = parseGetManyArgs({ firstArg: 'jobWorkerSchedule', rest: ['abc', 'def'], manifest: MANIFEST });
    expect(result).toEqual({ modelType: 'jobWorkerSchedule', keys: ['abc', 'def'] });
  });

  it('rejects mixed-collection batches', () => {
    expect(() => parseGetManyArgs({ firstArg: 'jws/a', rest: ['jwr/b'], manifest: MANIFEST })).toThrow(/all keys must belong to the same modelType/);
  });

  it('rejects explicit-model form with no keys', () => {
    expect(() => parseGetManyArgs({ firstArg: 'jobWorkerSchedule', rest: [], manifest: MANIFEST })).toThrow(/no keys were supplied/);
  });

  it('rejects unknown prefix in inferred form', () => {
    expect(() => parseGetManyArgs({ firstArg: 'unknown/abc', rest: [], manifest: MANIFEST })).toThrow(/unable to resolve modelType/);
  });

  it('rejects missing first positional', () => {
    expect(() => parseGetManyArgs({ firstArg: undefined, rest: ['jws/abc'], manifest: MANIFEST })).toThrow(/missing required positionals/);
  });

  it('does not enforce 50-key cap (that is delegated to the HTTP client)', () => {
    const keys = Array.from({ length: 100 }, (_, i) => `jws/k${i}`);
    const result = parseGetManyArgs({ firstArg: keys[0], rest: keys.slice(1), manifest: MANIFEST });
    expect(result.keys.length).toBe(100);
  });
});
