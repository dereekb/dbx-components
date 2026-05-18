import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { UTIL_ESLINT_PLUGIN } from './plugin';

function buildConfig(): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
      plugins: { 'dereekb-util': UTIL_ESLINT_PLUGIN as any },
      rules: { 'dereekb-util/require-dbx-action-companion-tags': 'error' }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(), { filename: 'test.ts' }).filter((m) => m.ruleId === 'dereekb-util/require-dbx-action-companion-tags');
}

function messagesById(messages: Linter.LintMessage[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of messages) out[m.messageId ?? 'unknown'] = (out[m.messageId ?? 'unknown'] ?? 0) + 1;
  return out;
}

describe('require-dbx-action-companion-tags rule', () => {
  it('passes on canonical action directive', () => {
    const errors = lintCode(`
/**
 * @dbxAction
 * @dbxActionSlug submit-action
 */
export class SubmitActionDirective {}
`);
    expect(errors).toHaveLength(0);
  });

  it('flags missing slug', () => {
    const errors = lintCode(`
/**
 * @dbxAction
 */
export class FooDirective {}
`);
    expect(messagesById(errors).missingSlug).toBe(1);
  });

  it('flags invalid role', () => {
    const errors = lintCode(`
/**
 * @dbxAction
 * @dbxActionSlug foo
 * @dbxActionRole mixin
 */
export class FooDirective {}
`);
    expect(messagesById(errors).invalidRole).toBe(1);
  });

  it('flags invalid state value', () => {
    const errors = lintCode(`
/**
 * @dbxAction
 * @dbxActionSlug foo
 * @dbxActionStateInteraction FOO, IDLE
 */
export class FooDirective {}
`);
    expect(messagesById(errors).invalidStateValue).toBe(1);
  });

  it('flags property-level tag on class JSDoc', () => {
    const errors = lintCode(`
/**
 * @dbxAction
 * @dbxActionSlug foo
 * @dbxActionStateTransitionsFrom IDLE
 */
export class FooDirective {}
`);
    expect(messagesById(errors).stateTagOutsideEnumMember).toBe(1);
  });

  it('flags unknown companion typo', () => {
    const errors = lintCode(`
/**
 * @dbxAction
 * @dbxActionSlug foo
 * @dbxActionKategory misc
 */
export class FooDirective {}
`);
    expect(messagesById(errors).unknownDbxActionTag).toBe(1);
  });

  it('flags invalid state on enum member', () => {
    const errors = lintCode(`
export enum FooStateEnum {
  /**
   * @dbxActionStateTransitionsFrom UNKNOWN
   */
  IDLE = 'IDLE'
}
`);
    expect(messagesById(errors).invalidStateValue).toBe(1);
  });
});
