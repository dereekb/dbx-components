import { describe, expect, it } from 'vitest';
import { Node, SyntaxKind, type Identifier } from 'ts-morph';
import { buildDereekbImportIndex, buildInMemoryProject } from '../_core/_validate/ast.js';
import { buildApiFunctionIndex, resolveApiFunctionReference } from './extract.function-index.js';

/**
 * Resolves the callee of every call in `a.ts` through {@link resolveApiFunctionReference}, in source order.
 *
 * @param files - The API files by path; the calls are read from `a.ts`.
 * @returns `<path>:<line>` of each resolved function, or `ambiguous` / `none`.
 */
function calleesOf(files: Record<string, string>): string[] {
  const { apiSources } = buildInMemoryProject({ component: { files: [] }, api: { files: Object.entries(files).map(([relPath, text]) => ({ relPath, text })) } });
  const index = buildApiFunctionIndex(apiSources);
  const imports = buildDereekbImportIndex(apiSources);
  const file = apiSources.find((x) => x.getFilePath().endsWith('/a.ts'));
  return (file?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? [])
    .map((x) => x.getExpression())
    .filter((x): x is Identifier => Node.isIdentifier(x))
    .map((reference) => {
      const resolution = resolveApiFunctionReference({ reference, index, imports });
      return resolution.kind === 'function' ? `${resolution.entry.relPath}:${resolution.entry.node.getStartLineNumber()}` : resolution.kind;
    });
}

describe('resolveApiFunctionReference()', () => {
  it.each<[string, Record<string, string>, string[]]>([
    ['reads the function its own file declares, not a same-named one of another file', { 'a.ts': 'function build() { return 1; }\nexport function f() { return build(); }', 'b.ts': 'function build() { return 2; }' }, ['a.ts:1']],
    ['reads the function a top-level const of its file holds', { 'a.ts': 'const build = () => 1;\nexport function f() { return build(); }', 'b.ts': 'export function build() { return 2; }' }, ['a.ts:1']],
    ['follows a named import to the file its module specifier names', { 'a.ts': "import { build } from './b';\nexport function f() { return build(); }", 'b.ts': 'export function build() { return 2; }', 'c.ts': 'function build() { return 3; }' }, ['b.ts:1']],
    [
      'follows an aliased import, an index file and a .js specifier',
      { 'a.ts': "import { build as make } from './lib';\nimport { other } from './c.js';\nexport function f() { return [make(), other()]; }", 'lib/index.ts': 'export const build = () => 2;', 'c.ts': 'export function other() { return 3; }' },
      ['lib/index.ts:1', 'c.ts:1']
    ],
    ['follows an import to a function an export list names', { 'a.ts': "import { build } from './b';\nexport function f() { return build(); }", 'b.ts': 'function make() { return 2; }\nexport { make as build };' }, ['b.ts:1']],
    ['reads an import re-exported through a barrel as the one API function exported under its name', { 'a.ts': "import { build } from './lib';\nexport function f() { return build(); }", 'lib/index.ts': "export * from './b';", 'lib/b.ts': 'export function build() { return 2; }' }, ['lib/b.ts:1']],
    ['reads an import of a module the scan cannot read as the one API function exported under its name', { 'a.ts': "import { build } from '@app/b';\nexport function f() { return build(); }", 'b.ts': 'export function build() { return 2; }', 'c.ts': 'function build() { return 3; }' }, ['b.ts:1']],
    ['reads such an import as none when more than one API file exports a function under its name', { 'a.ts': "import { build } from '@app/b';\nexport function f() { return build(); }", 'b.ts': 'export function build() { return 2; }', 'c.ts': 'export function build() { return 3; }' }, ['none']],
    ['reads an import of a module export that holds no function as none', { 'a.ts': "import { build } from './b';\nexport function f() { return build(); }", 'b.ts': 'export const build = [];', 'c.ts': 'export function build() { return 3; }' }, ['none']],
    ['reads an @dereekb/* import as none', { 'a.ts': "import { build } from '@dereekb/firebase-server/model';\nexport function f() { return build(); }", 'b.ts': 'export function build() { return 2; }' }, ['none']],
    [
      'follows a default import to the default export of the file it names',
      { 'a.ts': "import make from './b';\nimport other from './c';\nexport function f() { return [make(), other()]; }", 'b.ts': 'export default function build() { return 2; }', 'c.ts': 'const build = () => 3;\nexport default build;' },
      ['b.ts:1', 'c.ts:1']
    ],
    ['reads a default import of a module the scan cannot read as none', { 'a.ts': "import build from '@app/b';\nexport function f() { return build(); }", 'b.ts': 'export function build() { return 2; }' }, ['none']],
    [
      'reads a parameter, a const holding no function and a nested function as none',
      {
        'a.ts': 'export function f(build: () => number) { return build(); }\nexport function g(ctx: any) { const build = ctx.build; return build(); }\nexport function h() { function build() { return 1; } return build(); }',
        'b.ts': 'export function build() { return 2; }'
      },
      ['none', 'none', 'none']
    ],
    ['reads a name with more than one binding in scope as ambiguous', { 'a.ts': 'function build() { return 1; }\nexport function f() { const build = () => 2; return build(); }' }, ['ambiguous']],
    ['reads an overloaded function as its implementation', { 'a.ts': 'function build(a: string): string;\nfunction build(a: number): number;\nfunction build(a: any) { return a; }\nexport function f() { return build(1); }' }, ['a.ts:3']]
  ])('%s', (_label, files, expected) => {
    expect(calleesOf(files)).toEqual(expected);
  });
});
