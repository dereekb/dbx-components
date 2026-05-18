import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { UTIL_ESLINT_PLUGIN } from './plugin';

function buildConfig(options?: Record<string, unknown>): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: {
        parser: tsParser,
        parserOptions: { ecmaVersion: 2022, sourceType: 'module' }
      },
      plugins: { 'dereekb-util': UTIL_ESLINT_PLUGIN as any },
      rules: {
        'dereekb-util/require-dbx-pipe-companion-tags': options === undefined ? 'error' : ['error', options]
      }
    }
  ];
}

function lintCode(code: string, options?: Record<string, unknown>): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(options), { filename: 'test.ts' }).filter((m) => m.ruleId === 'dereekb-util/require-dbx-pipe-companion-tags');
}

function messagesById(messages: Linter.LintMessage[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of messages) {
    out[m.messageId ?? 'unknown'] = (out[m.messageId ?? 'unknown'] ?? 0) + 1;
  }
  return out;
}

describe('require-dbx-pipe-companion-tags rule', () => {
  it('passes on canonical @dbxPipe class', () => {
    const errors = lintCode(`
/**
 * Formats a value.
 *
 * @dbxPipe
 * @dbxPipeSlug format-value
 * @dbxPipeCategory value
 * @dbxPipeRelated other-pipe, third-pipe
 */
export class FormatValuePipe {}
`);
    expect(errors).toHaveLength(0);
  });

  it('flags missing @dbxPipeSlug', () => {
    const errors = lintCode(`
/**
 * @dbxPipe
 * @dbxPipeCategory value
 */
export class FooPipe {}
`);
    expect(messagesById(errors).missingSlug).toBe(1);
  });

  it('flags missing @dbxPipeCategory', () => {
    const errors = lintCode(`
/**
 * @dbxPipe
 * @dbxPipeSlug foo
 */
export class FooPipe {}
`);
    expect(messagesById(errors).missingCategory).toBe(1);
  });

  it('flags invalid category enum', () => {
    const errors = lintCode(`
/**
 * @dbxPipe
 * @dbxPipeSlug foo
 * @dbxPipeCategory value-formatter
 */
export class FooPipe {}
`);
    expect(messagesById(errors).invalidCategory).toBe(1);
  });

  it('flags non-kebab slug', () => {
    const errors = lintCode(`
/**
 * @dbxPipe
 * @dbxPipeSlug FooPipe
 * @dbxPipeCategory value
 */
export class FooPipe {}
`);
    expect(messagesById(errors).invalidSlugFormat).toBe(1);
  });

  it('flags camelCase related entry', () => {
    const errors = lintCode(`
/**
 * @dbxPipe
 * @dbxPipeSlug foo
 * @dbxPipeCategory value
 * @dbxPipeRelated otherPipe
 */
export class FooPipe {}
`);
    expect(messagesById(errors).relatedNotKebab).toBe(1);
  });

  it('flags unknown companion (typo)', () => {
    const errors = lintCode(`
/**
 * @dbxPipe
 * @dbxPipeSlug foo
 * @dbxPipeCategory value
 * @dbxPipeKategory date
 */
export class FooPipe {}
`);
    expect(messagesById(errors).unknownDbxPipeTag).toBe(1);
  });

  it('flags duplicate @dbxPipeCategory', () => {
    const errors = lintCode(`
/**
 * @dbxPipe
 * @dbxPipeSlug foo
 * @dbxPipeCategory value
 * @dbxPipeCategory date
 */
export class FooPipe {}
`);
    expect(messagesById(errors).duplicateCompanionTag).toBe(1);
  });

  it('does not trigger on plain functions without @dbxPipe', () => {
    const errors = lintCode(`
/**
 * Not a pipe.
 *
 * @param x - the value.
 */
function foo(x: number): number { return x; }
`);
    expect(errors).toHaveLength(0);
  });
});
