import { describe, expect, it } from 'vitest';
import { extractHandlerEntriesFromFiles } from './extract-handlers.js';
import type { HandlerEntry, HandlerMcpReadOnly } from './types.js';

const CRUD = 'src/app/function/model/crud.functions.ts';
const INVOKE = 'src/app/function/thing/thing.invoke.ts';
const WITH_API_DETAILS = "import { withApiDetails } from '@dereekb/firebase-server';\n";
const API_DIR = 'apps/x-api';

/**
 * Builds a `crud.functions.ts` with one invoke model whose specifier map holds `entries`.
 *
 * @param imports - The import lines.
 * @param entries - The `onCallSpecifierHandler({ ... })` body.
 * @returns The file text.
 */
function invokeMap(imports: string, entries: string): string {
  return `${imports}\nexport const DEMO_INVOKE_MODEL_MAP = {\n  thing: onCallSpecifierHandler({\n${entries}\n  })\n};\n`;
}

function extract(files: Record<string, string>): readonly HandlerEntry[] {
  return extractHandlerEntriesFromFiles({ files: Object.entries(files).map(([relPath, text]) => ({ relPath, text })), apiAbs: '/abs/x-api', apiDir: API_DIR }).entries;
}

function render(status: HandlerMcpReadOnly | undefined): string {
  let result: string;
  switch (status?.kind) {
    case 'declared':
      result = `declared(${status.value ?? '?'})`;
      break;
    case 'unset':
      result = `unset(${status.hasMcp ? 'mcp' : 'no-mcp'})`;
      break;
    case 'noApiDetails':
    case 'unresolved':
      result = status.kind;
      break;
    default:
      result = 'none';
      break;
  }
  return result;
}

function statusesOf(files: Record<string, string>): string {
  return extract(files)
    .map((x) => render(x.mcpReadOnly))
    .join(', ');
}

describe('extractHandlerEntriesFromFiles() — mcp.readOnly of invoke handlers', () => {
  it.each<[string, Record<string, string>, string]>([
    [
      'literal true / literal false / no mcp / mcp without readOnly',
      {
        [CRUD]: invokeMap("import { a, b, c, d } from '../thing/thing.invoke';", 'a: a, b: b, c: c, d: d'),
        [INVOKE]: `${WITH_API_DETAILS}export const a = withApiDetails({ mcp: { readOnly: true }, fn: async () => 1 });\nexport const b = withApiDetails({ mcp: { readOnly: false }, fn: async () => 1 });\nexport const c = withApiDetails({ fn: async () => 1 });\nexport const d = withApiDetails({ mcp: { visibility: false }, fn: async () => 1 });`
      },
      'declared(true), declared(false), unset(no-mcp), unset(mcp)'
    ],
    [
      'a non-literal readOnly is declared; readOnly: undefined / mcp: undefined are unset',
      {
        [CRUD]: invokeMap("import { a, b, c } from '../thing/thing.invoke';", 'a, b, c'),
        [INVOKE]: `${WITH_API_DETAILS}const FLAG = true;\nexport const a = withApiDetails({ mcp: { readOnly: FLAG }, fn: async () => 1 });\nexport const b = withApiDetails({ mcp: { readOnly: undefined }, fn: async () => 1 });\nexport const c = withApiDetails({ mcp: undefined, fn: async () => 1 });`
      },
      'declared(?), unset(mcp), unset(no-mcp)'
    ],
    [
      'mcp / config held in local consts; an mcp const imported from another file is unresolved',
      {
        [CRUD]: invokeMap("import { a, b, c } from '../thing/thing.invoke';", 'a, b, c'),
        'src/app/function/thing/shared.ts': 'export const SHARED_MCP = { readOnly: true };',
        [INVOKE]: `${WITH_API_DETAILS}import { SHARED_MCP } from './shared';\nconst LOCAL_MCP = { readOnly: true } as const;\nconst config = { mcp: { readOnly: false }, fn: async () => 1 };\nexport const a = withApiDetails({ mcp: LOCAL_MCP, fn: async () => 1 });\nexport const b = withApiDetails(config);\nexport const c = withApiDetails({ mcp: SHARED_MCP, fn: async () => 1 });`
      },
      'declared(true), declared(false), unresolved'
    ],
    [
      'spreads: an explicit property after a spread wins; a spread after it or without one is unresolved',
      {
        [CRUD]: invokeMap("import { a, b, c, d, e } from '../thing/thing.invoke';", 'a, b, c, d, e'),
        [INVOKE]: `${WITH_API_DETAILS}const base: any = {};\nexport const a = withApiDetails({ ...base, mcp: { readOnly: true }, fn: async () => 1 });\nexport const b = withApiDetails({ mcp: { readOnly: true }, ...base, fn: async () => 1 });\nexport const c = withApiDetails({ ...base, fn: async () => 1 });\nexport const d = withApiDetails({ mcp: { ...base }, fn: async () => 1 });\nexport const e = withApiDetails({ mcp: { ...base, readOnly: false }, fn: async () => 1 });`
      },
      'declared(true), unresolved, unresolved, unresolved, declared(false)'
    ],
    [
      'aliased and namespace withApiDetails imports, casts and parentheses',
      {
        [CRUD]: invokeMap("import { a, b } from '../thing/thing.invoke';", 'a, b'),
        [INVOKE]: "import { withApiDetails as wad } from '@dereekb/firebase-server';\nimport * as fs from '@dereekb/firebase-server';\nexport const a = wad({ fn: async () => 1 }) as any;\nexport const b = (fs.withApiDetails({ mcp: { readOnly: true }, fn: async () => 1 }));"
      },
      'unset(no-mcp), declared(true)'
    ],
    [
      'an upstream import, an inline-built handler, a factory-built const and a plain function',
      {
        [CRUD]: invokeMap("import { up } from '@dereekb/firebase-server/model';\nimport { f, g } from '../thing/thing.invoke';", 'up, inline: makeHandler({}), f, g'),
        [INVOKE]: 'export const f = makeInvoke({ fn: async () => 1 });\nexport const g = async () => 1;'
      },
      'unresolved, unresolved, unresolved, noApiDetails'
    ],
    [
      'an export * barrel, an export-list alias, a named re-export and a const alias hop',
      {
        [CRUD]: invokeMap("import { a, b, c, d } from '../thing';", 'a, b, c, d'),
        'src/app/function/thing/index.ts': "export * from './a';\nexport { cImpl as c } from './c';\nexport { d } from './d';\nexport { b } from './b';",
        'src/app/function/thing/a.ts': `${WITH_API_DETAILS}export const a = withApiDetails({ mcp: { readOnly: true }, fn: async () => 1 });`,
        'src/app/function/thing/b.ts': `${WITH_API_DETAILS}const impl = withApiDetails({ fn: async () => 1 });\nexport { impl as b };`,
        'src/app/function/thing/c.ts': `${WITH_API_DETAILS}export const cImpl = withApiDetails({ mcp: { readOnly: false }, fn: async () => 1 });`,
        'src/app/function/thing/d.ts': `${WITH_API_DETAILS}const real = withApiDetails({ fn: async () => 1 });\nexport const d = real;`
      },
      'declared(true), unset(no-mcp), declared(false), unset(no-mcp)'
    ],
    [
      'a relative import outside the scanned folder is unresolved; a .js specifier is followed',
      {
        [CRUD]: invokeMap("import { a } from '../../common/a';\nimport { b } from '../thing/b.js';", 'a, b'),
        'src/app/function/thing/b.ts': `${WITH_API_DETAILS}export const b = withApiDetails({ fn: async () => 1 });`
      },
      'unresolved, unset(no-mcp)'
    ],
    [
      'string-literal keys are read; a computed key is unresolved',
      {
        [CRUD]: invokeMap("import { a, b } from '../thing/thing.invoke';", 'a, b'),
        [INVOKE]: `${WITH_API_DETAILS}const k = 'mcp';\nexport const a = withApiDetails({ 'mcp': { 'readOnly': true }, fn: async () => 1 });\nexport const b = withApiDetails({ [k]: {}, fn: async () => 1 });`
      },
      'declared(true), unresolved'
    ],
    [
      'a shorthand specifier through an aliased import, past an unrelated same-named local',
      {
        [CRUD]: "import { a as healthCheck } from '../thing/thing.invoke';\nfunction wrap() { const healthCheck = 1; return healthCheck; }\nexport const DEMO_INVOKE_MODEL_MAP = {\n  thing: onCallSpecifierHandler({ healthCheck })\n};\n",
        [INVOKE]: `${WITH_API_DETAILS}export const a = withApiDetails({ mcp: { readOnly: true }, fn: async () => 1 });`
      },
      'declared(true)'
    ],
    [
      'let declarations are not followed',
      {
        [CRUD]: invokeMap("import { a, b } from '../thing/thing.invoke';", 'a, b'),
        [INVOKE]: `${WITH_API_DETAILS}let config = { mcp: { readOnly: true }, fn: async () => 1 };\nexport const a = withApiDetails(config);\nexport let b = withApiDetails({ mcp: { readOnly: true }, fn: async () => 1 });`
      },
      'unresolved, unresolved'
    ],
    [
      'two export * barrels that both supply the name conflict',
      {
        [CRUD]: invokeMap("import { a } from '../thing';", 'a'),
        'src/app/function/thing/index.ts': "export * from './x';\nexport * from './y';",
        'src/app/function/thing/x.ts': `${WITH_API_DETAILS}export const a = withApiDetails({ mcp: { readOnly: true }, fn: async () => 1 });`,
        'src/app/function/thing/y.ts': `${WITH_API_DETAILS}export const a = withApiDetails({ fn: async () => 1 });`
      },
      'unresolved'
    ],
    [
      'a default import of an export default name',
      {
        [CRUD]: invokeMap("import h from '../thing/h';", 'a: h'),
        'src/app/function/thing/h.ts': `${WITH_API_DETAILS}const x = withApiDetails({ mcp: { readOnly: true }, fn: async () => 1 });\nexport default x;`
      },
      'declared(true)'
    ],
    [
      'a member of a namespace import is unresolved',
      {
        [CRUD]: invokeMap("import * as handlers from '../thing/thing.invoke';", 'a: handlers.a'),
        [INVOKE]: `${WITH_API_DETAILS}export const a = withApiDetails({ mcp: { readOnly: true }, fn: async () => 1 });`
      },
      'unresolved'
    ]
  ])('%s', (_label, files, expected) => {
    expect(statusesOf(files)).toBe(expected);
  });

  it('cites the handler declaration', () => {
    const entries = extract({
      [CRUD]: invokeMap("import { a } from '../thing/thing.invoke';", 'a'),
      [INVOKE]: `${WITH_API_DETAILS}\n/**\n * Docs.\n */\nexport const a = withApiDetails({\n  fn: async () => 1\n});`
    });
    expect(entries[0].mcpReadOnly).toEqual({ kind: 'unset', hasMcp: false, declarationSource: `${API_DIR}/${INVOKE}:6` });
  });

  it('gives a reason for an unresolved handler', () => {
    const entries = extract({ [CRUD]: invokeMap("import { up } from '@dereekb/firebase-server/model';", 'up') });
    expect(entries[0].mcpReadOnly).toEqual({ kind: 'unresolved', reason: 'imported from `@dereekb/firebase-server/model`' });
  });

  it('does not read mcp.readOnly for handlers whose call type decides', () => {
    const entries = extract({
      [CRUD]: "import { thingUpdate } from '../thing/thing.update';\nexport const DEMO_UPDATE_MODEL_MAP = {\n  thing: thingUpdate\n};\n",
      'src/app/function/thing/thing.update.ts': `${WITH_API_DETAILS}export const thingUpdate = withApiDetails({ fn: async () => 1 });`
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].verb).toBe('update');
    expect(entries[0].mcpReadOnly).toBeUndefined();
  });

  it('reports a missing handler map', () => {
    const result = extractHandlerEntriesFromFiles({ files: [{ relPath: INVOKE, text: 'export const a = 1;' }], apiAbs: '/abs/x-api', apiDir: API_DIR });
    expect(result.status.kind).toBe('missing');
    expect(result.entries).toHaveLength(0);
  });
});
