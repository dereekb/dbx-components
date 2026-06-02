import { describe, it, expect } from 'vitest';
import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { FIREBASE_REQUIRE_USE_MODEL_ROLES_RULE } from './require-use-model-roles.rule';

const RULE_ID = 'dereekb-firebase/require-use-model-roles';

function buildConfig(): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
      plugins: { 'dereekb-firebase': { rules: { 'require-use-model-roles': FIREBASE_REQUIRE_USE_MODEL_ROLES_RULE } } as any },
      rules: { [RULE_ID]: 'error' }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(), { filename: 'test.ts' }).filter((m) => m.ruleId === RULE_ID);
}

describe('require-use-model-roles rule', () => {
  it('allows useModel() with a roles option', () => {
    const errors = lintCode(`
export async function fn(nest: any, request: any, key: any) {
  return nest.useModel('guestbook', { request, key, roles: 'read', use: (x: any) => x.document });
}
`);
    expect(errors).toHaveLength(0);
  });

  it('allows roles: [] (empty array) to intentionally require no role', () => {
    const errors = lintCode(`
export async function fn(nest: any, request: any, key: any) {
  return nest.useModel('guestbook', { request, key, roles: [], use: (x: any) => x.document });
}
`);
    expect(errors).toHaveLength(0);
  });

  it('allows an alternate receiver (this._nestContext.useModel)', () => {
    const errors = lintCode(`
class Service {
  async fn(request: any, key: any) {
    return this._nestContext.useModel('guestbook', { request, key, roles: 'read' });
  }
}
`);
    expect(errors).toHaveLength(0);
  });

  it('flags useModel() without a roles option', () => {
    const errors = lintCode(`
export async function fn(nest: any, request: any, key: any) {
  return nest.useModel('guestbook', { request, key, use: (x: any) => x.document });
}
`);
    expect(errors).toHaveLength(1);
    expect(errors[0].messageId).toBe('missingRoles');
    expect(errors[0].message).toContain('`useModel(...)`');
  });

  it('flags useMultipleModels() without a roles option by default', () => {
    const errors = lintCode(`
export async function fn(nest: any, request: any, keys: any) {
  return nest.useMultipleModels('guestbook', { request, keys, throwOnFirstError: false, use: async () => [] });
}
`);
    expect(errors).toHaveLength(1);
    expect(errors[0].messageId).toBe('missingRoles');
    expect(errors[0].message).toContain('`useMultipleModels(...)`');
  });

  it('skips when the selection argument is an identifier (not an inline object)', () => {
    const errors = lintCode(`
export async function fn(nest: any, selection: any) {
  return nest.useModel('guestbook', selection);
}
`);
    expect(errors).toHaveLength(0);
  });

  it('skips when the selection object contains a spread', () => {
    const errors = lintCode(`
export async function fn(nest: any, base: any, request: any, key: any) {
  return nest.useModel('guestbook', { ...base, request, key });
}
`);
    expect(errors).toHaveLength(0);
  });

  it('respects the methodNames option (only useModel tracked)', () => {
    const linter = new Linter({ configType: 'flat' });
    const errors = linter
      .verify(
        `
export async function fn(nest: any, request: any, keys: any) {
  return nest.useMultipleModels('guestbook', { request, keys, use: async () => [] });
}
`,
        [
          {
            files: ['**/*.ts'],
            languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
            plugins: { 'dereekb-firebase': { rules: { 'require-use-model-roles': FIREBASE_REQUIRE_USE_MODEL_ROLES_RULE } } as any },
            rules: { [RULE_ID]: ['error', { methodNames: ['useModel'] }] }
          }
        ],
        { filename: 'test.ts' }
      )
      .filter((m) => m.ruleId === RULE_ID);
    expect(errors).toHaveLength(0);
  });
});
