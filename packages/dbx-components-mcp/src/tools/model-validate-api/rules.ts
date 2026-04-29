/**
 * Validation rules run against an {@link ExtractedFile}. Rules accumulate
 * {@link Violation}s into a mutable buffer; the public entry point is
 * {@link validateModelApiSources} in `./index.ts`.
 */

import { basename } from 'node:path';
import { attachRemediation } from '../rule-catalog/index.js';
import { FUNCTIONS_BLOCK_ORDER, NON_CRUD_API_BASENAMES, type ExtractedFile, type ExtractedParamsDecl, type ExtractedParamsValidator, type ExtractedResultDecl, type FunctionsBlockKind, type Violation, type ViolationSeverity } from './types.js';

// MARK: Entry
/**
 * Applies every cross-file rule to a single extracted api file and returns the
 * aggregated diagnostics. Rules accumulate into a buffer so they can short-
 * circuit early when a structural prerequisite is missing.
 *
 * @param file - the extracted facts for one api source
 * @returns the violations the rules emit for that file
 */
export function runRules(file: ExtractedFile): readonly Violation[] {
  const violations: Violation[] = [];
  const base = basename(file.name);
  if (NON_CRUD_API_BASENAMES.includes(base)) {
    pushViolation(violations, {
      code: 'NON_CRUD_API_FILENAME',
      severity: 'warning',
      message: `File \`${base}\` uses the \`.api.ts\` convention but is not a CRUD model-api. Skipping structural validation — expose custom-function-map files separately.`,
      file: file.name,
      line: undefined,
      group: file.groupName
    });
    return violations;
  }
  if (!file.factoryCallSeen) {
    // Not a CRUD model-api file. Skip silently, mirroring the
    // model-validate behavior for non-model files.
    return violations;
  }
  checkRequiredExports(file, violations);
  checkGroupNameConsistency(file, violations);
  checkExportedFlags(file, violations);
  checkTypeAnnotations(file, violations);
  checkFactoryCall(file, violations);
  checkParamsValidatorPairing(file, violations);
  checkReadonlyFields(file, violations);
  checkMaybeWithoutClearable(file, violations);
  checkCrudKeyCoverage(file, violations);
  checkResultTupleForm(file, violations);
  checkFunctionsBlockOrder(file, violations);
  checkDeclarationsAfterFunctionsBlock(file, violations);
  checkMarkComments(file, violations);
  return violations;
}

// MARK: Required exports
function checkRequiredExports(file: ExtractedFile, violations: Violation[]): void {
  if (!file.functionTypeMap) {
    pushViolation(violations, {
      code: 'FILE_MISSING_FUNCTION_TYPE_MAP',
      message: 'Missing exported `<Group>FunctionTypeMap` type alias. Declare at least `export type <Group>FunctionTypeMap = {};` in the Functions block.',
      file: file.name,
      line: undefined,
      group: file.groupName
    });
  }
  if (!file.functionTypeConfigMap) {
    pushViolation(violations, {
      code: 'FILE_MISSING_FUNCTION_TYPE_CONFIG_MAP',
      message: 'Missing exported `<group>FunctionTypeConfigMap` const. Declare `export const <group>FunctionTypeConfigMap: FirebaseFunctionTypeConfigMap<<Group>FunctionTypeMap> = {};`.',
      file: file.name,
      line: undefined,
      group: file.groupName
    });
  }
  if (!file.crudConfigType) {
    pushViolation(violations, {
      code: 'FILE_MISSING_CRUD_CONFIG_TYPE',
      message: 'Missing exported `<Group>ModelCrudFunctionsConfig` type alias describing the CRUD shape per model.',
      file: file.name,
      line: undefined,
      group: file.groupName
    });
  }
  if (!file.crudConfigConst) {
    pushViolation(violations, {
      code: 'FILE_MISSING_CRUD_CONFIG_CONST',
      message: 'Missing exported `<group>ModelCrudFunctionsConfig` const. Declare `export const <group>ModelCrudFunctionsConfig: ModelFirebaseCrudFunctionConfigMap<<Group>ModelCrudFunctionsConfig, <Group>Types> = { ... };`.',
      file: file.name,
      line: undefined,
      group: file.groupName
    });
  }
  if (!file.functionsClass) {
    pushViolation(violations, {
      code: 'FILE_MISSING_FUNCTIONS_CLASS',
      message: 'Missing exported `<Group>Functions` abstract class. Declare `export abstract class <Group>Functions implements ModelFirebaseFunctionMap<<Group>FunctionTypeMap, <Group>ModelCrudFunctionsConfig> { ... }`.',
      file: file.name,
      line: undefined,
      group: file.groupName
    });
  }
  if (!file.functionMap) {
    pushViolation(violations, {
      code: 'FILE_MISSING_FUNCTION_MAP',
      message: 'Missing exported `<group>FunctionMap` const. Declare `export const <group>FunctionMap = callModelFirebaseFunctionMapFactory(<group>FunctionTypeConfigMap, <group>ModelCrudFunctionsConfig);`.',
      file: file.name,
      line: undefined,
      group: file.groupName
    });
  }
}

// MARK: Group name consistency
function checkGroupNameConsistency(file: ExtractedFile, violations: Violation[]): void {
  const group = file.groupName;
  if (!group) {
    return;
  }
  const group_camel = group.charAt(0).toLowerCase() + group.slice(1);
  const mismatches: { readonly identifier: string; readonly line: number | undefined }[] = [];
  const expect = (actual: string | undefined, expectedName: string, line: number | undefined): void => {
    if (actual && actual !== expectedName) {
      mismatches.push({ identifier: actual, line });
    }
  };
  expect(file.functionTypeMap?.name, `${group}FunctionTypeMap`, file.functionTypeMap?.line);
  expect(file.functionTypeConfigMap?.name, `${group_camel}FunctionTypeConfigMap`, file.functionTypeConfigMap?.line);
  expect(file.crudConfigType?.name, `${group}ModelCrudFunctionsConfig`, file.crudConfigType?.line);
  expect(file.crudConfigConst?.name, `${group_camel}ModelCrudFunctionsConfig`, file.crudConfigConst?.line);
  expect(file.functionMap?.name, `${group_camel}FunctionMap`, file.functionMap?.line);
  expect(file.functionsClass?.name, `${group}Functions`, file.functionsClass?.line);
  for (const m of mismatches) {
    pushViolation(violations, {
      code: 'FILE_GROUP_NAME_INCONSISTENT',
      message: `Identifier \`${m.identifier}\` does not match the inferred group name \`${group}\`. All six Functions-block exports must share the same stem.`,
      file: file.name,
      line: m.line,
      group
    });
  }
}

// MARK: Exported flags
function checkExportedFlags(file: ExtractedFile, violations: Violation[]): void {
  const entries: { readonly name: string; readonly exported: boolean; readonly line: number }[] = [];
  if (file.functionTypeMap) entries.push({ name: file.functionTypeMap.name, exported: file.functionTypeMap.exported, line: file.functionTypeMap.line });
  if (file.functionTypeConfigMap) entries.push({ name: file.functionTypeConfigMap.name, exported: file.functionTypeConfigMap.exported, line: file.functionTypeConfigMap.line });
  if (file.crudConfigType) entries.push({ name: file.crudConfigType.name, exported: file.crudConfigType.exported, line: file.crudConfigType.line });
  if (file.crudConfigConst) entries.push({ name: file.crudConfigConst.name, exported: file.crudConfigConst.exported, line: file.crudConfigConst.line });
  if (file.functionMap) entries.push({ name: file.functionMap.name, exported: file.functionMap.exported, line: file.functionMap.line });
  if (file.functionsClass) entries.push({ name: file.functionsClass.name, exported: file.functionsClass.exported, line: file.functionsClass.line });
  for (const entry of entries) {
    if (entry.exported) {
      continue;
    }
    pushViolation(violations, {
      code: 'FILE_NOT_EXPORTED',
      message: `\`${entry.name}\` must be exported.`,
      file: file.name,
      line: entry.line,
      group: file.groupName
    });
  }
}

// MARK: Type annotations on structural consts
function checkTypeAnnotations(file: ExtractedFile, violations: Violation[]): void {
  const group = file.groupName;
  if (file.functionTypeConfigMap && file.functionTypeMap) {
    const expected = `FirebaseFunctionTypeConfigMap<${file.functionTypeMap.name}>`;
    const actual = normalizeWhitespace(file.functionTypeConfigMap.typeAnnotation ?? '');
    if (actual !== normalizeWhitespace(expected)) {
      pushViolation(violations, {
        code: 'TYPE_CONFIG_MAP_WRONG_GENERIC',
        message: `\`${file.functionTypeConfigMap.name}\` must be typed \`${expected}\` (found \`${file.functionTypeConfigMap.typeAnnotation ?? '<none>'}\`).`,
        file: file.name,
        line: file.functionTypeConfigMap.line,
        group
      });
    }
  }
  if (file.crudConfigConst && file.crudConfigType && group) {
    const expected = `ModelFirebaseCrudFunctionConfigMap<${file.crudConfigType.name}, ${group}Types>`;
    const actual = normalizeWhitespace(file.crudConfigConst.typeAnnotation ?? '');
    if (actual !== normalizeWhitespace(expected)) {
      pushViolation(violations, {
        code: 'CRUD_CONFIG_CONST_WRONG_GENERIC',
        message: `\`${file.crudConfigConst.name}\` must be typed \`${expected}\` (found \`${file.crudConfigConst.typeAnnotation ?? '<none>'}\`).`,
        file: file.name,
        line: file.crudConfigConst.line,
        group
      });
    }
  }
  if (file.functionsClass && file.functionTypeMap && file.crudConfigType) {
    if (!file.functionsClass.isAbstract) {
      pushViolation(violations, {
        code: 'FUNCTIONS_CLASS_NOT_ABSTRACT',
        message: `Class \`${file.functionsClass.name}\` must be declared \`abstract\`.`,
        file: file.name,
        line: file.functionsClass.line,
        group
      });
    }
    const expectedImpl = `ModelFirebaseFunctionMap<${file.functionTypeMap.name}, ${file.crudConfigType.name}>`;
    const actualImpl = normalizeWhitespace(file.functionsClass.implementsText ?? '');
    if (actualImpl !== normalizeWhitespace(expectedImpl)) {
      pushViolation(violations, {
        code: 'FUNCTIONS_CLASS_BAD_IMPLEMENTS',
        message: `Class \`${file.functionsClass.name}\` must implement \`${expectedImpl}\` (found \`${file.functionsClass.implementsText ?? '<none>'}\`).`,
        file: file.name,
        line: file.functionsClass.line,
        group
      });
    }
  }
}

// MARK: Factory call
function checkFactoryCall(file: ExtractedFile, violations: Violation[]): void {
  const fn = file.functionMap;
  if (!fn) {
    return;
  }
  if (!fn.callsFactory) {
    pushViolation(violations, {
      code: 'FUNCTION_MAP_BAD_FACTORY_ARGS',
      message: `\`${fn.name}\` must be assigned \`callModelFirebaseFunctionMapFactory(<group>FunctionTypeConfigMap, <group>ModelCrudFunctionsConfig)\`.`,
      file: file.name,
      line: fn.line,
      group: file.groupName
    });
    return;
  }
  const expectedArgs: string[] = [];
  if (file.functionTypeConfigMap) expectedArgs.push(file.functionTypeConfigMap.name);
  if (file.crudConfigConst) expectedArgs.push(file.crudConfigConst.name);
  if (expectedArgs.length !== 2) {
    return;
  }
  if (fn.factoryArgs.length !== 2 || fn.factoryArgs[0] !== expectedArgs[0] || fn.factoryArgs[1] !== expectedArgs[1]) {
    pushViolation(violations, {
      code: 'FUNCTION_MAP_BAD_FACTORY_ARGS',
      message: `\`${fn.name}\` must call \`callModelFirebaseFunctionMapFactory(${expectedArgs[0]}, ${expectedArgs[1]})\` (found args: \`${fn.factoryArgs.join(', ') || '<none>'}\`).`,
      file: file.name,
      line: fn.line,
      group: file.groupName
    });
  }
}

// MARK: Params / validator pairing
interface CheckPairedDeclOptions {
  readonly file: ExtractedFile;
  readonly decl: ExtractedParamsDecl;
  readonly validator: ExtractedParamsValidator;
  readonly violations: Violation[];
}

function checkPairedDeclAdjacency(options: CheckPairedDeclOptions): void {
  const { file, decl, validator, violations } = options;
  if (validator.line <= decl.line) {
    pushViolation(violations, {
      code: 'PARAMS_VALIDATOR_NOT_ADJACENT',
      severity: 'warning',
      message: `\`${validator.name}\` is declared before its matching interface \`${decl.name}\`. Place the validator immediately after the interface.`,
      file: file.name,
      line: validator.line,
      group: file.groupName
    });
    return;
  }
  const blockers = findStatementsBetween({ file, lowExclusive: decl.line, highExclusive: validator.line, ignoreDeclName: decl.name, ignoreValidatorName: validator.name });
  if (blockers.length === 0) return;
  pushViolation(violations, {
    code: 'PARAMS_VALIDATOR_NOT_ADJACENT',
    severity: 'warning',
    message: `\`${validator.name}\` should immediately follow \`${decl.name}\` but other declarations appear between them (\`${blockers.join('`, `')}\`).`,
    file: file.name,
    line: validator.line,
    group: file.groupName
  });
}

function checkPairedDecl(options: CheckPairedDeclOptions): void {
  const { file, decl, validator, violations } = options;
  if (!decl.exported) {
    pushViolation(violations, {
      code: 'PARAMS_NOT_EXPORTED',
      message: `\`${decl.name}\` must be exported.`,
      file: file.name,
      line: decl.line,
      group: file.groupName
    });
  }
  if (!validator.exported) {
    pushViolation(violations, {
      code: 'PARAMS_VALIDATOR_NOT_EXPORTED',
      message: `\`${validator.name}\` must be exported.`,
      file: file.name,
      line: validator.line,
      group: file.groupName
    });
  }
  if (validator.castTargetName !== decl.name) {
    pushViolation(violations, {
      code: 'PARAMS_VALIDATOR_WRONG_CAST',
      message: `\`${validator.name}\` must end with \`as Type<${decl.name}>\` or \`as unknown as Type<${decl.name}>\` (found cast target: \`${validator.castTargetName ?? '<none>'}\`).`,
      file: file.name,
      line: validator.line,
      group: file.groupName
    });
  }
  checkPairedDeclAdjacency(options);
}

function checkParamsValidatorPairing(file: ExtractedFile, violations: Violation[]): void {
  const validatorByBase = new Map<string, ExtractedParamsValidator>();
  for (const v of file.paramsValidators) {
    const base = validatorBaseName(v.name);
    if (base) {
      validatorByBase.set(base, v);
    }
  }
  for (const decl of file.paramsDecls) {
    const validator = validatorByBase.get(decl.name);
    if (!validator) {
      pushViolation(violations, {
        code: 'PARAMS_MISSING_VALIDATOR',
        message: `\`${decl.name}\` has no matching \`${camelCase(decl.name)}Type\` validator. Every \`*Params\` declaration needs an Arktype validator.`,
        file: file.name,
        line: decl.line,
        group: file.groupName
      });
      continue;
    }
    checkPairedDecl({ file, decl, validator, violations });
  }
}

/**
 * Options for finding statements between two line numbers.
 */
interface FindStatementsBetweenOptions {
  readonly file: ExtractedFile;
  readonly lowExclusive: number;
  readonly highExclusive: number;
  readonly ignoreDeclName: string;
  readonly ignoreValidatorName: string;
}

function isLineBetween(line: number, lowExclusive: number, highExclusive: number): boolean {
  return line > lowExclusive && line < highExclusive;
}

function collectParamsDeclsBetween(file: ExtractedFile, lowExclusive: number, highExclusive: number, ignoreDeclName: string): readonly string[] {
  return file.paramsDecls.filter((d) => d.name !== ignoreDeclName && isLineBetween(d.line, lowExclusive, highExclusive)).map((d) => d.name);
}

function collectParamsValidatorsBetween(file: ExtractedFile, lowExclusive: number, highExclusive: number, ignoreValidatorName: string): readonly string[] {
  return file.paramsValidators.filter((v) => v.name !== ignoreValidatorName && isLineBetween(v.line, lowExclusive, highExclusive)).map((v) => v.name);
}

function collectResultDeclsBetween(file: ExtractedFile, lowExclusive: number, highExclusive: number): readonly string[] {
  return file.resultDecls.filter((r) => isLineBetween(r.line, lowExclusive, highExclusive)).map((r) => r.name);
}

function findStatementsBetween(options: FindStatementsBetweenOptions): readonly string[] {
  const { file, lowExclusive, highExclusive, ignoreDeclName, ignoreValidatorName } = options;
  return [...collectParamsDeclsBetween(file, lowExclusive, highExclusive, ignoreDeclName), ...collectParamsValidatorsBetween(file, lowExclusive, highExclusive, ignoreValidatorName), ...collectResultDeclsBetween(file, lowExclusive, highExclusive)];
}

function validatorBaseName(name: string): string | undefined {
  if (!name.endsWith('ParamsType')) {
    return undefined;
  }
  const stem = name.slice(0, -'Type'.length);
  if (stem.length === 0) {
    return undefined;
  }
  return stem.charAt(0).toUpperCase() + stem.slice(1);
}

function camelCase(pascal: string): string {
  if (pascal.length === 0) {
    return pascal;
  }
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

// MARK: Readonly fields
function checkReadonlyFields(file: ExtractedFile, violations: Violation[]): void {
  for (const decl of file.paramsDecls) {
    if (!decl.isInterface) continue;
    checkInterfaceReadonly({ file, decl, code: 'PARAMS_FIELD_NOT_READONLY', violations });
  }
  for (const decl of file.resultDecls) {
    if (!decl.isInterface) continue;
    checkInterfaceReadonly({ file, decl, code: 'RESULT_FIELD_NOT_READONLY', violations });
  }
}

/**
 * Options for checking interface readonly fields.
 */
interface CheckInterfaceReadonlyOptions {
  readonly file: ExtractedFile;
  readonly decl: ExtractedParamsDecl | ExtractedResultDecl;
  readonly code: 'PARAMS_FIELD_NOT_READONLY' | 'RESULT_FIELD_NOT_READONLY';
  readonly violations: Violation[];
}

function checkInterfaceReadonly(options: CheckInterfaceReadonlyOptions): void {
  const { file, decl, code, violations } = options;
  for (const field of decl.fields) {
    if (field.readonly) continue;
    pushViolation(violations, {
      code,
      severity: 'warning',
      message: `Field \`${field.name}\` on \`${decl.name}\` should be declared \`readonly\`.`,
      file: file.name,
      line: field.line,
      group: file.groupName
    });
  }
}

// MARK: Maybe without clearable
function checkMaybeWithoutClearable(file: ExtractedFile, violations: Violation[]): void {
  const validatorByBase = new Map<string, ExtractedParamsValidator>();
  for (const v of file.paramsValidators) {
    const base = validatorBaseName(v.name);
    if (base) {
      validatorByBase.set(base, v);
    }
  }
  for (const decl of file.paramsDecls) {
    if (!decl.isInterface) continue;
    const validator = validatorByBase.get(decl.name);
    if (!validator || validator.properties.length === 0) continue;
    const propByName = new Map<string, (typeof validator.properties)[number]>();
    for (const p of validator.properties) {
      propByName.set(p.name, p);
    }
    for (const field of decl.fields) {
      if (!field.hasMaybeType) continue;
      const prop = propByName.get(field.name);
      if (!prop) continue; // field in interface but not in validator (merged from base type); skip.
      if (prop.hasClearable) continue;
      pushViolation(violations, {
        code: 'PARAMS_MAYBE_WITHOUT_CLEARABLE',
        severity: 'warning',
        message: `Field \`${field.name}\` on \`${decl.name}\` is \`Maybe<...>\` but \`${validator.name}\` does not wrap its value in \`clearable(...)\`. Use \`clearable(...)\` to allow explicit clearing.`,
        file: file.name,
        line: prop.line,
        group: file.groupName
      });
    }
  }
}

// MARK: CRUD key coverage
function checkCrudKeyCoverage(file: ExtractedFile, violations: Violation[]): void {
  const typeKeys = file.crudConfigType?.nonNullKeys;
  if (!typeKeys) return;
  if (file.functionsClass) {
    const classMembers = new Set(file.functionsClass.memberNames);
    for (const key of typeKeys) {
      if (!classMembers.has(key)) {
        pushViolation(violations, {
          code: 'CRUD_CLASS_MISSING_KEY',
          severity: 'warning',
          message: `Class \`${file.functionsClass.name}\` is missing abstract member \`${key}\` declared in \`${file.crudConfigType?.name ?? '<config>'}\`.`,
          file: file.name,
          line: file.functionsClass.line,
          group: file.groupName
        });
      }
    }
  }
  if (file.crudConfigConst) {
    const runtimeKeys = new Set(file.crudConfigConst.runtimeKeys);
    for (const key of typeKeys) {
      if (!runtimeKeys.has(key)) {
        pushViolation(violations, {
          code: 'CRUD_CONST_MISSING_KEY',
          severity: 'warning',
          message: `\`${file.crudConfigConst.name}\` is missing a runtime entry for \`${key}\` declared in \`${file.crudConfigType?.name ?? '<config>'}\`.`,
          file: file.name,
          line: file.crudConfigConst.line,
          group: file.groupName
        });
      }
    }
  }
}

// MARK: Result tuple form
function checkResultTupleForm(file: ExtractedFile, violations: Violation[]): void {
  const configType = file.crudConfigType;
  if (!configType) return;
  const resultNames = new Set(file.resultDecls.map((r) => r.name));
  for (const paramsName of configType.bareLeafParamsNames) {
    if (!paramsName.endsWith('Params')) continue;
    const resultName = paramsName.slice(0, -'Params'.length) + 'Result';
    if (!resultNames.has(resultName)) continue;
    pushViolation(violations, {
      code: 'CRUD_CONFIG_MISSING_RESULT_TUPLE',
      severity: 'warning',
      message: `\`${configType.name}\` references \`${paramsName}\` in bare form but a matching \`${resultName}\` interface is declared. Use tuple form \`[${paramsName}, ${resultName}]\` so the return type is declared in the typing.`,
      file: file.name,
      line: configType.line,
      group: file.groupName
    });
  }
}

// MARK: Functions block order
function checkFunctionsBlockOrder(file: ExtractedFile, violations: Violation[]): void {
  const entries: { readonly kind: FunctionsBlockKind; readonly line: number; readonly name: string }[] = [];
  if (file.functionTypeMap) entries.push({ kind: 'functionTypeMap', line: file.functionTypeMap.line, name: file.functionTypeMap.name });
  if (file.functionTypeConfigMap) entries.push({ kind: 'functionTypeConfigMap', line: file.functionTypeConfigMap.line, name: file.functionTypeConfigMap.name });
  if (file.crudConfigType) entries.push({ kind: 'crudConfigType', line: file.crudConfigType.line, name: file.crudConfigType.name });
  if (file.crudConfigConst) entries.push({ kind: 'crudConfigConst', line: file.crudConfigConst.line, name: file.crudConfigConst.name });
  if (file.functionMap) entries.push({ kind: 'functionMap', line: file.functionMap.line, name: file.functionMap.name });
  if (file.functionsClass) entries.push({ kind: 'functionsClass', line: file.functionsClass.line, name: file.functionsClass.name });
  const kindOrder = new Map(FUNCTIONS_BLOCK_ORDER.map((k, i) => [k, i] as const));
  const sortedByLine = [...entries].sort((a, b) => a.line - b.line);
  for (let i = 1; i < sortedByLine.length; i++) {
    const prev = sortedByLine[i - 1];
    const curr = sortedByLine[i];
    const prevIdx = kindOrder.get(prev.kind) ?? -1;
    const currIdx = kindOrder.get(curr.kind) ?? -1;
    if (currIdx < prevIdx) {
      pushViolation(violations, {
        code: 'FUNCTIONS_BLOCK_OUT_OF_ORDER',
        severity: 'warning',
        message: `\`${curr.name}\` (${curr.kind}) appears after \`${prev.name}\` (${prev.kind}). Expected order: ${FUNCTIONS_BLOCK_ORDER.join(' → ')}.`,
        file: file.name,
        line: curr.line,
        group: file.groupName
      });
      return;
    }
  }
}

// MARK: Declarations after Functions block
function checkDeclarationsAfterFunctionsBlock(file: ExtractedFile, violations: Violation[]): void {
  const blockLine = file.firstFunctionsBlockLine;
  if (blockLine === undefined) return;
  for (const decl of file.paramsDecls) {
    if (decl.line > blockLine) {
      pushViolation(violations, {
        code: 'DECL_AFTER_FUNCTIONS_BLOCK',
        severity: 'warning',
        message: `\`${decl.name}\` is declared after the Functions block (starts at line ${blockLine}). Move all \`*Params\` / \`*Result\` declarations above the Functions block.`,
        file: file.name,
        line: decl.line,
        group: file.groupName
      });
    }
  }
  for (const v of file.paramsValidators) {
    if (v.line > blockLine) {
      pushViolation(violations, {
        code: 'DECL_AFTER_FUNCTIONS_BLOCK',
        severity: 'warning',
        message: `\`${v.name}\` is declared after the Functions block (starts at line ${blockLine}).`,
        file: file.name,
        line: v.line,
        group: file.groupName
      });
    }
  }
  for (const r of file.resultDecls) {
    if (r.line > blockLine) {
      pushViolation(violations, {
        code: 'DECL_AFTER_FUNCTIONS_BLOCK',
        severity: 'warning',
        message: `\`${r.name}\` is declared after the Functions block (starts at line ${blockLine}).`,
        file: file.name,
        line: r.line,
        group: file.groupName
      });
    }
  }
}

// MARK: MARK comments
function checkMarkComments(file: ExtractedFile, violations: Violation[]): void {
  const hasKeys = file.markComments.some((c) => c.label.toLowerCase() === 'keys');
  const hasFunctions = file.markComments.some((c) => c.label.toLowerCase() === 'functions');
  const firstParamsLine = file.firstParamsOrResultLine;
  const marksBeforeParams = firstParamsLine === undefined ? file.markComments : file.markComments.filter((c) => c.line < firstParamsLine);
  if (marksBeforeParams.length === 0 && firstParamsLine !== undefined) {
    pushViolation(violations, {
      code: 'FILE_MISSING_MARK_CONSTANTS',
      severity: 'warning',
      message: 'No `// MARK:` comment precedes the first param/result declaration. Add a section marker (e.g. `// MARK: Constants`) to separate top-of-file constants from the params/results.',
      file: file.name,
      line: undefined,
      group: file.groupName
    });
  }
  if (!hasKeys) {
    pushViolation(violations, {
      code: 'FILE_MISSING_MARK_KEYS',
      severity: 'warning',
      message: 'Missing `// MARK: Keys` section marker. Add it between the params/results section and the Functions block (even if the keys section is empty).',
      file: file.name,
      line: undefined,
      group: file.groupName
    });
  }
  if (!hasFunctions) {
    pushViolation(violations, {
      code: 'FILE_MISSING_MARK_FUNCTIONS',
      severity: 'warning',
      message: 'Missing `// MARK: Functions` section marker. Add it immediately before the Functions block.',
      file: file.name,
      line: undefined,
      group: file.groupName
    });
  }
}

// MARK: Helpers
function normalizeWhitespace(s: string): string {
  return s.replaceAll(/\s+/g, '');
}

function pushViolation(buffer: Violation[], violation: Omit<Violation, 'severity' | 'remediation'> & { readonly severity?: ViolationSeverity }): void {
  const severity: ViolationSeverity = violation.severity ?? 'error';
  const filled: Violation = {
    code: violation.code,
    severity,
    message: violation.message,
    file: violation.file,
    line: violation.line,
    group: violation.group,
    remediation: attachRemediation(violation.code)
  };
  buffer.push(filled);
}
