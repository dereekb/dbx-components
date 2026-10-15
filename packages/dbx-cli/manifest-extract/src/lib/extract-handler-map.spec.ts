import { describe, expect, it } from 'vitest';
import { Project } from 'ts-morph';
import { extractCallModelHandlerMap, extractCallModelHandlerMapFromSourceFile, type CallModelHandlerMapExtraction } from './extract-handler-map';

const NAME = 'crud.functions.ts';

function scan(text: string): CallModelHandlerMapExtraction {
  return extractCallModelHandlerMap({ name: NAME, text });
}

function keysOf(extraction: CallModelHandlerMapExtraction): string[] {
  return extraction.cells.map((x) => `${x.model}.${x.verb}.${x.specifier ?? '-'}=${x.handlerName}`);
}

describe('extractCallModelHandlerMap()', () => {
  it('finds SCREAMING and camelCase verb maps in declaration order and ignores other consts', () => {
    const result = scan(`
export const DEMO_UPDATE_MODEL_MAP = { a: aUpdate };
export const demoCreateModelMap = { a: aCreate };
export const DEMO_CALL_MODEL_MAP = { a: aCall };
export const FOO_MODEL_MAP = { a: aFoo };
`);
    expect(result.verbsFound).toEqual(['update', 'create']);
    expect(keysOf(result)).toEqual(['a.update.-=aUpdate', 'a.create.-=aCreate']);
    expect(result.opaque).toEqual([]);
  });

  it('reads a bare identifier as a cell with no specifier', () => {
    const result = scan('export const X_READ_MODEL_MAP = { profile: profileRead };');
    expect(result.cells).toEqual([{ model: 'profile', verb: 'read', handlerName: 'profileRead', line: 1 }]);
    expect('specifier' in result.cells[0]).toBe(false);
  });

  it('reads every key of an onCallSpecifierHandler literal, including shorthand', () => {
    const result = scan(`export const X_UPDATE_MODEL_MAP = {
  thing: onCallSpecifierHandler({ _: a, x: b, c })
};`);
    expect(keysOf(result)).toEqual(['thing.update._=a', 'thing.update.x=b', 'thing.update.c=c']);
    expect(result.cells.every((x) => x.line === 2)).toBe(true);
  });

  it('reads verb-level shorthand as a bare cell', () => {
    const result = scan('export const X_UPDATE_MODEL_MAP = { profile };');
    expect(result.cells).toEqual([{ model: 'profile', verb: 'update', handlerName: 'profile', line: 1 }]);
    expect(result.opaque).toEqual([]);
  });

  it('reads string-literal keys without their quotes at both levels', () => {
    const result = scan(`export const X_UPDATE_MODEL_MAP = { 'thing': onCallSpecifierHandler({ 'lock': a, "_": b }), 'other': c };`);
    expect(keysOf(result)).toEqual(['thing.update.lock=a', 'thing.update._=b', 'other.update.-=c']);
  });

  it('walks verb maps wrapped in as / satisfies / as const / parentheses', () => {
    const result = scan(`
export const X_CREATE_MODEL_MAP = { a: aCreate } as XCreateMap;
export const X_READ_MODEL_MAP = { a: aRead } satisfies XReadMap;
export const X_DELETE_MODEL_MAP = ({ a: aDelete }) as const;
`);
    expect(result.verbsFound).toEqual(['create', 'read', 'delete']);
    expect(keysOf(result)).toEqual(['a.create.-=aCreate', 'a.read.-=aRead', 'a.delete.-=aDelete']);
  });

  it('reports a verb-level spread or computed key as opaque without a model, still reading the other props', () => {
    const result = scan(`
const k = 'b';
export const X_UPDATE_MODEL_MAP = {
  ...OTHER_MAP,
  [k]: bUpdate,
  a: aUpdate
};`);
    expect(keysOf(result)).toEqual(['a.update.-=aUpdate']);
    expect(result.opaque).toEqual([
      { verb: 'update', reason: 'verb_map_member', line: 4 },
      { verb: 'update', reason: 'verb_map_member', line: 5 }
    ]);
  });

  it('reports a non-literal verb map initializer as opaque and does not count the verb as found', () => {
    const result = scan('export const X_QUERY_MODEL_MAP = buildQueryMap();');
    expect(result.verbsFound).toEqual([]);
    expect(result.cells).toEqual([]);
    expect(result.opaque).toEqual([{ verb: 'query', reason: 'verb_map_not_literal', line: 1 }]);
  });

  it('reports onCallSpecifierHandler(<non-literal>) as opaque for the model and registers no cells', () => {
    const result = scan('export const X_UPDATE_MODEL_MAP = { thing: onCallSpecifierHandler(config) };');
    expect(result.cells).toEqual([]);
    expect(result.opaque).toEqual([{ verb: 'update', model: 'thing', reason: 'specifier_config_not_literal', line: 1 }]);
  });

  it('reports a spread inside the specifier literal as opaque while reading the other keys', () => {
    const result = scan(`export const X_UPDATE_MODEL_MAP = {
  thing: onCallSpecifierHandler({
    ...BASE,
    lock: thingLock
  })
};`);
    expect(keysOf(result)).toEqual(['thing.update.lock=thingLock']);
    expect(result.opaque).toEqual([{ verb: 'update', model: 'thing', reason: 'specifier_config_member', line: 3 }]);
  });

  it('reads a wrapped handler as bare, plus an opaque model_handler_expression', () => {
    const result = scan('export const X_UPDATE_MODEL_MAP = { profile: inAuthContext(fn) };');
    expect(keysOf(result)).toEqual(['profile.update.-=inAuthContext']);
    expect(result.opaque).toEqual([{ verb: 'update', model: 'profile', reason: 'model_handler_expression', line: 1 }]);
  });

  it('counts a namespaced onCallSpecifierHandler call', () => {
    const result = scan('export const X_UPDATE_MODEL_MAP = { thing: fs.onCallSpecifierHandler({ lock: a }) };');
    expect(keysOf(result)).toEqual(['thing.update.lock=a']);
  });

  it('matches the SourceFile variant with references stripped', () => {
    const text = `export const X_UPDATE_MODEL_MAP = {
  thing: onCallSpecifierHandler({ _: a, lock }),
  other: b,
  ...REST
};
export const X_INVOKE_MODEL_MAP = buildInvoke();`;
    const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
    const fromSource = extractCallModelHandlerMapFromSourceFile(project.createSourceFile(NAME, text));
    const plain = scan(text);

    expect(fromSource.cells.every((x) => x.reference != null)).toBe(true);
    expect(plain).toStrictEqual({ verbsFound: fromSource.verbsFound, opaque: fromSource.opaque, cells: fromSource.cells.map(({ reference, ...cell }) => cell) });
  });
});
