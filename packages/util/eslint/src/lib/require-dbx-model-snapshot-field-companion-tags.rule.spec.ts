import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { UTIL_ESLINT_PLUGIN } from './plugin';

function buildConfig(): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
      plugins: { 'dereekb-util': UTIL_ESLINT_PLUGIN as any },
      rules: { 'dereekb-util/require-dbx-model-snapshot-field-companion-tags': 'error' }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(), { filename: 'test.ts' }).filter((m) => m.ruleId === 'dereekb-util/require-dbx-model-snapshot-field-companion-tags');
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

describe('require-dbx-model-snapshot-field-companion-tags rule', () => {
  it('passes on marker-only factory', () => {
    const errors = lintCode(`
/**
 * @dbxModelSnapshotField
 */
export function firestoreString() { return null; }
`);
    expect(errors).toHaveLength(0);
  });

  it('passes on marker-only const', () => {
    const errors = lintCode(`
/**
 * @dbxModelSnapshotField
 */
export const firestoreStringConst = null;
`);
    expect(errors).toHaveLength(0);
  });

  it('flags invalid kind enum', () => {
    const errors = lintCode(`
/**
 * @dbxModelSnapshotField
 * @dbxModelSnapshotFieldKind helper
 */
export function firestoreString() { return null; }
`);
    expect(messagesById(errors).invalidKind).toBe(1);
  });

  it('flags invalid optional boolean', () => {
    const errors = lintCode(`
/**
 * @dbxModelSnapshotField
 * @dbxModelSnapshotFieldOptional maybe
 */
export function firestoreString() { return null; }
`);
    expect(messagesById(errors).invalidBooleanValue).toBe(1);
  });

  it('auto-fixes uppercase tags to lowercase', () => {
    const fixed = fixCode(`
/**
 * @dbxModelSnapshotField
 * @dbxModelSnapshotFieldTags Date, String
 */
export const foo = null;
`);
    expect(fixed).toContain('@dbxModelSnapshotFieldTags date, string');
  });

  it('flags unknown companion', () => {
    const errors = lintCode(`
/**
 * @dbxModelSnapshotField
 * @dbxModelSnapshotFieldGenre date
 */
export function foo() { return null; }
`);
    expect(messagesById(errors).unknownDbxModelSnapshotFieldTag).toBe(1);
  });
});
