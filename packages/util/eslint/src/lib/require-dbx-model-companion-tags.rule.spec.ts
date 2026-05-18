import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { UTIL_ESLINT_PLUGIN } from './plugin';

function buildConfig(): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
      plugins: { 'dereekb-util': UTIL_ESLINT_PLUGIN as any },
      rules: { 'dereekb-util/require-dbx-model-companion-tags': 'error' }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(), { filename: 'test.ts' }).filter((m) => m.ruleId === 'dereekb-util/require-dbx-model-companion-tags');
}

function messagesById(messages: Linter.LintMessage[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of messages) out[m.messageId ?? 'unknown'] = (out[m.messageId ?? 'unknown'] ?? 0) + 1;
  return out;
}

describe('require-dbx-model-companion-tags rule', () => {
  it('passes on canonical @dbxModel interface', () => {
    const errors = lintCode(`
/**
 * @dbxModel
 */
export interface Foo { id: string; }
`);
    expect(errors).toHaveLength(0);
  });

  it('flags mutually exclusive markers', () => {
    const errors = lintCode(`
/**
 * @dbxModel
 * @dbxModelSubObject
 */
export interface Foo { id: string; }
`);
    expect(messagesById(errors).mutuallyExclusiveMarkers).toBe(1);
  });

  it('flags archetype with non-kebab slug', () => {
    const errors = lintCode(`
/**
 * @dbxModel
 * @dbxModelArchetype FooBar
 */
export interface Foo { id: string; }
`);
    expect(messagesById(errors).archetypeBadSlug).toBe(1);
  });

  it('flags archetype with malformed axis pair', () => {
    const errors = lintCode(`
/**
 * @dbxModel
 * @dbxModelArchetype foo-bar key=
 */
export interface Foo { id: string; }
`);
    expect(messagesById(errors).archetypeBadAxisPair).toBe(1);
  });

  it('flags aggregatesFrom non-pascal', () => {
    const errors = lintCode(`
/**
 * @dbxModel
 * @dbxModelAggregatesFrom userProfile
 */
export interface Foo { id: string; }
`);
    expect(messagesById(errors).aggregatesFromNotPascalCase).toBe(1);
  });

  it('flags compositeKey missing encoding', () => {
    const errors = lintCode(`
/**
 * @dbxModel
 * @dbxModelCompositeKey from=A,B
 */
export interface Foo { id: string; }
`);
    expect(messagesById(errors).compositeKeyMissingEncoding).toBe(1);
  });

  it('flags compositeKey invalid encoding', () => {
    const errors = lintCode(`
/**
 * @dbxModel
 * @dbxModelCompositeKey from=A encoding=three-way
 */
export interface Foo { id: string; }
`);
    expect(messagesById(errors).compositeKeyInvalidEncoding).toBe(1);
  });

  it('flags @dbxModelVariable on interface JSDoc', () => {
    const errors = lintCode(`
/**
 * @dbxModel
 * @dbxModelVariable long-name
 */
export interface Foo { id: string; }
`);
    expect(messagesById(errors).variableTagOutsideProperty).toBe(1);
  });

  it('flags unknown companion typo', () => {
    const errors = lintCode(`
/**
 * @dbxModel
 * @dbxModelKategory misc
 */
export interface Foo { id: string; }
`);
    expect(messagesById(errors).unknownDbxModelTag).toBe(1);
  });
});
