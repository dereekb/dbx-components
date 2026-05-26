import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { FIREBASE_REQUIRE_DBX_MODEL_COMPANION_TAGS_RULE } from './require-dbx-model-companion-tags.rule';

const RULE_ID = 'dereekb-firebase/require-dbx-model-companion-tags';

function buildConfig(): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
      plugins: { 'dereekb-firebase': { rules: { 'require-dbx-model-companion-tags': FIREBASE_REQUIRE_DBX_MODEL_COMPANION_TAGS_RULE } } as any },
      rules: { [RULE_ID]: 'error' }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(), { filename: 'test.ts' }).filter((m) => m.ruleId === RULE_ID);
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
 * @dbxModelRead permissions
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
 * @dbxModelRead permissions
 */
export interface Foo { id: string; }
`);
    expect(messagesById(errors).mutuallyExclusiveMarkers).toBe(1);
  });

  it('flags archetype with non-kebab slug', () => {
    const errors = lintCode(`
/**
 * @dbxModel
 * @dbxModelRead permissions
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
 * @dbxModelRead permissions
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
 * @dbxModelRead permissions
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
 * @dbxModelRead permissions
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
 * @dbxModelRead permissions
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
 * @dbxModelRead permissions
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
 * @dbxModelRead permissions
 * @dbxModelKategory misc
 */
export interface Foo { id: string; }
`);
    expect(messagesById(errors).unknownDbxModelTag).toBe(1);
  });

  it('flags missing @dbxModelRead on @dbxModel-marked interface', () => {
    const errors = lintCode(`
/**
 * @dbxModel
 */
export interface Foo { id: string; }
`);
    expect(messagesById(errors).readMissing).toBe(1);
  });

  it('flags empty @dbxModelRead value', () => {
    const errors = lintCode(`
/**
 * @dbxModel
 * @dbxModelRead
 */
export interface Foo { id: string; }
`);
    expect(messagesById(errors).readMissingValue).toBe(1);
  });

  it('flags invalid @dbxModelRead value', () => {
    const errors = lintCode(`
/**
 * @dbxModel
 * @dbxModelRead public
 */
export interface Foo { id: string; }
`);
    expect(messagesById(errors).readInvalidValue).toBe(1);
  });

  it('passes on @dbxModelRead system', () => {
    const errors = lintCode(`
/**
 * @dbxModel
 * @dbxModelRead system
 */
export interface Foo { id: string; }
`);
    expect(errors).toHaveLength(0);
  });

  it('passes on @dbxModelRead owner', () => {
    const errors = lintCode(`
/**
 * @dbxModel
 * @dbxModelRead owner
 */
export interface Foo { id: string; }
`);
    expect(errors).toHaveLength(0);
  });

  it('passes on @dbxModelRead admin-only', () => {
    const errors = lintCode(`
/**
 * @dbxModel
 * @dbxModelRead admin-only
 */
export interface Foo { id: string; }
`);
    expect(errors).toHaveLength(0);
  });

  it('does not require @dbxModelRead on @dbxModelSubObject', () => {
    const errors = lintCode(`
/**
 * @dbxModelSubObject
 */
export interface Foo { id: string; }
`);
    expect(messagesById(errors).readMissing).toBeUndefined();
  });

  it('flags duplicate @dbxModelRead', () => {
    const errors = lintCode(`
/**
 * @dbxModel
 * @dbxModelRead permissions
 * @dbxModelRead owner
 */
export interface Foo { id: string; }
`);
    expect(messagesById(errors).duplicateCompanionTag).toBe(1);
  });
});
