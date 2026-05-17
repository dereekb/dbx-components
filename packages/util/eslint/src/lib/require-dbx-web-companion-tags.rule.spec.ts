import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { utilEslintPlugin } from './plugin';

function buildConfig(): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tsParser as any, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
      plugins: { 'dereekb-util': utilEslintPlugin as any },
      rules: { 'dereekb-util/require-dbx-web-companion-tags': 'error' }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(), { filename: 'test.ts' }).filter((m) => m.ruleId === 'dereekb-util/require-dbx-web-companion-tags');
}

function messagesById(messages: Linter.LintMessage[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of messages) out[m.messageId ?? 'unknown'] = (out[m.messageId ?? 'unknown'] ?? 0) + 1;
  return out;
}

describe('require-dbx-web-companion-tags rule', () => {
  it('passes on canonical @dbxWebComponent class', () => {
    const errors = lintCode(`
/**
 * @dbxWebComponent
 * @dbxWebSlug dbx-foo
 * @dbxWebCategory layout
 */
export class DbxFooComponent {}
`);
    expect(errors).toHaveLength(0);
  });

  it('flags missing slug', () => {
    const errors = lintCode(`
/**
 * @dbxWebComponent
 * @dbxWebCategory layout
 */
export class DbxFooComponent {}
`);
    expect(messagesById(errors).missingSlug).toBe(1);
  });

  it('flags missing category', () => {
    const errors = lintCode(`
/**
 * @dbxWebComponent
 * @dbxWebSlug dbx-foo
 */
export class DbxFooComponent {}
`);
    expect(messagesById(errors).missingCategory).toBe(1);
  });

  it('flags invalid category', () => {
    const errors = lintCode(`
/**
 * @dbxWebComponent
 * @dbxWebSlug dbx-foo
 * @dbxWebCategory invalid-category
 */
export class DbxFooComponent {}
`);
    expect(messagesById(errors).invalidCategory).toBe(1);
  });

  it('flags invalid kind enum', () => {
    const errors = lintCode(`
/**
 * @dbxWebComponent
 * @dbxWebSlug dbx-foo
 * @dbxWebCategory layout
 * @dbxWebKind helper
 */
export class DbxFooComponent {}
`);
    expect(messagesById(errors).invalidKind).toBe(1);
  });

  it('flags unknown companion typo', () => {
    const errors = lintCode(`
/**
 * @dbxWebComponent
 * @dbxWebSlug dbx-foo
 * @dbxWebCategory layout
 * @dbxWebKategory navigation
 */
export class DbxFooComponent {}
`);
    expect(messagesById(errors).unknownDbxWebTag).toBe(1);
  });

  it('flags duplicate companion', () => {
    const errors = lintCode(`
/**
 * @dbxWebComponent
 * @dbxWebSlug dbx-foo
 * @dbxWebCategory layout
 * @dbxWebCategory text
 */
export class DbxFooComponent {}
`);
    expect(messagesById(errors).duplicateCompanionTag).toBe(1);
  });

  it('does not trigger on untagged class', () => {
    const errors = lintCode(`
/**
 * Plain class.
 */
export class FooComponent {}
`);
    expect(errors).toHaveLength(0);
  });
});
