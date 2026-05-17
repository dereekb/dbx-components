import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { utilEslintPlugin } from './plugin';

function buildConfig(): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tsParser as any, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
      plugins: { 'dereekb-util': utilEslintPlugin as any },
      rules: { 'dereekb-util/require-dbx-docs-ui-example-companion-tags': 'error' }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(), { filename: 'test.ts' }).filter((m) => m.ruleId === 'dereekb-util/require-dbx-docs-ui-example-companion-tags');
}

function messagesById(messages: Linter.LintMessage[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of messages) out[m.messageId ?? 'unknown'] = (out[m.messageId ?? 'unknown'] ?? 0) + 1;
  return out;
}

describe('require-dbx-docs-ui-example-companion-tags rule', () => {
  it('passes on canonical example class', () => {
    const errors = lintCode(`
/**
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug button-with-icon
 * @dbxDocsUiExampleCategory button
 * @dbxDocsUiExampleSummary Demonstrates a button with an icon.
 */
export class ButtonWithIconExampleComponent {}
`);
    expect(errors).toHaveLength(0);
  });

  it('flags missing slug, category, summary', () => {
    const errors = lintCode(`
/**
 * @dbxDocsUiExample
 */
export class FooExampleComponent {}
`);
    const counts = messagesById(errors);
    expect(counts.missingSlug).toBe(1);
    expect(counts.missingCategory).toBe(1);
    expect(counts.missingSummary).toBe(1);
  });

  it('flags invalid category enum', () => {
    const errors = lintCode(`
/**
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug foo
 * @dbxDocsUiExampleCategory invalid-thing
 * @dbxDocsUiExampleSummary summary
 */
export class FooExampleComponent {}
`);
    expect(messagesById(errors).invalidCategory).toBe(1);
  });

  it('flags non-kebab related', () => {
    const errors = lintCode(`
/**
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug foo
 * @dbxDocsUiExampleCategory button
 * @dbxDocsUiExampleSummary summary
 * @dbxDocsUiExampleRelated camelCaseThing
 */
export class FooExampleComponent {}
`);
    expect(messagesById(errors).relatedNotKebab).toBe(1);
  });

  it('allows multiple @dbxDocsUiExampleUses without duplicate flag', () => {
    const errors = lintCode(`
/**
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug foo
 * @dbxDocsUiExampleCategory button
 * @dbxDocsUiExampleSummary summary
 * @dbxDocsUiExampleUses FooComponent component
 * @dbxDocsUiExampleUses BarComponent component
 */
export class FooExampleComponent {}
`);
    expect(messagesById(errors).duplicateCompanionTag ?? 0).toBe(0);
  });

  it('flags unknown companion typo', () => {
    const errors = lintCode(`
/**
 * @dbxDocsUiExample
 * @dbxDocsUiExampleSlug foo
 * @dbxDocsUiExampleCategory button
 * @dbxDocsUiExampleSummary summary
 * @dbxDocsUiExampleKategory text
 */
export class FooExampleComponent {}
`);
    expect(messagesById(errors).unknownDbxDocsUiExampleTag).toBe(1);
  });
});
