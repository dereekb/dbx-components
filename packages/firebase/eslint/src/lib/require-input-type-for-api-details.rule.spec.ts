import { describe, it, expect } from 'vitest';
import { Linter } from 'eslint';
import tsParser from '@typescript-eslint/parser';
import { FIREBASE_REQUIRE_INPUT_TYPE_FOR_API_DETAILS_RULE } from './require-input-type-for-api-details.rule';

const RULE_ID = 'dereekb-firebase/require-input-type-for-api-details';

function buildConfig(): Linter.Config[] {
  return [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 2022, sourceType: 'module' } },
      plugins: { 'dereekb-firebase': { rules: { 'require-input-type-for-api-details': FIREBASE_REQUIRE_INPUT_TYPE_FOR_API_DETAILS_RULE } } as any },
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
type OnCallReadModelFunction<C, I, O> = (req: { context: C; data: I }) => Promise<O>;
type OnCallUpdateModelFunction<C, I, O = void> = (req: { context: C; data: I }) => Promise<O>;
type OnCallDeleteModelFunction<C, I, O = void> = (req: { context: C; data: I }) => Promise<O>;
type OnCallQueryModelFunction<C, I, O> = (req: { context: C; data: I }) => Promise<O>;
type OnCallInvokeModelFunction<C, I, O> = (req: { context: C; data: I }) => Promise<O>;
type DemoCreateModelFunction<I, O = unknown> = OnCallCreateModelFunction<DemoApiNestContext, I, O>;
type DemoReadModelFunction<I, O> = OnCallReadModelFunction<DemoApiNestContext, I, O>;
type DemoUpdateModelFunction<I, O = void> = OnCallUpdateModelFunction<DemoApiNestContext, I, O>;
type DemoDeleteModelFunction<I, O = void> = OnCallDeleteModelFunction<DemoApiNestContext, I, O>;
type DemoQueryModelFunction<I, O> = OnCallQueryModelFunction<DemoApiNestContext, I, O>;
type DemoInvokeModelFunction<I, O = unknown> = OnCallInvokeModelFunction<DemoApiNestContext, I, O>;
type CreateFooParams = object;
type UpdateFooParams = object;
type DeleteFooParams = object;
type ReadFooParams = object;
type InvokeFooParams = object;
type QueryFooParams = object;
type FooQueryResult = object;
declare const createFooParamsType: unknown;
declare const baseConfig: { inputType: unknown };
declare function withApiDetails<F>(config: { inputType?: unknown; fn: F }): F;
`;

describe('require-input-type-for-api-details rule', () => {
  it('does not flag a withApiDetails config that declares inputType', () => {
    const messages = lintCode(`${TYPE_DEFS}
export const fooCreate: DemoCreateModelFunction<CreateFooParams> = withApiDetails({
  inputType: createFooParamsType,
  fn: async (request) => ({ id: 'x' })
});
`);
    expect(messages).toEqual([]);
  });

  it('flags a non-empty-input create handler missing inputType', () => {
    const messages = lintCode(`${TYPE_DEFS}
export const fooCreate: DemoCreateModelFunction<CreateFooParams> = withApiDetails({
  fn: async (request) => ({ id: 'x' })
});
`);
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe('missingInputType');
    expect(messages[0].message).toContain('fooCreate');
    expect(messages[0].message).toContain('withApiDetails');
  });

  it('flags update / delete / read / invoke handlers missing inputType', () => {
    const messages = lintCode(`${TYPE_DEFS}
export const fooUpdate: DemoUpdateModelFunction<UpdateFooParams> = withApiDetails({ fn: async (request) => {} });
export const fooDelete: DemoDeleteModelFunction<DeleteFooParams> = withApiDetails({ fn: async (request) => {} });
export const fooRead: DemoReadModelFunction<ReadFooParams, FooQueryResult> = withApiDetails({ fn: async (request) => ({} as FooQueryResult) });
export const fooInvoke: DemoInvokeModelFunction<InvokeFooParams> = withApiDetails({ fn: async (request) => ({}) });
`);
    expect(messages).toHaveLength(4);
    expect(messages.every((m) => m.messageId === 'missingInputType')).toBe(true);
  });

  it('exempts Query handlers (standardized query params)', () => {
    const messages = lintCode(`${TYPE_DEFS}
export const fooQuery: DemoQueryModelFunction<QueryFooParams, FooQueryResult> = withApiDetails({
  fn: async (request) => ({} as FooQueryResult)
});
`);
    expect(messages).toEqual([]);
  });

  it('exempts handlers whose input generic is an empty object literal', () => {
    const messages = lintCode(`${TYPE_DEFS}
export const fooCreate: DemoCreateModelFunction<{}> = withApiDetails({
  optionalAuth: true,
  fn: async (request) => ({ id: 'x' })
} as any);
`);
    expect(messages).toEqual([]);
  });

  it('flags the canonical OnCall<Verb>ModelFunction name (input generic at index 1)', () => {
    const messages = lintCode(`${TYPE_DEFS}
export const canonicalCreate: OnCallCreateModelFunction<DemoApiNestContext, CreateFooParams> = withApiDetails({
  fn: async (request) => ({})
});
`);
    expect(messages).toHaveLength(1);
    expect(messages[0].messageId).toBe('missingInputType');
    expect(messages[0].message).toContain('canonicalCreate');
  });

  it('exempts the canonical name when its input generic (index 1) is empty', () => {
    const messages = lintCode(`${TYPE_DEFS}
export const canonicalCreate: OnCallCreateModelFunction<DemoApiNestContext, {}> = withApiDetails({
  fn: async (request) => ({})
});
`);
    expect(messages).toEqual([]);
  });

  it('skips configs built with a spread (contents not statically verifiable)', () => {
    const messages = lintCode(`${TYPE_DEFS}
export const fooCreate: DemoCreateModelFunction<CreateFooParams> = withApiDetails({
  ...baseConfig,
  fn: async (request) => ({ id: 'x' })
});
`);
    expect(messages).toEqual([]);
  });

  it('does not flag an unwrapped initializer (owned by require-api-details-for-crud-function)', () => {
    const messages = lintCode(`${TYPE_DEFS}
export const fooCreate: DemoCreateModelFunction<CreateFooParams> = async (request) => ({ id: 'x' });
`);
    expect(messages).toEqual([]);
  });

  it('does not flag a non-CRUD type annotation', () => {
    const messages = lintCode(`${TYPE_DEFS}
type SomeHelper = (x: number) => number;
export const helper: SomeHelper = (x) => x + 1;
`);
    expect(messages).toEqual([]);
  });

  it('respects an inline eslint-disable comment', () => {
    const messages = lintCode(`${TYPE_DEFS}
// eslint-disable-next-line ${RULE_ID}
export const fooCreate: DemoCreateModelFunction<CreateFooParams> = withApiDetails({ fn: async (request) => ({ id: 'x' }) });
`);
    expect(messages).toEqual([]);
  });
});
