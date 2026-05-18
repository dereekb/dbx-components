import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { UTIL_ESLINT_PLUGIN } from './plugin';

function buildConfig(): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
      plugins: { 'dereekb-util': UTIL_ESLINT_PLUGIN as any },
      rules: { 'dereekb-util/require-dbx-auth-companion-tags': 'error' }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(), { filename: 'test.ts' }).filter((m) => m.ruleId === 'dereekb-util/require-dbx-auth-companion-tags');
}

function messagesById(messages: Linter.LintMessage[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of messages) out[m.messageId ?? 'unknown'] = (out[m.messageId ?? 'unknown'] ?? 0) + 1;
  return out;
}

describe('require-dbx-auth-companion-tags rule', () => {
  it('passes on canonical @dbxAuthClaimsApp interface', () => {
    const errors = lintCode(`
/**
 * @dbxAuthClaimsApp my-app
 */
export interface MyApiAuthClaims { admin?: boolean; }
`);
    expect(errors).toHaveLength(0);
  });

  it('flags @dbxAuthClaimsApp without value', () => {
    const errors = lintCode(`
/**
 * @dbxAuthClaimsApp
 */
export interface MyApiAuthClaims { admin?: boolean; }
`);
    expect(messagesById(errors).appKeyMissing).toBe(1);
  });

  it('flags non-kebab @dbxAuthClaimsApp value', () => {
    const errors = lintCode(`
/**
 * @dbxAuthClaimsApp MyApp
 */
export interface MyApiAuthClaims { admin?: boolean; }
`);
    expect(messagesById(errors).appKeyNotKebab).toBe(1);
  });

  it('flags @dbxAuthClaim on interface declaration', () => {
    const errors = lintCode(`
/**
 * @dbxAuthClaim
 */
export interface MyApiAuthClaims { admin?: boolean; }
`);
    expect(messagesById(errors).claimMarkerOutsideProperty).toBe(1);
  });

  it('flags non-kebab @dbxAuthRoleTag', () => {
    const errors = lintCode(`
export interface MyApiAuthClaims {
  /**
   * @dbxAuthClaim
   * @dbxAuthRoleTag adminRole
   */
  admin?: boolean;
}
`);
    expect(messagesById(errors).roleTagNotKebab).toBe(1);
  });

  it('passes on canonical @dbxAuthClaimsService variable', () => {
    const errors = lintCode(`
/**
 * @dbxAuthClaimsService my-app
 */
export const myClaimsService = null;
`);
    expect(errors).toHaveLength(0);
  });

  it('flags non-kebab service value', () => {
    const errors = lintCode(`
/**
 * @dbxAuthClaimsService MyApp
 */
export const myClaimsService = null;
`);
    expect(messagesById(errors).serviceKeyNotKebab).toBe(1);
  });
});
