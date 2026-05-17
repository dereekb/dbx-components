import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { utilEslintPlugin } from './plugin';

function buildConfig(): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tsParser as any, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
      plugins: { 'dereekb-util': utilEslintPlugin as any },
      rules: { 'dereekb-util/require-dbx-model-firebase-index-companion-tags': 'error' }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(), { filename: 'test.ts' }).filter((m) => m.ruleId === 'dereekb-util/require-dbx-model-firebase-index-companion-tags');
}

function fixCode(code: string): string {
  const linter = new Linter({ configType: 'flat' });
  return linter.verifyAndFix(code, buildConfig(), { filename: 'test.ts' }).output;
}

function messagesById(messages: Linter.LintMessage[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of messages) out[m.messageId ?? 'unknown'] = (out[m.messageId ?? 'unknown'] ?? 0) + 1;
  return out;
}

describe('require-dbx-model-firebase-index-companion-tags rule', () => {
  it('passes on canonical factory', () => {
    const errors = lintCode(`
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel JobLocation
 */
export function jobLocationByStatus() {}
`);
    expect(errors).toHaveLength(0);
  });

  it('flags missing model', () => {
    const errors = lintCode(`
/**
 * @dbxModelFirebaseIndex
 */
export function jobLocationByStatus() {}
`);
    expect(messagesById(errors).missingModel).toBe(1);
  });

  it('flags non-pascal model identifier', () => {
    const errors = lintCode(`
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel job-location
 */
export function foo() {}
`);
    expect(messagesById(errors).invalidModelIdentifier).toBe(1);
  });

  it('flags invalid scope', () => {
    const errors = lintCode(`
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 * @dbxModelFirebaseIndexScope COLLECTION_BANANA
 */
export function foo() {}
`);
    expect(messagesById(errors).invalidScope).toBe(1);
  });

  it('allows multiple @dbxModelFirebaseIndexPath without duplicate flag', () => {
    const errors = lintCode(`
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 * @dbxModelFirebaseIndexPath fieldA, fieldB
 * @dbxModelFirebaseIndexPath fieldC, fieldD
 */
export function foo() {}
`);
    expect(messagesById(errors).duplicateCompanionTag ?? 0).toBe(0);
  });

  it('auto-fixes uppercase tags to lowercase', () => {
    const fixed = fixCode(`
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 * @dbxModelFirebaseIndexTags Bar, Baz
 */
export function foo() {}
`);
    expect(fixed).toContain('@dbxModelFirebaseIndexTags bar, baz');
  });

  it('flags unknown companion typo', () => {
    const errors = lintCode(`
/**
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel Foo
 * @dbxModelFirebaseIndexKategory misc
 */
export function foo() {}
`);
    expect(messagesById(errors).unknownDbxModelFirebaseIndexTag).toBe(1);
  });
});
