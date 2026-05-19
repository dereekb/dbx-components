import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { FIREBASE_REQUIRE_TAGGED_FIRESTORE_CONSTRAINTS_RULE } from './require-tagged-firestore-constraints.rule';

const RULE_ID = 'dereekb-firebase/require-tagged-firestore-constraints';

function buildConfig(): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
      plugins: { 'dereekb-firebase': { rules: { 'require-tagged-firestore-constraints': FIREBASE_REQUIRE_TAGGED_FIRESTORE_CONSTRAINTS_RULE } } as any },
      rules: { [RULE_ID]: 'error' }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(), { filename: 'test.ts' }).filter((m) => m.ruleId === RULE_ID);
}

describe('require-tagged-firestore-constraints rule', () => {
  it('allows where() inside a @dbxModelFirebaseIndex-tagged function declaration', () => {
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

  it('allows where() inside a nested arrow inside a tagged function', () => {
    const errors = lintCode(`
import { where } from '@dereekb/firebase';
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 */
export function fooQuery() {
  const constraints = ['a'].map((k) => where('field', '==', k));
  return constraints;
}
`);
    expect(errors).toHaveLength(0);
  });

  it('flags where() inside an untagged constraintsForRegion callback', () => {
    const errors = lintCode(`
import { where } from '@dereekb/firebase';
export function useFooBuilder() {
  return {
    constraintsForRegion: (regionKey: string) => regionKey ? [] : [where('iw', 'array-contains-any', ['a'])]
  };
}
`);
    expect(errors).toHaveLength(1);
    expect(errors[0].messageId).toBe('inlineConstraintOutsideTaggedQuery');
  });

  it('flags top-level where() outside any function', () => {
    const errors = lintCode(`
import { where } from '@dereekb/firebase';
export const c = [where('a', '==', 1)];
`);
    expect(errors).toHaveLength(1);
  });

  it('flags where() inside an untagged *Filter-named function', () => {
    const errors = lintCode(`
import { where } from '@dereekb/firebase';
export function fooFilter() {
  return [where('a', '==', 1)];
}
`);
    expect(errors).toHaveLength(1);
  });

  it('honors renamed imports (import { where as fbWhere })', () => {
    const errors = lintCode(`
import { where as fbWhere } from '@dereekb/firebase';
export function fooFilter() {
  return [fbWhere('a', '==', 1)];
}
`);
    expect(errors).toHaveLength(1);
    expect(errors[0].messageId).toBe('inlineConstraintOutsideTaggedQuery');
  });

  it('ignores where imports from non-@dereekb/firebase modules', () => {
    const errors = lintCode(`
import { where } from 'some-other-lib';
export function fooFilter() {
  return [where('a', '==', 1)];
}
`);
    expect(errors).toHaveLength(0);
  });

  it('flags orderBy() the same way as where()', () => {
    const errors = lintCode(`
import { orderBy } from '@dereekb/firebase';
export function fooFilter() {
  return [orderBy('a', 'asc')];
}
`);
    expect(errors).toHaveLength(1);
  });

  it('does NOT flag pagination/cursor constraints (limit, startAfter, endAt, whereDocumentId) outside a tagged factory', () => {
    const errors = lintCode(`
import { limit, limitToLast, startAt, startAfter, endAt, endBefore, whereDocumentId } from '@dereekb/firebase';
export function buildPagination(cursor: unknown) {
  return [limit(10), limitToLast(5), startAt(cursor), startAfter(cursor), endAt(cursor), endBefore(cursor), whereDocumentId('==', 'id')];
}
`);
    expect(errors).toHaveLength(0);
  });

  it('mirrors a generic pagination helper that appends cursor + limit onto caller-supplied constraints', () => {
    const errors = lintCode(`
import { limit, startAfter, type FirestoreQueryConstraint } from '@dereekb/firebase';
export function appendPagination(constraints: FirestoreQueryConstraint[], cursor: unknown, max: number) {
  if (cursor) {
    constraints.push(startAfter(cursor));
  }
  constraints.push(limit(max + 1));
  return constraints;
}
`);
    expect(errors).toHaveLength(0);
  });

  it('still flags where() and orderBy() in a pagination-style helper (they are index-affecting)', () => {
    const errors = lintCode(`
import { where, orderBy, limit, type FirestoreQueryConstraint } from '@dereekb/firebase';
export function appendBadConstraints(constraints: FirestoreQueryConstraint[]) {
  constraints.push(where('field', '==', 1));
  constraints.push(orderBy('field', 'asc'));
  constraints.push(limit(10));
  return constraints;
}
`);
    expect(errors).toHaveLength(2);
  });

  it('allows index-affecting + pagination constraints together inside a tagged factory', () => {
    const errors = lintCode(`
import { where, orderBy, limit } from '@dereekb/firebase';
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 */
export function fooQuery() {
  return [where('a', '==', 1), orderBy('a', 'asc'), limit(10)];
}
`);
    expect(errors).toHaveLength(0);
  });

  it('allows arrow assigned to const with marker tag', () => {
    const errors = lintCode(`
import { where } from '@dereekb/firebase';
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 */
export const fooQuery = () => [where('a', '==', 1)];
`);
    expect(errors).toHaveLength(0);
  });
});
