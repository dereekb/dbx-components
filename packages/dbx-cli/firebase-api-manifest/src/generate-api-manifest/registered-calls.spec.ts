import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CALL_MODEL_HANDLER_MAP_PATH, type CallModelHandlerMapExtraction } from '@dereekb/dbx-cli/manifest-extract';
import { isRegisteredCall, makeRegisteredCalls, readRegisteredCalls } from './registered-calls';

const EMPTY: CallModelHandlerMapExtraction = { verbsFound: [], cells: [], opaque: [] };

function registered(extraction: Partial<CallModelHandlerMapExtraction>) {
  return makeRegisteredCalls({ handlerMapFile: 'apps/x-api/src/app/function/model/crud.functions.ts', extraction: { ...EMPTY, ...extraction } });
}

function writeHandlerMap(text: string): string {
  const apiDir = mkdtempSync(join(tmpdir(), 'registered-calls-'));
  const file = join(apiDir, CALL_MODEL_HANDLER_MAP_PATH);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  return apiDir;
}

describe('isRegisteredCall()', () => {
  it('matches a `_` cell against `_` and absent specifiers', () => {
    const calls = registered({ verbsFound: ['update'], cells: [{ model: 'thing', verb: 'update', specifier: '_', handlerName: 'a', line: 1 }] });
    expect(isRegisteredCall(calls, { model: 'thing', verb: 'update', specifier: '_' })).toBe(true);
    expect(isRegisteredCall(calls, { model: 'thing', verb: 'update', specifier: undefined })).toBe(true);
  });

  it('matches a bare cell against `_` but not a named specifier', () => {
    const calls = registered({ verbsFound: ['update'], cells: [{ model: 'formSpace', verb: 'update', handlerName: 'formSpaceUpdate', line: 1 }] });
    expect(isRegisteredCall(calls, { model: 'formSpace', verb: 'update', specifier: '_' })).toBe(true);
    expect(isRegisteredCall(calls, { model: 'formSpace', verb: 'update', specifier: 'lock' })).toBe(false);
  });

  it('matches a named specifier only', () => {
    const calls = registered({ verbsFound: ['update'], cells: [{ model: 'formSpace', verb: 'update', specifier: 'submit', handlerName: 'formSpaceSubmit', line: 1 }] });
    expect(isRegisteredCall(calls, { model: 'formSpace', verb: 'update', specifier: 'submit' })).toBe(true);
    expect(isRegisteredCall(calls, { model: 'formSpace', verb: 'update', specifier: 'lock' })).toBe(false);
    expect(isRegisteredCall(calls, { model: 'formSpace', verb: 'read', specifier: 'submit' })).toBe(false);
  });

  it('rejects every entry of a verb with no cells', () => {
    const calls = registered({ verbsFound: ['update'], cells: [{ model: 'notificationUser', verb: 'update', handlerName: 'a', line: 1 }] });
    expect(isRegisteredCall(calls, { model: 'notificationUser', verb: 'invoke', specifier: 'healthCheck' })).toBe(false);
  });

  it('keeps every entry of an opaque verb, and only of that verb', () => {
    const calls = registered({ opaque: [{ verb: 'update', reason: 'verb_map_member', line: 3 }] });
    expect(isRegisteredCall(calls, { model: 'anything', verb: 'update', specifier: 'lock' })).toBe(true);
    expect(isRegisteredCall(calls, { model: 'anything', verb: 'update', specifier: undefined })).toBe(true);
    expect(isRegisteredCall(calls, { model: 'anything', verb: 'read', specifier: undefined })).toBe(false);
  });

  it('keeps every entry of an opaque (verb, model) pair, and only of that pair', () => {
    const calls = registered({ verbsFound: ['update'], opaque: [{ verb: 'update', model: 'thing', reason: 'specifier_config_not_literal', line: 3 }] });
    expect(isRegisteredCall(calls, { model: 'thing', verb: 'update', specifier: 'lock' })).toBe(true);
    expect(isRegisteredCall(calls, { model: 'other', verb: 'update', specifier: 'lock' })).toBe(false);
    expect(isRegisteredCall(calls, { model: 'thing', verb: 'delete', specifier: undefined })).toBe(false);
  });
});

describe('readRegisteredCalls()', () => {
  it('throws when the handler map is missing', () => {
    const apiDir = mkdtempSync(join(tmpdir(), 'registered-calls-'));
    expect(() => readRegisteredCalls({ workspaceRoot: apiDir, apiDir })).toThrow(/handler map not found: src\/app\/function\/model\/crud\.functions\.ts/);
  });

  it('throws when the handler map declares no verb maps', () => {
    const apiDir = writeHandlerMap('export const SOMETHING_ELSE = { a: b };\n');
    expect(() => readRegisteredCalls({ workspaceRoot: apiDir, apiDir })).toThrow(/declares no/);
  });

  it('reads a two-verb handler map', () => {
    const apiDir = writeHandlerMap(`export const X_CREATE_MODEL_MAP = {
  thing: thingCreate
};
export const X_UPDATE_MODEL_MAP = {
  thing: onCallSpecifierHandler({ _: thingUpdate, lock: thingLock })
};
`);
    const calls = readRegisteredCalls({ workspaceRoot: apiDir, apiDir });
    expect(calls.handlerMapFile).toBe(CALL_MODEL_HANDLER_MAP_PATH);
    expect(calls.verbsFound).toEqual(['create', 'update']);
    expect([...calls.callKeys]).toEqual(['thing.create._', 'thing.update._', 'thing.update.lock']);
    expect(isRegisteredCall(calls, { model: 'thing', verb: 'update', specifier: 'reopen' })).toBe(false);
  });
});
