import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { FIREBASE_REQUIRE_DBX_MODEL_FIREBASE_INDEX_QUERY_SUFFIX_RULE } from './require-dbx-model-firebase-index-query-suffix.rule';

const RULE_ID = 'dereekb-firebase/require-dbx-model-firebase-index-query-suffix';

function buildConfig(): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
      plugins: { 'dereekb-firebase': { rules: { 'require-dbx-model-firebase-index-query-suffix': FIREBASE_REQUIRE_DBX_MODEL_FIREBASE_INDEX_QUERY_SUFFIX_RULE } } as any },
      rules: { [RULE_ID]: 'error' }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(), { filename: 'test.ts' }).filter((m) => m.ruleId === RULE_ID);
}

describe('require-dbx-model-firebase-index-query-suffix rule', () => {
  it('passes on Query-suffixed declaration with marker tag', () => {
    const errors = lintCode(`
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 */
export function fooBarQuery() {}
`);
    expect(errors).toHaveLength(0);
  });

  it('passes on Query-suffixed arrow assignment with marker tag', () => {
    const errors = lintCode(`
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 */
export const fooQuery = () => [];
`);
    expect(errors).toHaveLength(0);
  });

  it('flags *Filter declaration with marker tag and suggests Query', () => {
    const errors = lintCode(`
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 */
export function fooBarFilter() {}
`);
    expect(errors).toHaveLength(1);
    expect(errors[0].messageId).toBe('queryFactoryNameMustEndWithQuery');
    expect(errors[0].message).toContain('fooBarQuery');
  });

  it('flags *Constraints declaration with marker tag', () => {
    const errors = lintCode(`
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 */
export function fooBarConstraints() {}
`);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('fooBarQuery');
  });

  it('flags *Builder declaration with marker tag', () => {
    const errors = lintCode(`
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 */
export function fooBarBuilder() {}
`);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('fooBarQuery');
  });

  it('ignores untagged functions even with bad suffix', () => {
    const errors = lintCode(`
export function fooBarFilter() {}
`);
    expect(errors).toHaveLength(0);
  });

  it('flags arbitrary unrelated name and suggests Query suffix appended', () => {
    const errors = lintCode(`
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 */
export function fooBarBaz() {}
`);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('fooBarBazQuery');
  });
});
