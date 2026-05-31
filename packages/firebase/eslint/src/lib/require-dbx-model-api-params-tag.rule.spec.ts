import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { FIREBASE_REQUIRE_DBX_MODEL_API_PARAMS_TAG_RULE } from './require-dbx-model-api-params-tag.rule';

const RULE_ID = 'dereekb-firebase/require-dbx-model-api-params-tag';

function buildConfig(): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
      plugins: { 'dereekb-firebase': { rules: { 'require-dbx-model-api-params-tag': FIREBASE_REQUIRE_DBX_MODEL_API_PARAMS_TAG_RULE } } as any },
      rules: { [RULE_ID]: 'error' }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(), { filename: 'guestbook.api.ts' }).filter((m) => m.ruleId === RULE_ID);
}

describe('require-dbx-model-api-params-tag', () => {
  it('does not report when every referenced params interface carries the marker', () => {
    const code = `
/**
 * @dbxModelApiParams
 */
export interface CreateGuestbookParams {
  readonly name: string;
}

/**
 * @dbxModelApiParams
 */
export interface PublishGuestbookParams {
  readonly target: string;
}

/**
 * @dbxModelApiParams
 */
export interface QueryGuestbooksParams {
  readonly published?: boolean;
}

type OnCallQueryModelResult<T> = { readonly results: T[] };
type Guestbook = object;

export type GuestbookModelCrudFunctionsConfig = {
  readonly guestbook: {
    create: CreateGuestbookParams;
    update: { publish: PublishGuestbookParams };
    query: [QueryGuestbooksParams, OnCallQueryModelResult<Guestbook>];
  };
};
`;
    expect(lintCode(code)).toHaveLength(0);
  });

  it('reports a bare-reference params interface missing the marker', () => {
    const code = `
export interface CreateGuestbookParams {
  readonly name: string;
}

export type GuestbookModelCrudFunctionsConfig = {
  readonly guestbook: {
    create: CreateGuestbookParams;
  };
};
`;
    const messages = lintCode(code);
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe('missingApiParamsTag');
  });

  it('reports params nested in specifier objects and tuples', () => {
    const code = `
export interface PublishGuestbookParams { readonly target: string; }
export interface QueryGuestbooksParams { readonly published?: boolean; }

type OnCallQueryModelResult<T> = { readonly results: T[] };
type Guestbook = object;

export type GuestbookModelCrudFunctionsConfig = {
  readonly guestbook: {
    update: { publish: PublishGuestbookParams };
    query: [QueryGuestbooksParams, OnCallQueryModelResult<Guestbook>];
  };
};
`;
    expect(lintCode(code)).toHaveLength(2);
  });

  it('skips params types not declared in the same file', () => {
    const code = `
import { type TargetModelParams } from '@dereekb/firebase';

export type GuestbookModelCrudFunctionsConfig = {
  readonly guestbook: {
    update: { like: TargetModelParams };
  };
};
`;
    expect(lintCode(code)).toHaveLength(0);
  });

  it('inspects *FunctionTypeMap aliases by default and ignores result types', () => {
    const code = `
export interface EntryDetailsParams { readonly id: string; }
type EntryDetailsResult = object;

export type GuestbookFunctionTypeMap = {
  entryDetails: [EntryDetailsParams, EntryDetailsResult];
};
`;
    const messages = lintCode(code);
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toContain('EntryDetailsParams');
  });

  it('does not report on unrelated type aliases', () => {
    const code = `
export interface SomethingParams { readonly x: number; }

export type SomethingElse = {
  foo: SomethingParams;
};
`;
    expect(lintCode(code)).toHaveLength(0);
  });
});
