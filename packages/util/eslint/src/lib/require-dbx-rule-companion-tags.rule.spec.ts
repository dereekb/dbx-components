import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { utilEslintPlugin } from './plugin';

function buildConfig(): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tsParser as any, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
      plugins: { 'dereekb-util': utilEslintPlugin as any },
      rules: { 'dereekb-util/require-dbx-rule-companion-tags': 'error' }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(), { filename: 'test.ts' }).filter((m) => m.ruleId === 'dereekb-util/require-dbx-rule-companion-tags');
}

function messagesById(messages: Linter.LintMessage[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of messages) out[m.messageId ?? 'unknown'] = (out[m.messageId ?? 'unknown'] ?? 0) + 1;
  return out;
}

describe('require-dbx-rule-companion-tags rule', () => {
  it('passes on canonical enum member', () => {
    const errors = lintCode(`
export enum FooCodes {
  /**
   * @dbxRule
   * @dbxRuleSeverity error
   * @dbxRuleApplies When something applies.
   * @dbxRuleNotApplies When it does not apply.
   * @dbxRuleFix How to fix it.
   */
  FOO = 'FOO'
}
`);
    expect(errors).toHaveLength(0);
  });

  it('flags missing severity', () => {
    const errors = lintCode(`
export enum FooCodes {
  /**
   * @dbxRule
   * @dbxRuleApplies a
   * @dbxRuleNotApplies b
   * @dbxRuleFix c
   */
  FOO = 'FOO'
}
`);
    expect(messagesById(errors).missingSeverity).toBe(1);
  });

  it('flags invalid severity', () => {
    const errors = lintCode(`
export enum FooCodes {
  /**
   * @dbxRule
   * @dbxRuleSeverity info
   * @dbxRuleApplies a
   * @dbxRuleNotApplies b
   * @dbxRuleFix c
   */
  FOO = 'FOO'
}
`);
    expect(messagesById(errors).invalidSeverity).toBe(1);
  });

  it('flags missing applies/notApplies/fix', () => {
    const errors = lintCode(`
export enum FooCodes {
  /**
   * @dbxRule
   * @dbxRuleSeverity error
   */
  FOO = 'FOO'
}
`);
    const counts = messagesById(errors);
    expect(counts.missingApplies).toBe(1);
    expect(counts.missingNotApplies).toBe(1);
    expect(counts.missingFix).toBe(1);
  });

  it('flags malformed seeAlso', () => {
    const errors = lintCode(`
export enum FooCodes {
  /**
   * @dbxRule
   * @dbxRuleSeverity error
   * @dbxRuleApplies a
   * @dbxRuleNotApplies b
   * @dbxRuleFix c
   * @dbxRuleSeeAlso missing-colon
   */
  FOO = 'FOO'
}
`);
    expect(messagesById(errors).invalidSeeAlsoFormat).toBe(1);
  });

  it('flags invalid seeAlso kind', () => {
    const errors = lintCode(`
export enum FooCodes {
  /**
   * @dbxRule
   * @dbxRuleSeverity error
   * @dbxRuleApplies a
   * @dbxRuleNotApplies b
   * @dbxRuleFix c
   * @dbxRuleSeeAlso unknown:foo
   */
  FOO = 'FOO'
}
`);
    expect(messagesById(errors).invalidSeeAlsoKind).toBe(1);
  });

  it('allows repeated @dbxRuleSeeAlso without duplicate flag', () => {
    const errors = lintCode(`
export enum FooCodes {
  /**
   * @dbxRule
   * @dbxRuleSeverity error
   * @dbxRuleApplies a
   * @dbxRuleNotApplies b
   * @dbxRuleFix c
   * @dbxRuleSeeAlso doc:foo
   * @dbxRuleSeeAlso tool:bar
   */
  FOO = 'FOO'
}
`);
    expect(messagesById(errors).duplicateCompanionTag ?? 0).toBe(0);
  });
});
