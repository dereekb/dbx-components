import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { FIREBASE_REQUIRE_FIRESTORE_CONSTRAINT_TYPE_PARAMETER_RULE } from './require-firestore-constraint-type-parameter.rule';

const RULE_ID = 'dereekb-firebase/require-firestore-constraint-type-parameter';

function buildConfig(): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
      plugins: { 'dereekb-firebase': { rules: { 'require-firestore-constraint-type-parameter': FIREBASE_REQUIRE_FIRESTORE_CONSTRAINT_TYPE_PARAMETER_RULE } } as any },
      rules: { [RULE_ID]: 'error' }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(), { filename: 'test.ts' }).filter((m) => m.ruleId === RULE_ID);
}

describe('require-firestore-constraint-type-parameter rule', () => {
  it('allows where<T>() with a generic type argument', () => {
    const errors = lintCode(`
import { where } from '@dereekb/firebase';
interface Foo { username: string; }
export function fooQuery(username: string) {
  return where<Foo>('username', '==', username);
}
`);
    expect(errors).toHaveLength(0);
  });

  it('allows orderBy<T>() with a generic type argument', () => {
    const errors = lintCode(`
import { orderBy } from '@dereekb/firebase';
interface Foo { createdAt: number; }
export function fooQuery() {
  return orderBy<Foo>('createdAt', 'asc');
}
`);
    expect(errors).toHaveLength(0);
  });

  it('allows where()/orderBy() imported from an unrelated module', () => {
    const errors = lintCode(`
import { where, orderBy } from 'firebase/firestore';
export function fooQuery() {
  return [where('field', '==', 1), orderBy('field')];
}
`);
    expect(errors).toHaveLength(0);
  });

  it('allows a renamed import that includes a type argument', () => {
    const errors = lintCode(`
import { where as fbWhere } from '@dereekb/firebase';
interface Foo { username: string; }
export function fooQuery(username: string) {
  return fbWhere<Foo>('username', '==', username);
}
`);
    expect(errors).toHaveLength(0);
  });

  it('flags where() without a generic type argument', () => {
    const errors = lintCode(`
import { where } from '@dereekb/firebase';
export function fooQuery(username: string) {
  return where('username', '==', username);
}
`);
    expect(errors).toHaveLength(1);
    expect(errors[0].messageId).toBe('missingTypeParameter');
    expect(errors[0].message).toContain('`where(...)`');
  });

  it('flags orderBy() without a generic type argument', () => {
    const errors = lintCode(`
import { orderBy } from '@dereekb/firebase';
export function fooQuery() {
  return orderBy('createdAt', 'asc');
}
`);
    expect(errors).toHaveLength(1);
    expect(errors[0].messageId).toBe('missingTypeParameter');
    expect(errors[0].message).toContain('`orderBy(...)`');
  });

  it('flags a renamed where() without a generic type argument using the imported name', () => {
    const errors = lintCode(`
import { where as fbWhere } from '@dereekb/firebase';
export function fooQuery(username: string) {
  return fbWhere('username', '==', username);
}
`);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('`where(...)`');
  });

  it('flags where() even inside a @dbxModelFirebaseIndex-tagged factory body', () => {
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
    expect(errors).toHaveLength(1);
    expect(errors[0].messageId).toBe('missingTypeParameter');
  });

  it('flags both where and orderBy when neither has a generic', () => {
    const errors = lintCode(`
import { where, orderBy } from '@dereekb/firebase';
export function fooQuery() {
  return [where('field', '==', 1), orderBy('field', 'asc')];
}
`);
    expect(errors).toHaveLength(2);
  });

  it('respects allowedImportSources option', () => {
    const linter = new Linter({ configType: 'flat' });
    const errors = linter
      .verify(
        `
import { where } from 'firebase/firestore';
export function fooQuery() {
  return where('field', '==', 1);
}
`,
        [
          {
            files: ['**/*.ts'],
            languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
            plugins: { 'dereekb-firebase': { rules: { 'require-firestore-constraint-type-parameter': FIREBASE_REQUIRE_FIRESTORE_CONSTRAINT_TYPE_PARAMETER_RULE } } as any },
            rules: { [RULE_ID]: ['error', { allowedImportSources: ['firebase/firestore'] }] }
          }
        ],
        { filename: 'test.ts' }
      )
      .filter((m) => m.ruleId === RULE_ID);
    expect(errors).toHaveLength(1);
  });
});
