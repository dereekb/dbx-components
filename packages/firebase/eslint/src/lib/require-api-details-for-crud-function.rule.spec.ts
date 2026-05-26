import { describe, it, expect } from 'vitest';
import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { FIREBASE_REQUIRE_API_DETAILS_FOR_CRUD_FUNCTION_RULE } from './require-api-details-for-crud-function.rule';

const RULE_ID = 'dereekb-firebase/require-api-details-for-crud-function';

function buildConfig(): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
      plugins: { 'dereekb-firebase': { rules: { 'require-api-details-for-crud-function': FIREBASE_REQUIRE_API_DETAILS_FOR_CRUD_FUNCTION_RULE } } as any },
      rules: { [RULE_ID]: 'warn' }
    }
  ];
}

function lintCode(code: string): Linter.LintMessage[] {
  const linter = new Linter({ configType: 'flat' });
  return linter.verify(code, buildConfig(), { filename: 'test.ts' }).filter((m) => m.ruleId === RULE_ID);
}

const TYPE_DEFS = `
type DemoApiNestContext = object;
type OnCallCreateModelFunction<C, I, O = unknown> = (req: { context: C; data: I }) => Promise<O>;
type OnCallUpdateModelFunction<C, I, O = void> = (req: { context: C; data: I }) => Promise<O>;
type OnCallDeleteModelFunction<C, I, O = void> = (req: { context: C; data: I }) => Promise<O>;
type OnCallQueryModelFunction<C, I, O> = (req: { context: C; data: I }) => Promise<O>;
type DemoCreateModelFunction<I, O = unknown> = OnCallCreateModelFunction<DemoApiNestContext, I, O>;
type DemoUpdateModelFunction<I, O = void> = OnCallUpdateModelFunction<DemoApiNestContext, I, O>;
type DemoDeleteModelFunction<I, O = void> = OnCallDeleteModelFunction<DemoApiNestContext, I, O>;
type DemoQueryModelFunction<I, O> = OnCallQueryModelFunction<DemoApiNestContext, I, O>;
type CreateFooParams = object;
type UpdateFooParams = object;
type DeleteFooParams = object;
type QueryFooParams = object;
type FooQueryResult = object;
declare const createFooParamsType: unknown;
declare function withApiDetails<F>(config: { inputType?: unknown; fn: F }): F;
`;

describe('require-api-details-for-crud-function rule', () => {
  it('does not flag a CRUD function wrapped in withApiDetails()', () => {
    const messages = lintCode(`${TYPE_DEFS}
export const fooCreate: DemoCreateModelFunction<CreateFooParams> = withApiDetails({
  inputType: createFooParamsType,
  fn: async (request) => ({ id: 'x' })
});
`);
    expect(messages).toEqual([]);
  });

  it('flags an unwrapped async-arrow CRUD declaration', () => {
    const messages = lintCode(`${TYPE_DEFS}
export const fooDelete: DemoDeleteModelFunction<DeleteFooParams> = async (request) => {
  /* no withApiDetails */
};
`);
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe('missingApiDetails');
    expect(messages[0].message).toContain('fooDelete');
    expect(messages[0].message).toContain('DemoDeleteModelFunction');
    expect(messages[0].message).toContain('withApiDetails');
  });

  it('flags an unwrapped function-expression CRUD declaration', () => {
    const messages = lintCode(`${TYPE_DEFS}
export const fooQuery: DemoQueryModelFunction<QueryFooParams, FooQueryResult> = function (request) {
  return Promise.resolve({} as FooQueryResult);
};
`);
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe('missingApiDetails');
    expect(messages[0].message).toContain('fooQuery');
  });

  it('ignores variables whose type annotation is not a CRUD function alias', () => {
    const messages = lintCode(`${TYPE_DEFS}
type SomeHelper = (x: number) => number;
export const helper: SomeHelper = (x) => x + 1;
`);
    expect(messages).toEqual([]);
  });

  it('also flags non-exported declarations matching the CRUD type pattern', () => {
    const messages = lintCode(`${TYPE_DEFS}
const internalCreate: DemoCreateModelFunction<CreateFooParams> = async (request) => ({ id: 'x' });
`);
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe('missingApiDetails');
    expect(messages[0].message).toContain('internalCreate');
  });

  it('recognizes the canonical OnCall<Verb>ModelFunction names, not only app-side aliases', () => {
    const messages = lintCode(`${TYPE_DEFS}
export const canonicalUpdate: OnCallUpdateModelFunction<DemoApiNestContext, UpdateFooParams> = async (request) => {};
`);
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe('missingApiDetails');
    expect(messages[0].message).toContain('OnCallUpdateModelFunction');
  });

  it('treats a generic withApiDetails<F>(...) call as wrapped', () => {
    const messages = lintCode(`${TYPE_DEFS}
type Fn = DemoCreateModelFunction<CreateFooParams>;
export const genericCreate: DemoCreateModelFunction<CreateFooParams> = withApiDetails<Fn>({
  inputType: createFooParamsType,
  fn: async (request) => ({ id: 'x' })
});
`);
    expect(messages).toEqual([]);
  });

  it('sees through "as any" / "as const" casts on the initializer', () => {
    const messages = lintCode(`${TYPE_DEFS}
export const castedCreate: DemoCreateModelFunction<CreateFooParams> = withApiDetails({
  inputType: createFooParamsType,
  fn: async (request) => ({ id: 'x' })
}) as any;
`);
    expect(messages).toEqual([]);
  });

  it('ignores declarators with no initializer (e.g. ambient declarations)', () => {
    const messages = lintCode(`${TYPE_DEFS}
declare const ambientCreate: DemoCreateModelFunction<CreateFooParams>;
`);
    expect(messages).toEqual([]);
  });

  it('respects the ignoreNames option', () => {
    const linter = new Linter({ configType: 'flat' });
    const config: Linter.Config[] = [
      {
        files: ['**/*.ts'],
        languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
        plugins: { 'dereekb-firebase': { rules: { 'require-api-details-for-crud-function': FIREBASE_REQUIRE_API_DETAILS_FOR_CRUD_FUNCTION_RULE } } as any },
        rules: { [RULE_ID]: ['warn', { ignoreNames: ['skipMe'] }] }
      }
    ];
    const code = `${TYPE_DEFS}
export const skipMe: DemoDeleteModelFunction<DeleteFooParams> = async (request) => {};
`;
    const messages = linter.verify(code, config, { filename: 'test.ts' }).filter((m) => m.ruleId === RULE_ID);
    expect(messages).toEqual([]);
  });
});
