import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { utilEslintPlugin } from './plugin';

function buildConfig(): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tsParser as any, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
      plugins: { 'dereekb-util': utilEslintPlugin as any },
      rules: { 'dereekb-util/require-dbx-filter-companion-tags': 'error' }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(), { filename: 'test.ts' }).filter((m) => m.ruleId === 'dereekb-util/require-dbx-filter-companion-tags');
}

function messagesById(messages: Linter.LintMessage[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of messages) out[m.messageId ?? 'unknown'] = (out[m.messageId ?? 'unknown'] ?? 0) + 1;
  return out;
}

describe('require-dbx-filter-companion-tags rule', () => {
  it('passes on canonical filter directive class', () => {
    const errors = lintCode(`
/**
 * @dbxFilter
 * @dbxFilterSlug job-status-filter
 */
export class JobStatusFilterDirective {}
`);
    expect(errors).toHaveLength(0);
  });

  it('passes on filter pattern interface', () => {
    const errors = lintCode(`
/**
 * @dbxFilter
 * @dbxFilterSlug job-status-filter
 */
export interface JobStatusFilter {}
`);
    expect(errors).toHaveLength(0);
  });

  it('flags missing slug', () => {
    const errors = lintCode(`
/**
 * @dbxFilter
 */
export class FooFilter {}
`);
    expect(messagesById(errors).missingSlug).toBe(1);
  });

  it('flags non-kebab slug', () => {
    const errors = lintCode(`
/**
 * @dbxFilter
 * @dbxFilterSlug FooFilter
 */
export class FooFilter {}
`);
    expect(messagesById(errors).invalidSlugFormat).toBe(1);
  });

  it('flags non-kebab related entry', () => {
    const errors = lintCode(`
/**
 * @dbxFilter
 * @dbxFilterSlug foo
 * @dbxFilterRelated camelCaseThing, other-thing
 */
export class FooFilter {}
`);
    expect(messagesById(errors).relatedNotKebab).toBe(1);
  });

  it('flags unknown companion', () => {
    const errors = lintCode(`
/**
 * @dbxFilter
 * @dbxFilterSlug foo
 * @dbxFilterCategory bar
 */
export class FooFilter {}
`);
    expect(messagesById(errors).unknownDbxFilterTag).toBe(1);
  });
});
