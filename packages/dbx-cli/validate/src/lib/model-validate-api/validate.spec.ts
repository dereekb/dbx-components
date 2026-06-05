import { describe, expect, it } from 'vitest';
import { validateModelApiSources } from './index.js';
import type { ViolationCode } from './types.js';

function expectCodes(codes: readonly ViolationCode[], expected: readonly ViolationCode[]): void {
  for (const c of expected) {
    expect(codes, `expected code ${c} in ${JSON.stringify(codes)}`).toContain(c);
  }
}

function expectNotCodes(codes: readonly ViolationCode[], forbidden: readonly ViolationCode[]): void {
  for (const c of forbidden) {
    expect(codes, `expected code ${c} to be absent from ${JSON.stringify(codes)}`).not.toContain(c);
  }
}

// Canonical happy-path fixture: one model group (Widget) with create,
// update, and a find operation that uses [Params, Result] tuple form.
const HAPPY_SOURCE = `import { type, type Type } from 'arktype';
import { clearable } from '@dereekb/model';
import { type TargetModelParams, targetModelParamsType, callModelFirebaseFunctionMapFactory, type FirebaseFunctionTypeConfigMap, type ModelFirebaseCrudFunction, type ModelFirebaseCrudFunctionConfigMap, type ModelFirebaseFunctionMap, type ModelFirebaseCreateFunction, type OnCallCreateModelResult } from '@dereekb/firebase';
import { type WidgetTypes } from './widget';
import { type Maybe } from '@dereekb/util';

// MARK: Constants
export const WIDGET_NAME_MAX_LENGTH = 42;

// MARK: Create
export interface CreateWidgetParams {
  readonly n: string;
}

export const createWidgetParamsType = type({
  n: \`string > 0 & string <= \${WIDGET_NAME_MAX_LENGTH}\`
}) as Type<CreateWidgetParams>;

// MARK: Update
export interface UpdateWidgetParams extends TargetModelParams {
  readonly n?: Maybe<string>;
}

export const updateWidgetParamsType = targetModelParamsType.merge({
  'n?': clearable(\`string > 0 & string <= \${WIDGET_NAME_MAX_LENGTH}\`)
}) as Type<UpdateWidgetParams>;

// MARK: Find
export interface FindWidgetParams {
  readonly id: string;
}

export const findWidgetParamsType = type({
  id: 'string > 0'
}) as Type<FindWidgetParams>;

export interface FindWidgetResult {
  readonly found: boolean;
}

// MARK: Keys
// MARK: Functions
export type WidgetFunctionTypeMap = {};

export const widgetFunctionTypeConfigMap: FirebaseFunctionTypeConfigMap<WidgetFunctionTypeMap> = {};

export type WidgetModelCrudFunctionsConfig = {
  widget: {
    create: CreateWidgetParams;
    update: UpdateWidgetParams;
    read: {
      find: [FindWidgetParams, FindWidgetResult];
    };
  };
};

export const widgetModelCrudFunctionsConfig: ModelFirebaseCrudFunctionConfigMap<WidgetModelCrudFunctionsConfig, WidgetTypes> = {
  widget: ['create', 'update', 'read:find']
};

export const widgetFunctionMap = callModelFirebaseFunctionMapFactory(widgetFunctionTypeConfigMap, widgetModelCrudFunctionsConfig);

export abstract class WidgetFunctions implements ModelFirebaseFunctionMap<WidgetFunctionTypeMap, WidgetModelCrudFunctionsConfig> {
  abstract widget: {
    createWidget: ModelFirebaseCreateFunction<CreateWidgetParams, OnCallCreateModelResult>;
    updateWidget: ModelFirebaseCrudFunction<UpdateWidgetParams>;
    readWidget: {
      find: ModelFirebaseCrudFunction<FindWidgetParams, FindWidgetResult>;
    };
  };
}
`;

describe('validateModelApiSources', () => {
  it('has zero errors and zero warnings on the canonical fixture', () => {
    const result = validateModelApiSources([{ name: 'widget.api.ts', text: HAPPY_SOURCE }]);
    expect(result.filesChecked).toBe(1);
    expect(result.apisChecked).toBe(1);
    expect(
      result.errorCount,
      JSON.stringify(
        result.violations.filter((v) => v.severity === 'error'),
        null,
        2
      )
    ).toBe(0);
    expect(
      result.warningCount,
      JSON.stringify(
        result.violations.filter((v) => v.severity === 'warning'),
        null,
        2
      )
    ).toBe(0);
  });

  it('skips files without a callModelFirebaseFunctionMapFactory call', () => {
    const result = validateModelApiSources([{ name: 'helpers.ts', text: 'export const foo = 1;' }]);
    expect(result.filesChecked).toBe(1);
    expect(result.apisChecked).toBe(0);
    expect(result.violations).toHaveLength(0);
  });

  it('warns when passed a development.api.ts file and skips structural checks', () => {
    const result = validateModelApiSources([{ name: 'development.api.ts', text: HAPPY_SOURCE }]);
    expect(result.errorCount).toBe(0);
    const codes = result.violations.map((v) => v.code);
    expect(codes).toContain('NON_CRUD_API_FILENAME');
    expectNotCodes(codes, ['FILE_MISSING_FUNCTION_TYPE_MAP', 'FILE_MISSING_FUNCTIONS_CLASS']);
  });

  it('flags each missing Functions-block export', () => {
    // Minimal source: only the factory call is present, so the
    // factoryCallSeen gate is open and every structural export is missing.
    const text = `import { callModelFirebaseFunctionMapFactory } from '@dereekb/firebase';\n\nconst throwaway = callModelFirebaseFunctionMapFactory({}, {});\n`;
    const result = validateModelApiSources([{ name: 'bare.api.ts', text }]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['FILE_MISSING_FUNCTION_TYPE_MAP', 'FILE_MISSING_FUNCTION_TYPE_CONFIG_MAP', 'FILE_MISSING_CRUD_CONFIG_TYPE', 'FILE_MISSING_CRUD_CONFIG_CONST', 'FILE_MISSING_FUNCTIONS_CLASS', 'FILE_MISSING_FUNCTION_MAP']
    );
  });

  it('flags an un-exported Functions class', () => {
    const text = HAPPY_SOURCE.replace('export abstract class WidgetFunctions', 'abstract class WidgetFunctions');
    const result = validateModelApiSources([{ name: 'widget.api.ts', text }]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['FILE_NOT_EXPORTED']
    );
  });

  it('flags group-name inconsistency across the six identifiers', () => {
    const text = HAPPY_SOURCE.replace('export abstract class WidgetFunctions', 'export abstract class GadgetFunctions').replace('WidgetFunctions implements ModelFirebaseFunctionMap', 'GadgetFunctions implements ModelFirebaseFunctionMap');
    const result = validateModelApiSources([{ name: 'widget.api.ts', text }]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['FILE_GROUP_NAME_INCONSISTENT']
    );
  });

  it('flags a wrong generic on the function-type config map', () => {
    const text = HAPPY_SOURCE.replace('export const widgetFunctionTypeConfigMap: FirebaseFunctionTypeConfigMap<WidgetFunctionTypeMap>', 'export const widgetFunctionTypeConfigMap: FirebaseFunctionTypeConfigMap<GadgetFunctionTypeMap>');
    const result = validateModelApiSources([{ name: 'widget.api.ts', text }]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['TYPE_CONFIG_MAP_WRONG_GENERIC']
    );
  });

  it('flags a wrong generic on the CRUD config const', () => {
    const text = HAPPY_SOURCE.replace('ModelFirebaseCrudFunctionConfigMap<WidgetModelCrudFunctionsConfig, WidgetTypes>', 'ModelFirebaseCrudFunctionConfigMap<WidgetModelCrudFunctionsConfig, SomeOtherTypes>');
    const result = validateModelApiSources([{ name: 'widget.api.ts', text }]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['CRUD_CONFIG_CONST_WRONG_GENERIC']
    );
  });

  it('flags a non-abstract Functions class', () => {
    const text = HAPPY_SOURCE.replace('export abstract class WidgetFunctions', 'export class WidgetFunctions');
    const result = validateModelApiSources([{ name: 'widget.api.ts', text }]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['FUNCTIONS_CLASS_NOT_ABSTRACT']
    );
  });

  it('flags a Functions class with the wrong implements generics', () => {
    const text = HAPPY_SOURCE.replace('implements ModelFirebaseFunctionMap<WidgetFunctionTypeMap, WidgetModelCrudFunctionsConfig>', 'implements ModelFirebaseFunctionMap<WidgetFunctionTypeMap, SomeOtherConfig>');
    const result = validateModelApiSources([{ name: 'widget.api.ts', text }]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['FUNCTIONS_CLASS_BAD_IMPLEMENTS']
    );
  });

  it('flags bad factory arguments on the FunctionMap', () => {
    const text = HAPPY_SOURCE.replace('callModelFirebaseFunctionMapFactory(widgetFunctionTypeConfigMap, widgetModelCrudFunctionsConfig)', 'callModelFirebaseFunctionMapFactory(widgetModelCrudFunctionsConfig, widgetFunctionTypeConfigMap)');
    const result = validateModelApiSources([{ name: 'widget.api.ts', text }]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['FUNCTION_MAP_BAD_FACTORY_ARGS']
    );
  });

  it('flags a Params interface with no matching validator', () => {
    const text = HAPPY_SOURCE.replace(/export const createWidgetParamsType[\s\S]*?;\n/, '');
    const result = validateModelApiSources([{ name: 'widget.api.ts', text }]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['PARAMS_MISSING_VALIDATOR']
    );
  });

  it('flags a validator with the wrong cast target', () => {
    const text = HAPPY_SOURCE.replace('}) as Type<CreateWidgetParams>;', '}) as Type<WrongParams>;');
    const result = validateModelApiSources([{ name: 'widget.api.ts', text }]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['PARAMS_VALIDATOR_WRONG_CAST']
    );
  });

  it('accepts `as unknown as Type<...>` double-cast', () => {
    const text = HAPPY_SOURCE.replace('}) as Type<CreateWidgetParams>;', '}) as unknown as Type<CreateWidgetParams>;');
    const result = validateModelApiSources([{ name: 'widget.api.ts', text }]);
    expectNotCodes(
      result.violations.map((v) => v.code),
      ['PARAMS_VALIDATOR_WRONG_CAST']
    );
  });

  it('flags an un-exported Params interface', () => {
    const text = HAPPY_SOURCE.replace('export interface CreateWidgetParams', 'interface CreateWidgetParams');
    const result = validateModelApiSources([{ name: 'widget.api.ts', text }]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['PARAMS_NOT_EXPORTED']
    );
  });

  it('flags an un-exported Params validator', () => {
    const text = HAPPY_SOURCE.replace('export const createWidgetParamsType', 'const createWidgetParamsType');
    const result = validateModelApiSources([{ name: 'widget.api.ts', text }]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['PARAMS_VALIDATOR_NOT_EXPORTED']
    );
  });

  it('warns when the validator is not adjacent to its paired interface', () => {
    const text = HAPPY_SOURCE.replace('export const createWidgetParamsType = type({\n  n: `string > 0 & string <= ${WIDGET_NAME_MAX_LENGTH}`\n}) as Type<CreateWidgetParams>;', "export interface SomeOtherParams {\n  readonly x: string;\n}\n\nexport const someOtherParamsType = type({ x: 'string' }) as Type<SomeOtherParams>;\n\nexport const createWidgetParamsType = type({\n  n: `string > 0 & string <= ${WIDGET_NAME_MAX_LENGTH}`\n}) as Type<CreateWidgetParams>;");
    const result = validateModelApiSources([{ name: 'widget.api.ts', text }]);
    const adjacency = result.violations.filter((v) => v.code === 'PARAMS_VALIDATOR_NOT_ADJACENT');
    expect(adjacency.length).toBeGreaterThan(0);
    expect(adjacency[0].severity).toBe('warning');
  });

  it('warns when a Params interface field is not readonly', () => {
    const text = HAPPY_SOURCE.replace('export interface CreateWidgetParams {\n  readonly n: string;\n}', 'export interface CreateWidgetParams {\n  n: string;\n}');
    const result = validateModelApiSources([{ name: 'widget.api.ts', text }]);
    const warnings = result.violations.filter((v) => v.code === 'PARAMS_FIELD_NOT_READONLY');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].severity).toBe('warning');
  });

  it('warns when a Result interface field is not readonly', () => {
    const text = HAPPY_SOURCE.replace('export interface FindWidgetResult {\n  readonly found: boolean;\n}', 'export interface FindWidgetResult {\n  found: boolean;\n}');
    const result = validateModelApiSources([{ name: 'widget.api.ts', text }]);
    const warnings = result.violations.filter((v) => v.code === 'RESULT_FIELD_NOT_READONLY');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].severity).toBe('warning');
  });

  it('warns when a Maybe<T> field is not wrapped in clearable() in the validator', () => {
    const text = HAPPY_SOURCE.replace("'n?': clearable(`string > 0 & string <= ${WIDGET_NAME_MAX_LENGTH}`)", "'n?': `string > 0 & string <= ${WIDGET_NAME_MAX_LENGTH}`");
    const result = validateModelApiSources([{ name: 'widget.api.ts', text }]);
    const warnings = result.violations.filter((v) => v.code === 'PARAMS_MAYBE_WITHOUT_CLEARABLE');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].severity).toBe('warning');
  });

  it('warns when a CRUD config model key is missing from the Functions class', () => {
    const text = HAPPY_SOURCE.replace('export type WidgetModelCrudFunctionsConfig = {\n  widget: {', 'export type WidgetModelCrudFunctionsConfig = {\n  extraWidget: { create: CreateWidgetParams };\n  widget: {');
    const result = validateModelApiSources([{ name: 'widget.api.ts', text }]);
    const warnings = result.violations.filter((v) => v.code === 'CRUD_CLASS_MISSING_KEY');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].severity).toBe('warning');
  });

  it('warns when a CRUD config model key is missing from the runtime const', () => {
    const text = HAPPY_SOURCE.replace('export type WidgetModelCrudFunctionsConfig = {\n  widget: {', 'export type WidgetModelCrudFunctionsConfig = {\n  extraWidget: { create: CreateWidgetParams };\n  widget: {').replace(
      'export abstract class WidgetFunctions implements ModelFirebaseFunctionMap<WidgetFunctionTypeMap, WidgetModelCrudFunctionsConfig> {\n  abstract widget: {',
      'export abstract class WidgetFunctions implements ModelFirebaseFunctionMap<WidgetFunctionTypeMap, WidgetModelCrudFunctionsConfig> {\n  abstract extraWidget: { createExtraWidget: ModelFirebaseCreateFunction<CreateWidgetParams, OnCallCreateModelResult> };\n  abstract widget: {'
    );
    const result = validateModelApiSources([{ name: 'widget.api.ts', text }]);
    const warnings = result.violations.filter((v) => v.code === 'CRUD_CONST_MISSING_KEY');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].severity).toBe('warning');
  });

  it('warns when a bare Params reference in the CRUD config type has a matching Result interface', () => {
    const text = HAPPY_SOURCE.replace('find: [FindWidgetParams, FindWidgetResult];', 'find: FindWidgetParams;');
    const result = validateModelApiSources([{ name: 'widget.api.ts', text }]);
    const warnings = result.violations.filter((v) => v.code === 'CRUD_CONFIG_MISSING_RESULT_TUPLE');
    expect(warnings.length).toBe(1);
    expect(warnings[0].severity).toBe('warning');
    expect(warnings[0].message).toContain('[FindWidgetParams, FindWidgetResult]');
  });

  it('warns when the Functions block is out of order', () => {
    const text = HAPPY_SOURCE.replace(
      'export const widgetFunctionMap = callModelFirebaseFunctionMapFactory(widgetFunctionTypeConfigMap, widgetModelCrudFunctionsConfig);\n\nexport abstract class WidgetFunctions',
      'export abstract class WidgetFunctions implements ModelFirebaseFunctionMap<WidgetFunctionTypeMap, WidgetModelCrudFunctionsConfig> {\n  abstract widget: {\n    createWidget: ModelFirebaseCreateFunction<CreateWidgetParams, OnCallCreateModelResult>;\n    updateWidget: ModelFirebaseCrudFunction<UpdateWidgetParams>;\n    readWidget: {\n      find: ModelFirebaseCrudFunction<FindWidgetParams, FindWidgetResult>;\n    };\n  };\n}\n\nexport const widgetFunctionMap = callModelFirebaseFunctionMapFactory(widgetFunctionTypeConfigMap, widgetModelCrudFunctionsConfig);\n\nexport abstract class WidgetFunctionsRedacted'
    );
    const result = validateModelApiSources([{ name: 'widget.api.ts', text }]);
    const warnings = result.violations.filter((v) => v.code === 'FUNCTIONS_BLOCK_OUT_OF_ORDER');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].severity).toBe('warning');
  });

  it('warns when a Params declaration appears after the Functions block', () => {
    const text = `${HAPPY_SOURCE}\n\nexport interface LateParams {\n  readonly z: string;\n}\n\nexport const lateParamsType = type({ z: 'string' }) as Type<LateParams>;\n`;
    const result = validateModelApiSources([{ name: 'widget.api.ts', text }]);
    const warnings = result.violations.filter((v) => v.code === 'DECL_AFTER_FUNCTIONS_BLOCK');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].severity).toBe('warning');
  });

  it('warns when // MARK: Functions is missing', () => {
    const text = HAPPY_SOURCE.replace('// MARK: Functions', '// not a MARK');
    const result = validateModelApiSources([{ name: 'widget.api.ts', text }]);
    const warnings = result.violations.filter((v) => v.code === 'FILE_MISSING_MARK_FUNCTIONS');
    expect(warnings.length).toBe(1);
    expect(warnings[0].severity).toBe('warning');
  });

  it('warns when // MARK: Keys is missing', () => {
    const text = HAPPY_SOURCE.replace('// MARK: Keys\n', '');
    const result = validateModelApiSources([{ name: 'widget.api.ts', text }]);
    const warnings = result.violations.filter((v) => v.code === 'FILE_MISSING_MARK_KEYS');
    expect(warnings.length).toBe(1);
  });

  it('warns when no MARK comment precedes the first Params declaration', () => {
    const text = HAPPY_SOURCE.replace('// MARK: Constants\n', '').replace('// MARK: Create\n', '');
    const result = validateModelApiSources([{ name: 'widget.api.ts', text }]);
    const warnings = result.violations.filter((v) => v.code === 'FILE_MISSING_MARK_CONSTANTS');
    expect(warnings.length).toBe(1);
  });

  it('auto-attaches remediation hints from the rule catalog', () => {
    const text = HAPPY_SOURCE.replace('// MARK: Functions', '// not a MARK');
    const result = validateModelApiSources([{ name: 'widget.api.ts', text }]);
    const v = result.violations.find((violation) => violation.code === 'FILE_MISSING_MARK_FUNCTIONS');
    expect(v).toBeDefined();
    expect(v?.remediation).toBeDefined();
    expect(v?.remediation?.fix).toContain('// MARK: Functions');
  });
});
