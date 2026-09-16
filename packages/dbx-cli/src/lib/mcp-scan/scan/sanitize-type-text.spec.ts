import { describe, expect, it } from 'vitest';
import { sanitizeTypeText } from './sanitize-type-text.js';

const WORKSPACE_ROOT = '/Users/someone/development/git/dbcomponents';

describe('sanitizeTypeText()', () => {
  it('rewrites a workspace-internal absolute import path to a relative one', () => {
    const result = sanitizeTypeText({
      typeText: `const filterMaybeArrayValues: import("${WORKSPACE_ROOT}/packages/util/src/lib/array/array.value").UniversalFilterMaybeArrayFunction`,
      workspaceRoot: WORKSPACE_ROOT
    });
    expect(result).toBe('const filterMaybeArrayValues: import("packages/util/src/lib/array/array.value").UniversalFilterMaybeArrayFunction');
  });

  it('produces identical output for two checkouts of the same workspace', () => {
    const hostRoot = '/Users/someone/development/git/dbcomponents';
    const containerRoot = '/code';
    const subpath = '/packages/firebase/src/lib/common/firestore/accessor/document';
    const fromHost = sanitizeTypeText({ typeText: `import("${hostRoot}${subpath}").FirestoreDocumentData<D>`, workspaceRoot: hostRoot });
    const fromContainer = sanitizeTypeText({ typeText: `import("${containerRoot}${subpath}").FirestoreDocumentData<D>`, workspaceRoot: containerRoot });
    expect(fromHost).toBe(fromContainer);
  });

  it('rewrites every occurrence in one type text', () => {
    const result = sanitizeTypeText({
      typeText: `(a: import("${WORKSPACE_ROOT}/packages/util/src/a").A, b: import("${WORKSPACE_ROOT}/packages/util/src/b").B) => void`,
      workspaceRoot: WORKSPACE_ROOT
    });
    expect(result).toBe('(a: import("packages/util/src/a").A, b: import("packages/util/src/b").B) => void');
  });

  it('leaves type text without an inline import untouched', () => {
    const typeText = 'const escapeStringForRegex: EscapeStringCharactersFunction';
    expect(sanitizeTypeText({ typeText, workspaceRoot: WORKSPACE_ROOT })).toBe(typeText);
  });

  it('leaves an already-relative import path untouched', () => {
    const typeText = 'import("./local/thing").Thing';
    expect(sanitizeTypeText({ typeText, workspaceRoot: WORKSPACE_ROOT })).toBe(typeText);
  });

  it('leaves a path outside the workspace untouched rather than emitting a ../ chain', () => {
    const typeText = 'import("/opt/elsewhere/pkg/index").Thing';
    expect(sanitizeTypeText({ typeText, workspaceRoot: WORKSPACE_ROOT })).toBe(typeText);
  });
});
