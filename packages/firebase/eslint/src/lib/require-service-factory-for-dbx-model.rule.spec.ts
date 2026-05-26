import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { FIREBASE_REQUIRE_SERVICE_FACTORY_FOR_DBX_MODEL_RULE } from './require-service-factory-for-dbx-model.rule';

const RULE_ID = 'dereekb-firebase/require-service-factory-for-dbx-model';

function buildConfig(virtualFactoryModelTypes: readonly string[], ignoreModels?: readonly string[]): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
      plugins: { 'dereekb-firebase': { rules: { 'require-service-factory-for-dbx-model': FIREBASE_REQUIRE_SERVICE_FACTORY_FOR_DBX_MODEL_RULE } } as any },
      rules: { [RULE_ID]: ['warn', { virtualFactoryModelTypes, ...(ignoreModels ? { ignoreModels } : {}) }] }
    }
  ];
}

function lintCode(code: string, virtualFactoryModelTypes: readonly string[], ignoreModels?: readonly string[]): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(virtualFactoryModelTypes, ignoreModels), { filename: 'test.ts' }).filter((m) => m.ruleId === RULE_ID);
}

function messagesById(messages: Linter.LintMessage[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of messages) out[m.messageId ?? 'unknown'] = (out[m.messageId ?? 'unknown'] ?? 0) + 1;
  return out;
}

describe('require-service-factory-for-dbx-model rule', () => {
  it('passes when a matching factory is registered', () => {
    const errors = lintCode(
      `
/**
 * @dbxModel
 */
export interface Guestbook { name: string; }
`,
      ['guestbook']
    );
    expect(errors).toHaveLength(0);
  });

  it('flags a @dbxModel interface with no matching factory', () => {
    const errors = lintCode(
      `
/**
 * @dbxModel
 */
export interface Guestbook { name: string; }
`,
      ['profile']
    );
    expect(messagesById(errors).modelHasNoServiceFactory).toBe(1);
  });

  it('ignores models listed in ignoreModels', () => {
    const errors = lintCode(
      `
/**
 * @dbxModel
 */
export interface Guestbook { name: string; }
`,
      ['profile'],
      ['Guestbook']
    );
    expect(errors).toHaveLength(0);
  });

  it('skips interfaces without the @dbxModel marker', () => {
    const errors = lintCode(
      `
export interface Guestbook { name: string; }
`,
      []
    );
    expect(errors).toHaveLength(0);
  });

  it('skips interfaces marked @dbxModelSubObject', () => {
    const errors = lintCode(
      `
/**
 * @dbxModelSubObject
 */
export interface GuestbookMeta { name: string; }
`,
      []
    );
    expect(errors).toHaveLength(0);
  });

  it('derives the expected modelType by lowercasing the first letter', () => {
    const errors = lintCode(
      `
/**
 * @dbxModel
 */
export interface GuestbookEntry { id: string; }
`,
      ['guestbook']
    );
    expect(messagesById(errors).modelHasNoServiceFactory).toBe(1);
  });

  it('passes when the camelCase derivation matches', () => {
    const errors = lintCode(
      `
/**
 * @dbxModel
 */
export interface GuestbookEntry { id: string; }
`,
      ['guestbookEntry']
    );
    expect(errors).toHaveLength(0);
  });
});
