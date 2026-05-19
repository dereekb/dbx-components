import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { FIREBASE_REQUIRE_DBX_MODEL_FIREBASE_INDEX_DISPATCHER_USES_TAGGED_QUERIES_RULE } from './require-dbx-model-firebase-index-dispatcher-uses-tagged-queries.rule';

const RULE_ID = 'dereekb-firebase/require-dbx-model-firebase-index-dispatcher-uses-tagged-queries';

function buildConfig(): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
      plugins: { 'dereekb-firebase': { rules: { 'require-dbx-model-firebase-index-dispatcher-uses-tagged-queries': FIREBASE_REQUIRE_DBX_MODEL_FIREBASE_INDEX_DISPATCHER_USES_TAGGED_QUERIES_RULE } } as any },
      rules: { [RULE_ID]: 'error' }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(), { filename: 'test.ts' }).filter((m) => m.ruleId === RULE_ID);
}

describe('require-dbx-model-firebase-index-dispatcher-uses-tagged-queries rule', () => {
  it('allows a dispatcher that returns another tagged query factory result directly', () => {
    const errors = lintCode(`
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 * @dbxModelFirebaseIndexDispatcher
 */
export function fooDispatcherQuery(mode: 'a' | 'b') {
  return mode === 'a' ? fooAQuery({}) : fooBQuery({});
}
`);
    expect(errors).toHaveLength(0);
  });

  it('allows a dispatcher that spreads multiple tagged factories into an array literal', () => {
    const errors = lintCode(`
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 * @dbxModelFirebaseIndexDispatcher
 */
export function fooDispatcherQuery() {
  return [...fooAQuery({}), ...fooBQuery({})];
}
`);
    expect(errors).toHaveLength(0);
  });

  it('allows a dispatcher with a conditional expression between tagged factories', () => {
    const errors = lintCode(`
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 * @dbxModelFirebaseIndexDispatcher
 */
export function fooDispatcherQuery(input: { readonly mode: boolean }) {
  return input.mode ? fooAQuery({}) : fooBQuery({});
}
`);
    expect(errors).toHaveLength(0);
  });

  it('flags an inline where() call inside a dispatcher', () => {
    const errors = lintCode(`
import { where } from '@dereekb/firebase';
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 * @dbxModelFirebaseIndexDispatcher
 */
export function fooDispatcherQuery() {
  return [where('field', '==', 1)];
}
`);
    expect(errors).toHaveLength(1);
    expect(errors[0].messageId).toBe('dispatcherUsesInlineConstraint');
  });

  it('flags ad-hoc constraint-array construction (empty [] + .push(where(...)))', () => {
    const errors = lintCode(`
import { where, type FirestoreQueryConstraint } from '@dereekb/firebase';
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 * @dbxModelFirebaseIndexDispatcher
 */
export function fooDispatcherQuery() {
  const c: FirestoreQueryConstraint[] = [];
  c.push(where('field', '==', 1));
  return c;
}
`);
    const messageIds = errors.map((e) => e.messageId).sort();
    expect(messageIds).toEqual(['dispatcherBuildsConstraintArray', 'dispatcherUsesInlineConstraint']);
  });

  it('does not fire on a non-dispatcher tagged factory (no @dbxModelFirebaseIndexDispatcher tag)', () => {
    const errors = lintCode(`
import { where } from '@dereekb/firebase';
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 */
export function fooQuery() {
  return [where('field', '==', 1)];
}
`);
    expect(errors).toHaveLength(0);
  });

  it('does not fire when @dbxModelFirebaseIndexDispatcher is explicitly false', () => {
    const errors = lintCode(`
import { where } from '@dereekb/firebase';
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 * @dbxModelFirebaseIndexDispatcher false
 */
export function fooQuery() {
  return [where('field', '==', 1)];
}
`);
    expect(errors).toHaveLength(0);
  });

  it('does not fire on an untagged function that builds constraints', () => {
    const errors = lintCode(`
import { where, type FirestoreQueryConstraint } from '@dereekb/firebase';
export function fooBuilder() {
  const c: FirestoreQueryConstraint[] = [];
  c.push(where('field', '==', 1));
  return c;
}
`);
    expect(errors).toHaveLength(0);
  });

  it('handles arrow expressions assigned to a const tagged as a dispatcher', () => {
    const errors = lintCode(`
import { where } from '@dereekb/firebase';
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 * @dbxModelFirebaseIndexDispatcher
 */
export const fooDispatcherQuery = () => [where('field', '==', 1)];
`);
    expect(errors).toHaveLength(1);
    expect(errors[0].messageId).toBe('dispatcherUsesInlineConstraint');
  });

  it('honors renamed imports (where as fbWhere) inside a dispatcher', () => {
    const errors = lintCode(`
import { where as fbWhere } from '@dereekb/firebase';
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 * @dbxModelFirebaseIndexDispatcher
 */
export function fooDispatcherQuery() {
  return [fbWhere('a', '==', 1)];
}
`);
    expect(errors).toHaveLength(1);
    expect(errors[0].messageId).toBe('dispatcherUsesInlineConstraint');
  });

  it('ignores constraint-named imports from non-@dereekb/firebase modules', () => {
    const errors = lintCode(`
import { where } from 'some-other-lib';
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 * @dbxModelFirebaseIndexDispatcher
 */
export function fooDispatcherQuery() {
  return [where('a', '==', 1)];
}
`);
    expect(errors).toHaveLength(0);
  });
});
