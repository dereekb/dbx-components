/**
 * Violation codes emitted by `dbx_model_validate_api`.
 *
 * Each member is the source of truth for its rule documentation.
 * `extract-rule-catalog` walks the JSDoc summary + `@dbxRule*` tags
 * off each member and emits the runtime catalog. See
 * `src/tools/rule-catalog/types.ts` for the tag vocabulary.
 *
 * The validator runs over `<model>.api.ts` files that pair param /
 * result interfaces with Arktype validators and end in a Functions
 * block (the six `functionTypeMap` / `functionTypeConfigMap` /
 * `crudConfigType` / `crudConfigConst` / `functionMap` /
 * `functionsClass` exports). Hard errors flag structural breakage;
 * warnings flag convention deviations.
 */
export enum ModelValidateApiCode {
  /**
   * `<group>FunctionTypeMap` type alias is missing from the file.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every `<model>.api.ts` file (other than the non-CRUD basenames listed in `NON_CRUD_API_BASENAMES`).
   * @dbxRuleNotApplies Files matching a `NON_CRUD_API_BASENAMES` entry (e.g. `development.api.ts`) — those short-circuit structural checks.
   * @dbxRuleFix Add `export type <Group>FunctionTypeMap = { /* keys *\/ };` at the top of the Functions block.
   * @dbxRuleSeeAlso doc:dbx__guide__call-model-api
   */
  FILE_MISSING_FUNCTION_TYPE_MAP = 'FILE_MISSING_FUNCTION_TYPE_MAP',

  /**
   * `<group>FunctionTypeConfigMap` constant is missing from the file.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every `<model>.api.ts` file with a Functions block.
   * @dbxRuleNotApplies Non-CRUD api filenames listed in `NON_CRUD_API_BASENAMES`.
   * @dbxRuleFix Add `export const <group>FunctionTypeConfigMap: ModelFirebaseFunctionMapTypeConfigMap<<Group>FunctionTypeMap> = { ... };` aligned with the type-map keys.
   * @dbxRuleSeeAlso doc:dbx__guide__call-model-api
   */
  FILE_MISSING_FUNCTION_TYPE_CONFIG_MAP = 'FILE_MISSING_FUNCTION_TYPE_CONFIG_MAP',

  /**
   * `<Group>FunctionTypeCrudConfig` type alias is missing from the file.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every `<model>.api.ts` file with a Functions block.
   * @dbxRuleNotApplies Non-CRUD api filenames listed in `NON_CRUD_API_BASENAMES`.
   * @dbxRuleFix Add `export type <Group>FunctionTypeCrudConfig = ModelFirebaseCrudFunctionConfigMap<<Group>FunctionTypeMap>;` to bind the CRUD shape to the type map.
   */
  FILE_MISSING_CRUD_CONFIG_TYPE = 'FILE_MISSING_CRUD_CONFIG_TYPE',

  /**
   * `<group>FunctionTypeCrudConfig` constant is missing from the file.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every `<model>.api.ts` file with a Functions block.
   * @dbxRuleNotApplies Non-CRUD api filenames listed in `NON_CRUD_API_BASENAMES`.
   * @dbxRuleFix Add `export const <group>FunctionTypeCrudConfig: <Group>FunctionTypeCrudConfig = { ... };` mapping each CRUD key to its `[Params, Result]` tuple or `null`.
   */
  FILE_MISSING_CRUD_CONFIG_CONST = 'FILE_MISSING_CRUD_CONFIG_CONST',

  /**
   * `<Group>Functions` abstract class is missing from the file.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every `<model>.api.ts` file with a Functions block.
   * @dbxRuleNotApplies Non-CRUD api filenames listed in `NON_CRUD_API_BASENAMES`.
   * @dbxRuleFix Add `export abstract class <Group>Functions implements ModelFirebaseFunctionsConfigMap<<Group>FunctionTypeMap, <Group>FunctionTypeCrudConfig> { ... }` with one abstract member per non-null CRUD key.
   */
  FILE_MISSING_FUNCTIONS_CLASS = 'FILE_MISSING_FUNCTIONS_CLASS',

  /**
   * `<group>FunctionMap` constant is missing from the file.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every `<model>.api.ts` file with a Functions block.
   * @dbxRuleNotApplies Non-CRUD api filenames listed in `NON_CRUD_API_BASENAMES`.
   * @dbxRuleFix Add `export const <group>FunctionMap = callModelFirebaseFunctionMapFactory(<group>FunctionTypeConfigMap, <group>FunctionTypeCrudConfig);` to wire the runtime call map.
   */
  FILE_MISSING_FUNCTION_MAP = 'FILE_MISSING_FUNCTION_MAP',

  /**
   * The Functions block declarations don't all share the same `<group>` prefix.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When the inferred group name on the type map, config map, CRUD type/const, function map, or class differs from the file's primary group.
   * @dbxRuleNotApplies Files where the prefix mismatch is intentional (rare — convention requires consistent naming).
   * @dbxRuleFix Rename the divergent declaration so every Functions-block export shares the same `<group>` prefix.
   */
  FILE_GROUP_NAME_INCONSISTENT = 'FILE_GROUP_NAME_INCONSISTENT',

  /**
   * A required Functions-block declaration exists but isn't `export`ed.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Any of the six Functions-block exports declared without the `export` keyword.
   * @dbxRuleNotApplies No known false-positive cases — the call map / class are consumed across packages and must be exported.
   * @dbxRuleFix Add the `export` keyword to the declaration.
   */
  FILE_NOT_EXPORTED = 'FILE_NOT_EXPORTED',

  /**
   * `<group>FunctionTypeConfigMap` is annotated with the wrong generic argument.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When the type annotation isn't `ModelFirebaseFunctionMapTypeConfigMap<<Group>FunctionTypeMap>`.
   * @dbxRuleNotApplies No known false-positive cases — the generic ties the config map to the type map by design.
   * @dbxRuleFix Set the annotation to `ModelFirebaseFunctionMapTypeConfigMap<<Group>FunctionTypeMap>` matching the file's type-map name.
   */
  TYPE_CONFIG_MAP_WRONG_GENERIC = 'TYPE_CONFIG_MAP_WRONG_GENERIC',

  /**
   * `<group>FunctionTypeCrudConfig` constant is annotated with the wrong generic argument.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When the type annotation on the const isn't the matching `<Group>FunctionTypeCrudConfig` type alias.
   * @dbxRuleNotApplies No known false-positive cases — the generic must point at the local type alias.
   * @dbxRuleFix Set the annotation to `<Group>FunctionTypeCrudConfig` so the call map shape is inferred from the type map.
   */
  CRUD_CONFIG_CONST_WRONG_GENERIC = 'CRUD_CONFIG_CONST_WRONG_GENERIC',

  /**
   * `<Group>Functions` is declared as `class` rather than `abstract class`.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When the class declaration is missing the `abstract` modifier.
   * @dbxRuleNotApplies No known false-positive cases — the Functions class is implemented downstream by the API app.
   * @dbxRuleFix Add the `abstract` modifier so concrete CRUD members are bound by the consuming `*ServerActions` class.
   */
  FUNCTIONS_CLASS_NOT_ABSTRACT = 'FUNCTIONS_CLASS_NOT_ABSTRACT',

  /**
   * `<Group>Functions` declares the wrong `implements` clause.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When the first `implements` clause text isn't `ModelFirebaseFunctionsConfigMap<<Group>FunctionTypeMap, <Group>FunctionTypeCrudConfig>` (with the local type/const names).
   * @dbxRuleNotApplies No known false-positive cases — the implements clause keeps the abstract members in sync with the CRUD config.
   * @dbxRuleFix Replace the implements clause with `ModelFirebaseFunctionsConfigMap<<Group>FunctionTypeMap, <Group>FunctionTypeCrudConfig>`.
   */
  FUNCTIONS_CLASS_BAD_IMPLEMENTS = 'FUNCTIONS_CLASS_BAD_IMPLEMENTS',

  /**
   * `<group>FunctionMap = callModelFirebaseFunctionMapFactory(...)` was called with the wrong argument identifiers.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When the factory call's two argument identifiers don't match `<group>FunctionTypeConfigMap` and `<group>FunctionTypeCrudConfig` (in that order).
   * @dbxRuleNotApplies No known false-positive cases — the factory must be passed the file's own config + crud-config consts.
   * @dbxRuleFix Pass `<group>FunctionTypeConfigMap` first and `<group>FunctionTypeCrudConfig` second, matching the local declarations.
   */
  FUNCTION_MAP_BAD_FACTORY_ARGS = 'FUNCTION_MAP_BAD_FACTORY_ARGS',

  /**
   * A `*Params` interface has no matching `*ParamsType` Arktype validator.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every `*Params` declaration referenced by the CRUD config.
   * @dbxRuleNotApplies Params that are intentionally unvalidated (rare — every public CRUD entry needs a runtime validator).
   * @dbxRuleFix Add `export const <foo>ParamsType = type({ ... }) as unknown as RuntimeTypeValidator<<Foo>Params>;` adjacent to the interface.
   * @dbxRuleSeeAlso doc:dbx__guide__call-model-api
   */
  PARAMS_MISSING_VALIDATOR = 'PARAMS_MISSING_VALIDATOR',

  /**
   * A `*ParamsType` validator is cast to the wrong target type.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When the validator's `as ... <Type>` cast doesn't reference the matching `*Params` interface.
   * @dbxRuleNotApplies No known false-positive cases — the cast is what links the validator to the params interface at the type level.
   * @dbxRuleFix Cast the validator to `RuntimeTypeValidator<<Foo>Params>` (or `as unknown as RuntimeTypeValidator<<Foo>Params>`) so the CRUD config infers the right shape.
   */
  PARAMS_VALIDATOR_WRONG_CAST = 'PARAMS_VALIDATOR_WRONG_CAST',

  /**
   * A `*Params` declaration exists but isn't `export`ed.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Any `*Params` interface or type alias declared without the `export` keyword.
   * @dbxRuleNotApplies Internal helper params that aren't part of the CRUD config (rare — most params are referenced by the call map).
   * @dbxRuleFix Add the `export` keyword so the params can be referenced by downstream packages and the validator's cast.
   */
  PARAMS_NOT_EXPORTED = 'PARAMS_NOT_EXPORTED',

  /**
   * A `*ParamsType` validator declaration exists but isn't `export`ed.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Any `*ParamsType` constant declared without the `export` keyword.
   * @dbxRuleNotApplies No known false-positive cases — validators are consumed by the runtime CRUD wiring.
   * @dbxRuleFix Add the `export` keyword so the validator can be referenced by the runtime wiring.
   */
  PARAMS_VALIDATOR_NOT_EXPORTED = 'PARAMS_VALIDATOR_NOT_EXPORTED',

  /**
   * A `*ParamsType` validator isn't declared adjacent to its `*Params` interface.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When the validator and its params interface are separated by another top-level declaration.
   * @dbxRuleNotApplies Files where the validator must live in a different region for project-specific reasons.
   * @dbxRuleFix Move the validator immediately after its params interface so the pair stays grouped.
   */
  PARAMS_VALIDATOR_NOT_ADJACENT = 'PARAMS_VALIDATOR_NOT_ADJACENT',

  /**
   * A field on a `*Params` interface is missing the `readonly` modifier.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Every property on a `*Params` interface (type aliases are skipped).
   * @dbxRuleNotApplies Fields whose type system needs mutability (rare — params are immutable by convention).
   * @dbxRuleFix Add `readonly` to the property so the params shape stays immutable.
   * @dbxRuleSeeAlso doc:dbx__note__typescript-programming
   */
  PARAMS_FIELD_NOT_READONLY = 'PARAMS_FIELD_NOT_READONLY',

  /**
   * A field on a `*Result` interface is missing the `readonly` modifier.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Every property on a `*Result` interface (type aliases are skipped).
   * @dbxRuleNotApplies Fields whose type system needs mutability (rare — results are immutable by convention).
   * @dbxRuleFix Add `readonly` to the property so the result shape stays immutable.
   * @dbxRuleSeeAlso doc:dbx__note__typescript-programming
   */
  RESULT_FIELD_NOT_READONLY = 'RESULT_FIELD_NOT_READONLY',

  /**
   * A `*ParamsType` validator declares a `Maybe<...>` field without `clearable(...)`.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When the params interface field is wrapped in `Maybe<T>` but the validator's matching property doesn't call `clearable(...)`.
   * @dbxRuleNotApplies Fields that intentionally accept `null` / `undefined` without the clearable wrapper (rare — convention is to use `clearable`).
   * @dbxRuleFix Wrap the validator property's value with `clearable(...)` so optional / clearable fields decode correctly at runtime.
   */
  PARAMS_MAYBE_WITHOUT_CLEARABLE = 'PARAMS_MAYBE_WITHOUT_CLEARABLE',

  /**
   * A non-null CRUD key is missing the matching abstract member on `<Group>Functions`.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Every non-null key of `<Group>FunctionTypeCrudConfig` that doesn't appear as a member name on the abstract Functions class.
   * @dbxRuleNotApplies Keys covered by an inherited member from a base class (rare — CRUD members are declared per file by convention).
   * @dbxRuleFix Add `abstract <key>: ModelFirebaseFunctionMapFunction<<Group>FunctionTypeMap, '<key>'>;` to the class.
   */
  CRUD_CLASS_MISSING_KEY = 'CRUD_CLASS_MISSING_KEY',

  /**
   * A non-null CRUD key is missing from the runtime `<group>FunctionTypeCrudConfig` const.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Every non-null key declared on the `<Group>FunctionTypeCrudConfig` type that doesn't appear as a runtime key on the const.
   * @dbxRuleNotApplies Keys whose runtime entry is contributed by another file (rare — convention is to keep type + const in lockstep).
   * @dbxRuleFix Add `<key>: [<Foo>ParamsType, <Foo>Result]` (or the bare `*Params` form) to the const.
   */
  CRUD_CONST_MISSING_KEY = 'CRUD_CONST_MISSING_KEY',

  /**
   * A CRUD config leaf references the bare `*Params` interface without the `[Params, Result]` tuple form.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Every CRUD leaf that uses `<key>: <Foo>ParamsType` instead of `<key>: [<Foo>ParamsType, <Foo>Result]`.
   * @dbxRuleNotApplies CRUD entries whose result type is intentionally `void` (rare — convention is to declare `*Result` and use the tuple form).
   * @dbxRuleFix Convert the leaf to the tuple form `[<Foo>ParamsType, <Foo>Result]` so the function signature carries the result type.
   */
  CRUD_CONFIG_MISSING_RESULT_TUPLE = 'CRUD_CONFIG_MISSING_RESULT_TUPLE',

  /**
   * The Functions-block declarations aren't in canonical order.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When the actual on-disk order of `functionTypeMap` / `functionTypeConfigMap` / `crudConfigType` / `crudConfigConst` / `functionMap` / `functionsClass` doesn't match the canonical order in `FUNCTIONS_BLOCK_ORDER`.
   * @dbxRuleNotApplies Files where the order is intentionally different for project-specific reasons.
   * @dbxRuleFix Reorder the Functions-block declarations to match `FUNCTIONS_BLOCK_ORDER`.
   */
  FUNCTIONS_BLOCK_OUT_OF_ORDER = 'FUNCTIONS_BLOCK_OUT_OF_ORDER',

  /**
   * A `*Params` / `*Result` declaration appears below the Functions block.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When a params or result declaration's line number falls after the first Functions-block declaration.
   * @dbxRuleNotApplies Files where the declaration order is intentionally inverted for project-specific reasons.
   * @dbxRuleFix Move the params/result declaration above the Functions block so the file reads top-down: types → validators → Functions.
   */
  DECL_AFTER_FUNCTIONS_BLOCK = 'DECL_AFTER_FUNCTIONS_BLOCK',

  /**
   * The file is missing the `// MARK: Constants` (or equivalent) section comment.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Every CRUD api file expected to declare top-level constants alongside the params/results.
   * @dbxRuleNotApplies Files with no top-level constants — the marker is purely organizational.
   * @dbxRuleFix Add a `// MARK: Constants` comment above the constants region so navigation and folding work consistently.
   */
  FILE_MISSING_MARK_CONSTANTS = 'FILE_MISSING_MARK_CONSTANTS',

  /**
   * The file is missing the `// MARK: Keys` section comment.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Every CRUD api file expected to declare key types alongside the params/results.
   * @dbxRuleNotApplies Files with no key declarations — the marker is purely organizational.
   * @dbxRuleFix Add a `// MARK: Keys` comment above the keys region so navigation and folding work consistently.
   */
  FILE_MISSING_MARK_KEYS = 'FILE_MISSING_MARK_KEYS',

  /**
   * The file is missing the `// MARK: Functions` section comment above the Functions block.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Every CRUD api file with a Functions block.
   * @dbxRuleNotApplies Files matching `NON_CRUD_API_BASENAMES` (no Functions block expected).
   * @dbxRuleFix Add a `// MARK: Functions` comment immediately above the Functions block so the file's top-down structure stays scannable.
   */
  FILE_MISSING_MARK_FUNCTIONS = 'FILE_MISSING_MARK_FUNCTIONS',

  /**
   * A `.api.ts` file follows the naming convention but is not a CRUD model api.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Files whose basename appears in `NON_CRUD_API_BASENAMES` (e.g. `development.api.ts`).
   * @dbxRuleNotApplies CRUD-style api files — those run the full structural pass.
   * @dbxRuleFix Either rename the file (drop `.api.ts`) or accept the warning — structural checks are intentionally short-circuited.
   */
  NON_CRUD_API_FILENAME = 'NON_CRUD_API_FILENAME'
}

/**
 * String-literal union derived from {@link ModelValidateApiCode}.
 */
export type ModelValidateApiCodeString = `${ModelValidateApiCode}`;
