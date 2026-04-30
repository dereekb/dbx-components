import { type ArrayOrValue, type Building, type Maybe, type MaybeMap, type MaybeSo, type Milliseconds, NOOP_MODIFIER, asArray, filterNullAndUndefinedValues, filterUndefinedValues, filterUniqueValues, mapMaybeFunction, mergeArrays, objectHasNoKeys } from '@dereekb/util';
import { type AsyncCustomValidator, type CustomFnConfig, type CustomValidator, type EvaluationContext, type FieldDef, type FieldMeta, type FieldWithValidation, type LogicConfig, type ValidationMessages, type ValidatorConfig, type WrapperConfig } from '@ng-forge/dynamic-forms';
import { type DbxForgeFieldValidation } from './field.type';
import { type DbxForgeField, type DbxForgeFieldFormConfig, mergeDbxForgeFieldFormConfig } from '../form/forge.form';

export const SELF_DEPENDENCY_TOKEN = '$self' as const; // TODO: Import from ng-forge?

// MARK: Forge Field
/**
 * Contains a reference to a hint value of some type.
 */
export type DbxForgeFieldHintValueRef<T> = {
  hint?: T;
};

/**
 * A field config that includes an optional hint and description variable.
 */
export type DbxForgeFieldHintOrDescriptionValueRef<T> = DbxForgeFieldHintValueRef<T> & {
  /**
   * @deprecated use hint instead.
   */
  description?: T;
};

/**
 * A field config that includes an optional logic variable.
 */
export type DbxForgeFieldLogicValueRef<T> = {
  logic?: T[];
};

// MARK: Field Def
/**
 * This is an internal type.
 *
 * @see {@link DbxForgeFieldFunctionDef} instead.
 */
type _DbxForgeFieldFunctionDef<F extends FieldDef<any>> =
  F extends FieldDef<infer TProps, infer _TMeta>
    ? // If the props includes hint,
      TProps extends DbxForgeFieldHintValueRef<infer T>
      ? Pick<F, 'key'> & Partial<Omit<F, 'key' | 'type'>> & DbxForgeFieldHintOrDescriptionValueRef<T>
      : Pick<F, 'key'> & Partial<Omit<F, 'key' | 'type'>>
    : never;

/**
 * Represents an @ng-forge/dynamic-forms FieldDef that has been augmented with dbx-form specific properties.
 *
 * Is used in builder functions for a specific FieldDef that already pre-configures the key and type.
 *
 * Branded config type for forge field functions. Intersects DbxForgeFieldFunctionDef<F> with
 * custom config properties C, and carries a phantom __fieldDef property so F can be
 * extracted without conditional type inference.
 */
export type DbxForgeFieldFunctionDef<F extends FieldDef<any>, C = unknown> = _DbxForgeFieldFunctionDef<F> & C & { readonly __fieldDef?: F };

/**
 * Extracts the FieldDef type F from a DbxForgeFieldFunctionConfigDef via the phantom __fieldDef brand.
 */
export type ExtractDbxForgeFieldDef<C> = C extends { __fieldDef?: infer F extends FieldDef<any> } ? F : FieldDef<any>;

/**
 * Represents the array-type of of a FieldDef's logic type.
 */
export type DbxForgeFieldFunctionDefLogicValue<C extends DbxForgeFieldFunctionDef<any>> = C extends DbxForgeFieldFunctionDef<infer F> ? (F extends DbxForgeFieldLogicValueRef<infer T> ? T : never) : never;

/**
 * Sync custom function for a derivation logic entry.
 *
 * When provided in addLogic(), the builder auto-registers this function
 * in _formConfig.customFnConfig.derivations under the given (or auto-generated) functionName.
 */
export type DbxForgeFieldLogicFn<O = any, I = any> = (ctx: EvaluationContext<I>) => O;

interface DbxForgeFieldLogicFnFunctionRef<O = any, I = any> {
  readonly fn: DbxForgeFieldLogicFn<O, I>;
}

/**
 * Async custom function for a derivation logic entry.
 *
 * When provided in addLogic(), the builder auto-registers this function
 * in _formConfig.customFnConfig.asyncDerivations under the given (or auto-generated) asyncFunctionName.
 */
export type DbxForgeFieldLogicAsyncFn<O = any, I = any> = (ctx: EvaluationContext<I>) => Promise<O>;

interface DbxForgeFieldLogicAsyncFnFunctionRef<O = any, I = any> {
  readonly fn: DbxForgeFieldLogicAsyncFn<O, I>;
}

/**
 * The externalData declared within a logic declaration.
 *
 * Is merged into the final form config later.
 */
export type DbxForgeFieldLogicExternalData = DbxForgeFieldFormConfig['externalData'];

// MARK: DbxForgeFieldFunction
/**
 * The result of a DbxForgeFieldFunction.
 */
export type DbxForgeFieldFunctionResult<C extends DbxForgeFieldFunctionDef<any>> = C extends DbxForgeFieldFunctionDef<infer F> ? DbxForgeField<F> : never;

/**
 * Creates the target FieldDef value from the input config and optional configure function.
 */
export type DbxForgeFieldFunction<C extends DbxForgeFieldFunctionDef<any>, F extends FieldDef<any> = ExtractDbxForgeFieldDef<C>> = (input: C, configure?: Maybe<ArrayOrValue<DbxForgeBuildFieldDefFunction<C>>>) => DbxForgeField<F>;

/**
 * Builds the FieldDef from the input config and props and optional configure function.
 */
export type DbxForgeFieldFunctionFieldDefBuilder<C extends DbxForgeFieldFunctionDef<any>, FV = any> = (input: Building<C>, props: C['props'], configure?: Maybe<ArrayOrValue<DbxForgeBuildFieldDefFunction<C, FV>>>) => DbxForgeFieldFunctionResult<C> | void;

/**
 * Generates custom props from the input config.
 *
 * This result is merged with the existing props on the input, if a props variable exists.
 *
 * All undefined values are filtered out. All defined values will override the existing props.
 */
export type DbxForgeFieldFunctionConfigPropsBuilder<C extends DbxForgeFieldFunctionDef<any>> = (input: C) => Partial<C['props']>;

/**
 * Config for dbxForgeFieldFunction().
 */
export interface DbxForgeFieldFunctionConfig<C extends DbxForgeFieldFunctionDef<any>> {
  /**
   * The type of the field.
   *
   * Should match the registered type.
   */
  readonly type: ExtractDbxForgeFieldDef<C>['type'];
  /**
   * Builds the config for the field. If null is provided, the config from the input config is used directly.
   *
   * @param input - The input config.
   * @returns The config for the field.
   */
  readonly buildFieldDef?: DbxForgeFieldFunctionFieldDefBuilder<C>;
  /**
   * Builds the props for the field. If null is provided, the props from the input config are used directly.
   *
   * @param input - The input config.
   * @returns The props for the field.
   */
  readonly buildProps?: Maybe<DbxForgeFieldFunctionConfigPropsBuilder<C>>;
}

/**
 * Creates a {@link DbxForgeFieldFunction} from a {@link DbxForgeFieldFunctionConfig}.
 *
 * The returned function accepts a field definition config and an optional configure callback,
 * and produces a fully-typed {@link DbxForgeField} with the correct `type` set.
 *
 * @param config - factory configuration containing the field type and optional builders for props and the field definition
 * @returns a reusable field factory function
 *
 * @example
 * ```ts
 * const myTextField = dbxForgeFieldFunction<MyTextFieldDef>({
 *   type: 'my-text',
 *   buildProps: (input) => ({ placeholder: input.placeholder ?? 'Enter text' }),
 *   buildFieldDef: dbxForgeBuildFieldDef((instance) => {
 *     instance.injectDefaultValidation();
 *   })
 * });
 * ```
 */
export function dbxForgeFieldFunction<C extends DbxForgeFieldFunctionDef<F>, F extends FieldDef<any> = ExtractDbxForgeFieldDef<C>>(config: DbxForgeFieldFunctionConfig<C>): DbxForgeFieldFunction<C, F> {
  const { type, buildFieldDef, buildProps } = config;

  const makeFieldDef: DbxForgeFieldFunctionFieldDefBuilder<C> = buildFieldDef ?? NOOP_MODIFIER;
  const makeProps: DbxForgeFieldFunctionConfigPropsBuilder<C> = buildProps
    ? (input: C) => {
        const props: Partial<F['props']> = {
          ...input.props,
          ...filterUndefinedValues(buildProps(input))
        };

        return props;
      }
    : (input: C) => {
        // Return props as-is if it exists, or set an empty object
        return 'props' in input ? input.props : {};
      };

  return ((input: C, configure?: DbxForgeBuildFieldDefFunction<C>) => {
    const props = makeProps(input);

    // always copy the input before passing to makeFieldDef
    const _config = {
      ...input,
      props
    } as Building<C>;

    const config = makeFieldDef(_config, props, configure) ?? _config;

    // always set type before returning
    (config as Building<F>).type = type;

    return config;
  }) as unknown as DbxForgeFieldFunction<C>;
}

// MARK: Utilities
/**
 * Input for adding validation to a field via the builder instance.
 *
 * Accepts validators and optional validation messages that are merged into the field's existing validation.
 */
export type DbxForgeFieldFunctionFieldDefBuilderFunctionInstanceAddValidationInput = {
  readonly validators?: Maybe<ArrayOrValue<DbxForgeFieldValidatorInput>>;
  /**
   * Form-level default validation messages merged into `_formConfig.defaultValidationMessages`.
   *
   * Use for messages associated with inline `fn` validators whose error kinds need
   * form-wide resolution. Separate from field-level `validationMessages`.
   */
  readonly formValidationMessages?: Maybe<Record<string, string>>;
} & MaybeMap<Pick<DbxForgeFieldValidation, 'validationMessages'>>;

/**
 * Builder instance provided to {@link DbxForgeBuildFieldDefFunction} callbacks.
 *
 * Exposes methods for reading and mutating a field definition during construction,
 * including validation, meta, logic, and form config.
 */
export interface DbxForgeFieldFunctionFieldDefBuilderFunctionInstance<C extends DbxForgeFieldFunctionDef<any>, FV = any> extends DbxForgeFieldFunctionFieldDefBuilderFunctionInstanceLogicBuilder<C, FV>, DbxForgeFieldFunctionFieldDefBuilderFunctionInstanceFormConfigBuilder, DbxForgeFieldFunctionFieldDefBuilderFunctionInstanceWrappersBuilder {
  /**
   * Returns the current fieldDef.
   */
  getFieldDef: () => C;
  /**
   * Returns the current props.
   */
  getProps: () => Building<C['props']>;
  /**
   * Returns the default validation from the default validation source.
   *
   * Does not modify the current config.
   */
  getDefaultValidation(): DbxForgeFieldValidation;
  /**
   * Injects the default validators into the field definition.
   */
  injectDefaultValidation(): void;
  /**
   * Loads all the current validators from the field definition.
   */
  getValidation(): DbxForgeFieldValidation;
  /**
   * Adds/Merges the input validation into the existing field definition.
   */
  addValidation(input: DbxForgeFieldFunctionFieldDefBuilderFunctionInstanceAddValidationInput): void;
  /**
   * Sets the validation for the field definition.
   */
  setValidation(input: DbxForgeFieldValidation): void;
  /**
   * Returns the current meta.
   */
  getMeta(): FieldMeta;
  /**
   * Inserts the input meta into the existing field definition.
   *
   * Null values clear existing values.
   */
  addMeta(meta?: Maybe<FieldMeta>): void;
  /**
   * Sets the meta for the field definition.
   */
  setMeta(meta: FieldMeta): void;
  /**
   * Calls another DbxForgeBuildFieldDefFunction with this instance.
   */
  configure(fn: DbxForgeBuildFieldDefFunction<C, FV>): void;
}

interface _DbxForgeFieldLogicExtras {
  readonly dependsOn?: string[];
  readonly externalData?: DbxForgeFieldLogicExternalData;
}

/**
 * Distributive conditional type that augments logic config types with an optional `fn` callback
 * for function-based derivations. Preserves ng-forge's discriminated union structure.
 *
 * - Sync function derivations (`functionName: string`): adds `fn`, makes `functionName` optional when `fn` is provided
 * - Async function derivations (`asyncFunctionName: string`): adds `fn`, makes `asyncFunctionName` optional when `fn` is provided
 * - All other logic types (state, expression, value, http): passed through unchanged
 */
type DbxForgeFieldLogicWithFn<T> =
  // Branch 1: sync function derivation (has required functionName)
  T extends { type: 'derivation'; functionName: string }
    ? // Allow the original type with an optional fn alongside the required functionName
        | (Omit<T, 'dependsOn'> & { fn?: DbxForgeFieldLogicFn } & _DbxForgeFieldLogicExtras)
        // Or: when fn is provided, make functionName optional (builder auto-generates a name)
        | (Omit<T, 'functionName' | 'dependsOn'> & { functionName?: string; fn: DbxForgeFieldLogicFn } & _DbxForgeFieldLogicExtras)
    : // Branch 2: async function derivation (has source: 'asyncFunction' + required asyncFunctionName)
      T extends { type: 'derivation'; source: 'asyncFunction'; asyncFunctionName: string }
      ? // Allow the original type with an optional async fn alongside the required asyncFunctionName
          | (T & { fn?: DbxForgeFieldLogicAsyncFn } & _DbxForgeFieldLogicExtras)
          // Or: when fn is provided, make asyncFunctionName optional (builder auto-generates a name)
          | (Omit<T, 'asyncFunctionName' | 'dependsOn'> & { asyncFunctionName?: string; fn: DbxForgeFieldLogicAsyncFn } & _DbxForgeFieldLogicExtras)
      : // Branch 3: all other logic types (state, expression, value, http) — pass through unchanged
        T;

/**
 * A custom logic type for transforming values.
 *
 * Is transformed into a derivation by the builder instance.
 */
export type DbxForgeFieldTransformLogic<FV = unknown> = DbxForgeFieldIdempotentTransformLogic<FV> | DbxForgeFieldAsyncTransformLogic<FV> | DbxForgeFieldDebouncedTransformLogic<FV>;

/**
 * The three types of transforms allowed.
 *
 * - Idempotent: The transform is synchronous. It should return the equivalent output for the equivalent input.
 * - Async: The transform is asynchronous and returns a Promise. Does not have to be idempotent.
 * - Debounced: A synchronous function that has a debounce to it. Does not have to be idempotent.
 */
export type DbxForgeFieldTransformType = 'idempotent' | 'async' | 'debounced';

/**
 * Controls when a transform derivation runs.
 *
 * - `'defined'` — only runs when the field value is non-null/defined (default)
 * - `'always'` — runs on every evaluation, including when the value is undefined
 */
export type DbxForgeFieldTransformWhen = 'defined' | 'always';

/**
 * Synchronous transform function that receives the current field value and evaluation context.
 */
export type DbxForgeFieldTransformFunction<I, O> = (value: I, ctx: EvaluationContext<I>) => O;

/**
 * Asynchronous variant of {@link DbxForgeFieldTransformFunction} that returns a Promise.
 */
export type DbxForgeFieldAsyncTransformFunction<I, O> = DbxForgeFieldTransformFunction<I, Promise<O>>;

export type DbxForgeFieldIdempotentTransformLogic<FV = unknown> = DbxForgeFieldIdempotentTransformLogicWhenDefined<FV> | DbxForgeFieldIdempotentTransformLogicWhenAlways<FV>;

export interface DbxForgeFieldIdempotentTransformLogicWhenDefined<FV = unknown> {
  readonly type: 'transform';
  readonly transformType: 'idempotent';
  readonly when?: 'defined';
  readonly transform: DbxForgeFieldTransformFunction<FV, FV>;
}

export interface DbxForgeFieldIdempotentTransformLogicWhenAlways<FV = unknown> {
  readonly type: 'transform';
  readonly transformType: 'idempotent';
  readonly when: 'always';
  readonly transform: DbxForgeFieldTransformFunction<Maybe<FV>, FV>;
}

export type DbxForgeFieldAsyncTransformLogic<FV = unknown> = DbxForgeFieldAsyncTransformLogicWhenDefined<FV> | DbxForgeFieldAsyncTransformLogicWhenAlways<FV>;

export interface DbxForgeFieldAsyncTransformLogicWhenDefined<FV = unknown> {
  readonly type: 'transform';
  readonly transformType: 'async';
  readonly when?: 'defined';
  readonly transform: DbxForgeFieldAsyncTransformFunction<FV, FV>;
  readonly debounceMs?: Milliseconds;
}

export interface DbxForgeFieldAsyncTransformLogicWhenAlways<FV = unknown> {
  readonly type: 'transform';
  readonly transformType: 'async';
  readonly when: 'always';
  readonly transform: DbxForgeFieldAsyncTransformFunction<Maybe<FV>, FV>;
  readonly debounceMs?: Milliseconds;
}

export type DbxForgeFieldDebouncedTransformLogic<FV = unknown> = DbxForgeFieldDebouncedTransformLogicWhenDefined<FV> | DbxForgeFieldDebouncedTransformLogicWhenAlways<FV>;

export interface DbxForgeFieldDebouncedTransformLogicWhenDefined<FV = unknown> {
  readonly type: 'transform';
  readonly transformType: 'debounced';
  readonly when?: 'defined';
  readonly transform: DbxForgeFieldTransformFunction<FV, FV>;
  readonly debounceMs?: Milliseconds;
}

export interface DbxForgeFieldDebouncedTransformLogicWhenAlways<FV = unknown> {
  readonly type: 'transform';
  readonly transformType: 'debounced';
  readonly when: 'always';
  readonly transform: DbxForgeFieldTransformFunction<Maybe<FV>, FV>;
  readonly debounceMs?: Milliseconds;
}

/**
 * Default debounce time applied to debounced transform derivations.
 */
export const DEFAULT_TRANSFORM_DEBOUNCE_TIME: Milliseconds = 500;

// MARK: Validator With Fn
/**
 * A custom validator config with an inline `fn` for auto-registration.
 *
 * When `reusableDefinition` is true, `functionName` is required -- the function is registered
 * once and shared across fields that reference it by name with field-specific `params`.
 *
 * When `reusableDefinition` is false/undefined, `functionName` is optional (auto-generated).
 */
export type DbxForgeFieldCustomValidatorWithFn = { readonly type: 'custom'; readonly fn: CustomValidator; readonly functionName: string; readonly reusableDefinition: true; readonly params?: Record<string, unknown>; readonly kind?: string } | { readonly type: 'custom'; readonly fn: CustomValidator; readonly functionName?: string; readonly reusableDefinition?: false; readonly params?: Record<string, unknown>; readonly kind?: string };

/**
 * An async validator config with an inline `fn` for auto-registration.
 *
 * When `reusableDefinition` is true, `functionName` is required -- the function is registered
 * once and shared across fields that reference it by name with field-specific `params`.
 *
 * When `reusableDefinition` is false/undefined, `functionName` is optional (auto-generated).
 */
export type DbxForgeFieldAsyncValidatorWithFn = { readonly type: 'async'; readonly fn: AsyncCustomValidator; readonly functionName: string; readonly reusableDefinition: true; readonly params?: Record<string, unknown> } | { readonly type: 'async'; readonly fn: AsyncCustomValidator; readonly functionName?: string; readonly reusableDefinition?: false; readonly params?: Record<string, unknown> };

/**
 * A validator input that can be a standard {@link ValidatorConfig} or one augmented with an inline `fn`.
 *
 * Supports both one-off inline validators (functionName auto-generated) and reusable definitions
 * (functionName required, registered once, referenced by name with field-specific params).
 */
export type DbxForgeFieldValidatorInput = ValidatorConfig | DbxForgeFieldCustomValidatorWithFn | DbxForgeFieldAsyncValidatorWithFn;

/**
 * This type allows the builder instance to automatically register a function with the dbx-forge form.
 *
 * Uses distributive conditional types to preserve ng-forge's discriminated union while adding
 * `fn` support only to function-based derivation variants.
 */
export type DbxForgeFieldFunctionFieldDefBuilderFunctionInstanceLogicBuilderLogic<C extends DbxForgeFieldFunctionDef<any>, FV = any> = DbxForgeFieldLogicWithFn<DbxForgeFieldFunctionDefLogicValue<C>> | DbxForgeFieldTransformLogic<FV>;

/**
 * Builder methods for reading and mutating the logic configuration on a field definition.
 *
 * Logic entries control conditional field state (hidden, readonly, disabled, required)
 * and value derivation (sync/async functions, transforms).
 */
export interface DbxForgeFieldFunctionFieldDefBuilderFunctionInstanceLogicBuilder<C extends DbxForgeFieldFunctionDef<any>, FV = any> {
  /**
   * Returns the current logic configuration, if it exists.
   */
  getLogic(): Maybe<DbxForgeFieldFunctionFieldDefBuilderFunctionInstanceLogicBuilderLogic<C, FV>[]>;
  /**
   * Adds one or more arbitrary logic value(s) to the field definition.
   */
  addLogic(logic: ArrayOrValue<DbxForgeFieldFunctionFieldDefBuilderFunctionInstanceLogicBuilderLogic<C, FV>>): void;
  /**
   * Replaces the logic for the field definition.
   */
  setLogic(logic: ArrayOrValue<DbxForgeFieldFunctionFieldDefBuilderFunctionInstanceLogicBuilderLogic<C, FV>>): void;
}

/**
 * Builder methods for reading and mutating the wrappers configuration on a field definition.
 */
export interface DbxForgeFieldFunctionFieldDefBuilderFunctionInstanceWrappersBuilder {
  /**
   * Returns the current wrappers configuration, if it exists.
   */
  getWrappers(): Maybe<WrapperConfig[]>;
  /**
   * Merges the field wrappers into the field definition.
   */
  addWrappers(wrappers: ArrayOrValue<WrapperConfig>): void;
  /**
   * Replaces the field form config for the field definition.
   */
  setWrappers(wrappers: ArrayOrValue<WrapperConfig>): void;
}

/**
 * Builder methods for reading and mutating the form-level config attached to a field definition.
 *
 * Form config includes schemas, external data, and custom function registrations
 * that are merged into the parent {@link DbxForgeFieldFormConfig} at form construction time.
 */
export interface DbxForgeFieldFunctionFieldDefBuilderFunctionInstanceFormConfigBuilder {
  /**
   * Returns the current logic configuration, if it exists.
   */
  getFormConfig(): Maybe<DbxForgeFieldFormConfig>;
  /**
   * Merges the field form config into the field definition.
   */
  addFormConfig(formConfig: Maybe<DbxForgeFieldFormConfig>): void;
  /**
   * Replaces the field form config for the field definition.
   */
  setFormConfig(formConfig: Maybe<DbxForgeFieldFormConfig>): void;
}

/**
 * Callback invoked by the builder to configure a field definition.
 *
 * Receives the builder {@link DbxForgeFieldFunctionFieldDefBuilderFunctionInstance} and the in-progress field config.
 */
export type DbxForgeBuildFieldDefFunction<C extends DbxForgeFieldFunctionDef<any>, FV = unknown> = (instance: DbxForgeFieldFunctionFieldDefBuilderFunctionInstance<C, FV>, config: Building<C>) => void;

/**
 * Configuration for {@link dbxForgeBuildFieldDef}.
 */
export interface DbxForgeBuildFieldDefConfig<C extends DbxForgeFieldFunctionDef<any>> {
  // TODO: ...
}

/**
 * Creates a {@link DbxForgeFieldFunctionFieldDefBuilder} that provides a builder-instance pattern
 * for configuring field definitions.
 *
 * The returned builder runs the `configureFunction` first, then any per-call `inputConfigure` callback,
 * and finally finalizes logic entries (registering custom functions, expanding transforms).
 *
 * @param configureFunction - primary configure callback applied to every field built by this builder
 * @param _config - reserved for future builder-level options
 * @returns a reusable field definition builder
 *
 * @example
 * ```ts
 * const buildMyField = dbxForgeBuildFieldDef<MyFieldDef>((instance) => {
 *   instance.injectDefaultValidation();
 *   instance.addLogic({ type: 'transform', transformType: 'idempotent', transform: trimString });
 * });
 * ```
 */
export function dbxForgeBuildFieldDef<C extends DbxForgeFieldFunctionDef<any>, FV = any>(configureFunction: DbxForgeBuildFieldDefFunction<C, FV>, _config?: Maybe<DbxForgeBuildFieldDefConfig<C>>): DbxForgeFieldFunctionFieldDefBuilder<C, FV> {
  // TODO: Default ValidationMessages place, etc.

  return ((fieldDef: C, props: C['props'], inputConfigure?: Maybe<DbxForgeBuildFieldDefFunction<C, FV>>) => {
    function getFieldDef(): C {
      return fieldDef;
    }

    function getProps(): Building<C['props']> {
      return props;
    }

    function getDefaultValidation(): DbxForgeFieldValidation {
      return {};
    }

    function injectDefaultValidation(): void {
      const defaultValidation = getDefaultValidation();
      addValidation(defaultValidation);
    }

    function getValidation(): DbxForgeFieldValidation {
      return {
        validators: fieldDef['validators'],
        validationMessages: fieldDef['validationMessages']
      };
    }

    const _accumulatedFormValidationMessages: Record<string, string> = {};
    let _inlineValidatorCount = 0;

    /**
     * Generates a deduplication key for a validator config.
     *
     * Built-in validators deduplicate by type. Custom/async/http validators use a
     * composite key to allow multiple validators of the same type with different function names.
     *
     * @param v - the validator input to generate a deduplication key for
     * @returns a string key unique to the validator's type and identity
     */
    function _validatorDeduplicationKey(v: DbxForgeFieldValidatorInput): string {
      let result: string;

      switch (v.type) {
        case 'custom':
          if ('expression' in v && v.expression) {
            result = `custom:expr:${v.kind ?? v.expression}`;
          } else {
            _inlineValidatorCount += 1;
            const customFnName = (v as any).functionName ?? `__inline_${_inlineValidatorCount}__`;
            result = `custom:fn:${customFnName}`;
          }
          break;
        case 'async': {
          _inlineValidatorCount += 1;
          const asyncFnName = (v as any).functionName ?? `__inline_${_inlineValidatorCount}__`;
          result = `async:${asyncFnName}`;
          break;
        }
        case 'http':
          if ('functionName' in v) {
            result = `http:fn:${v.functionName}`;
          } else {
            result = `http:decl`;
          }
          break;
        default:
          result = v.type;
          break;
      }

      return result;
    }

    function addValidation(input: DbxForgeFieldFunctionFieldDefBuilderFunctionInstanceAddValidationInput): void {
      const currentValidation = getValidation();

      let nextValidators: Maybe<DbxForgeFieldValidatorInput[]> = currentValidation.validators;
      let nextValidationMessages: Maybe<ValidationMessages> = currentValidation.validationMessages;

      const inputValidators = asArray(input.validators);

      if (inputValidators.length) {
        nextValidators = filterUniqueValues(mergeArrays([currentValidation.validators as Maybe<DbxForgeFieldValidatorInput[]>, inputValidators]), _validatorDeduplicationKey);
      }

      if (input.validationMessages) {
        nextValidationMessages = {
          ...currentValidation.validationMessages,
          ...filterUndefinedValues(input.validationMessages)
        };
      }

      if (input.formValidationMessages) {
        Object.assign(_accumulatedFormValidationMessages, input.formValidationMessages);
      }

      setValidation({
        validators: nextValidators as ValidatorConfig[] | undefined,
        validationMessages: nextValidationMessages
      });
    }

    function setValidation(input: DbxForgeFieldValidation): void {
      (fieldDef as Building<FieldWithValidation>)['validators'] = input.validators;
      (fieldDef as Building<FieldWithValidation>)['validationMessages'] = input.validationMessages;
    }

    function configure(fn: DbxForgeBuildFieldDefFunction<C, FV>): void {
      fn(instance, fieldDef);
    }

    function getMeta(): FieldMeta {
      return fieldDef['meta'];
    }

    function insertMeta(meta?: Maybe<FieldMeta>): void {
      if (meta) {
        const currentMeta = getMeta();

        const nextMeta = filterNullAndUndefinedValues({
          ...currentMeta,
          ...filterUndefinedValues(meta)
        });

        setMeta(nextMeta);
      }
    }

    function setMeta(meta: FieldMeta): void {
      (fieldDef as Building<FieldDef<any>>)['meta'] = meta;
    }

    // Logic
    function getLogic(): Maybe<DbxForgeFieldFunctionFieldDefBuilderFunctionInstanceLogicBuilderLogic<C>[]> {
      return fieldDef['logic'];
    }

    function addLogic(logic: ArrayOrValue<DbxForgeFieldFunctionFieldDefBuilderFunctionInstanceLogicBuilderLogic<C>>) {
      const currentLogic = getLogic() ?? [];
      const nextLogic = mergeArrays([currentLogic, asArray(logic)]);
      setLogic(nextLogic);
    }

    function setLogic(logic: ArrayOrValue<DbxForgeFieldFunctionFieldDefBuilderFunctionInstanceLogicBuilderLogic<C>>) {
      const nextLogic = asArray(logic);
      (fieldDef as any)['logic'] = nextLogic; // set the next logic value
    }

    // Wrappers
    function getWrappers(): Maybe<WrapperConfig[]> {
      return fieldDef['wrappers'];
    }

    function addWrappers(input: ArrayOrValue<WrapperConfig>) {
      const currentWrappers = getWrappers() ?? [];
      const nextWrappers = mergeArrays([currentWrappers, asArray(input)]);
      setWrappers(nextWrappers);
    }

    function setWrappers(wrappers: ArrayOrValue<WrapperConfig>) {
      const nextWrappers = asArray(wrappers);
      (fieldDef as any)['wrappers'] = nextWrappers; // set the next wrappers value
    }

    // FormConfig
    function getFormConfig(): Maybe<DbxForgeFieldFormConfig> {
      return fieldDef['_formConfig'];
    }

    function addFormConfig(formConfig: Maybe<DbxForgeFieldFormConfig>): void {
      const currentFormConfig = getFormConfig() ?? {};
      const nextFormConfig = mergeDbxForgeFieldFormConfig(currentFormConfig, formConfig ?? {});
      setFormConfig(nextFormConfig);
    }

    function setFormConfig(formConfig: Maybe<DbxForgeFieldFormConfig>): void {
      (fieldDef as Building<DbxForgeField<any>>)['_formConfig'] = formConfig;
    }

    const instance: DbxForgeFieldFunctionFieldDefBuilderFunctionInstance<C, FV> = {
      getFieldDef,
      getProps,
      getValidation,
      getDefaultValidation,
      injectDefaultValidation,
      addValidation,
      setValidation,
      getMeta,
      addMeta: insertMeta,
      setMeta,
      getLogic,
      addLogic,
      setLogic,
      getFormConfig,
      addFormConfig,
      setFormConfig,
      getWrappers,
      addWrappers,
      setWrappers,
      configure
    };

    configure(configureFunction);

    // perform the final configure
    if (inputConfigure) {
      configure(inputConfigure);
    }

    // finalize the logic and validation expansion/cleanup
    _finalizeLogicAndValidation(instance, _accumulatedFormValidationMessages);

    return fieldDef;
  }) as DbxForgeFieldFunctionFieldDefBuilder<C, FV>;
}

/**
 * Finalizes logic and validation for a field definition.
 *
 * For logic: registers inline `fn` derivations into `customFnConfig`, converts transforms to derivation entries.
 * For validation: registers inline `fn` validators into `customFnConfig.validators`/`asyncValidators`,
 * and merges accumulated form validation messages into `_formConfig.defaultValidationMessages`.
 *
 * @param instance - The field definition builder instance.
 * @param accumulatedFormValidationMessages - Form-level validation messages accumulated by `addValidation()`.
 */
function _finalizeLogicAndValidation<C extends DbxForgeFieldFunctionDef<any>, FV = any>(instance: DbxForgeFieldFunctionFieldDefBuilderFunctionInstance<C, FV>, accumulatedFormValidationMessages?: Record<string, string>): void {
  const fieldDef = instance.getFieldDef();

  // --- Logic finalization ---
  _finalizeLogic(instance, fieldDef);

  // --- Validation finalization ---
  _finalizeValidation(instance, fieldDef);

  // Merge accumulated form validation messages
  if (accumulatedFormValidationMessages && !objectHasNoKeys(accumulatedFormValidationMessages)) {
    instance.addFormConfig({
      defaultValidationMessages: accumulatedFormValidationMessages
    });
  }
}

/**
 * Finalizes the logic expansion/cleanup for a field definition.
 *
 * Registers inline `fn` derivation functions and converts transform entries to derivation logic.
 *
 * @param instance - the builder instance whose logic entries will be finalized
 * @param fieldDef - the field definition being constructed
 */
function _finalizeLogic<C extends DbxForgeFieldFunctionDef<any>, FV = any>(instance: DbxForgeFieldFunctionFieldDefBuilderFunctionInstance<C, FV>, fieldDef: C): void {
  const logic = instance.getLogic();

  // if no logic is defined, just skip finalization
  if (logic?.length) {
    _finalizeLogicEntries(instance, fieldDef, logic);
  }
}

function _finalizeLogicEntries<C extends DbxForgeFieldFunctionDef<any>, FV = any>(instance: DbxForgeFieldFunctionFieldDefBuilderFunctionInstance<C, FV>, fieldDef: C, logic: DbxForgeFieldFunctionFieldDefBuilderFunctionInstanceLogicBuilderLogic<C, FV>[]): void {
  let hasOneOrMoreCustomFunctions = false;

  /**
   * Used for storing custom functions that are defined within the field config.
   */
  const customFnConfig = {
    derivations: {} as MaybeSo<Required<CustomFnConfig['derivations']>>,
    asyncDerivations: {} as MaybeSo<Required<CustomFnConfig['asyncDerivations']>>
  };

  /**
   * Used for storing external data that is defined within the field config.
   */
  const externalData: MaybeSo<Required<DbxForgeFieldLogicExternalData>> = {};

  interface RegisterCustomFunctionInput {
    isAsync: boolean;
    functionName?: string;
    fn: any;
  }

  let customFunctionNameCount = 0;

  /**
   * Generates a default function name for the given entry, and sets it on the entry.
   *
   * @returns a unique auto-generated function name based on the field key
   */
  function _generateDefaultFunctionName() {
    customFunctionNameCount += 1;
    return `__fn__${fieldDef.key}_${customFunctionNameCount}`;
  }

  /**
   * Registers a custom function with the customFnConfig.
   *
   * @param input - the function to register, including its async flag and optional name
   * @param generateFunctionName - optional name generator; defaults to {@link _generateDefaultFunctionName}
   * @returns the resolved function name under which the function was registered
   */
  function _registerCustomFunction(input: RegisterCustomFunctionInput, generateFunctionName: () => string = _generateDefaultFunctionName): string {
    const { isAsync, functionName, fn } = input;
    const finalFunctionName = functionName ?? generateFunctionName();

    if (isAsync) {
      customFnConfig.asyncDerivations[finalFunctionName] = fn;
    } else {
      customFnConfig.derivations[finalFunctionName] = fn;
    }

    // flag added
    hasOneOrMoreCustomFunctions = true;

    return finalFunctionName;
  }

  function finalizeDerivationEntry(derivationEntry: LogicConfig & { type: 'derivation' }) {
    if ('fn' in (derivationEntry as DbxForgeFieldLogicWithFn<typeof derivationEntry>)) {
      const { fn, functionName, source, asyncFunctionName } = derivationEntry as unknown as (DbxForgeFieldLogicFnFunctionRef | DbxForgeFieldLogicAsyncFnFunctionRef) & typeof derivationEntry;

      /**
       * Generates a default function name for the given entry, and sets it on the entry.
       *
       * @returns a unique auto-generated function name assigned to the derivation entry
       */
      function generateDefaultFunctionNameForEntry() {
        const functionName = _generateDefaultFunctionName();

        // set the functionName on the entry so it is associated now
        (derivationEntry as any).functionName = functionName;

        return functionName;
      }

      function registerCustomFunction(input: RegisterCustomFunctionInput) {
        _registerCustomFunction(input, generateDefaultFunctionNameForEntry);

        // remove fn from the entry
        delete (derivationEntry as any).fn;
      }

      switch (source) {
        case 'http':
          // do nothing.
          break;
        case 'asyncFunction':
          registerCustomFunction({ isAsync: true, functionName: asyncFunctionName, fn });
          break;
        default:
          // sync function
          registerCustomFunction({ isAsync: false, functionName, fn });
          break;
      }

      // clean up the entry by removing fn
      delete (derivationEntry as Building<DbxForgeFieldLogicFnFunctionRef>).fn;
    }

    // move any external data to the form config
    if ('externalData' in derivationEntry) {
      Object.assign(externalData, derivationEntry.externalData);
    }

    // set the default dependsOn if not set
    if (!derivationEntry.dependsOn) {
      derivationEntry.dependsOn = [SELF_DEPENDENCY_TOKEN];
    }
  }

  function finalizeTransformEntry(entry: DbxForgeFieldTransformLogic<FV>): LogicConfig {
    const { transform: inputTransformFn, when } = entry;

    /**
     * The derivation functions will try to map occasionally while the value is undefined.
     *
     * We wrap it unless our transform expects that by specifying "always".
     */
    let transformFn: DbxForgeFieldTransformFunction<Maybe<FV>, any>;

    if (when !== 'always') {
      transformFn = mapMaybeFunction(inputTransformFn as any);
    } else {
      transformFn = inputTransformFn as DbxForgeFieldTransformFunction<Maybe<FV>, any>;
    }

    /**
     * Build the final derivation function.
     *
     * @param ctx - the evaluation context containing the current field value
     * @returns the transformed field value
     */
    const fn: DbxForgeFieldLogicFn = (ctx) => {
      return transformFn(ctx.fieldValue, ctx);
    };

    let result: LogicConfig;

    switch (entry.transformType) {
      case 'idempotent':
        result = {
          type: 'derivation',
          trigger: 'onChange',
          functionName: _registerCustomFunction({ isAsync: false, fn }),
          dependsOn: [SELF_DEPENDENCY_TOKEN]
        };
        break;
      case 'async':
        result = {
          type: 'derivation',
          functionName: _registerCustomFunction({ isAsync: true, fn }),
          dependsOn: [SELF_DEPENDENCY_TOKEN]
        };
        break;
      case 'debounced':
        result = {
          type: 'derivation',
          trigger: 'debounced',
          functionName: _registerCustomFunction({ isAsync: false, fn }),
          dependsOn: [SELF_DEPENDENCY_TOKEN],
          debounceMs: entry.debounceMs
        };
        break;
      default:
        throw new Error(`Unexpected transform type.`);
    }

    return result;
  }

  // finalize each entry
  const finalLogic: LogicConfig[] = logic.map((entry) => {
    const derivationEntry = entry as LogicConfig | DbxForgeFieldTransformLogic<FV>;
    let finalEntry: LogicConfig = entry as LogicConfig;

    switch (derivationEntry.type) {
      case 'hidden':
      case 'readonly':
      case 'disabled':
      case 'required':
        // nothing to do
        break;
      case 'derivation':
        finalizeDerivationEntry(derivationEntry);
        break;
      case 'transform':
        finalEntry = finalizeTransformEntry(derivationEntry);
        break;
      default:
        break;
    }

    return finalEntry;
  });

  instance.setLogic(finalLogic as any);

  // finally add/merge the form config from the fields that was accumulated
  if (hasOneOrMoreCustomFunctions || !objectHasNoKeys(externalData)) {
    instance.addFormConfig({
      customFnConfig,
      externalData
    });
  }
}

/**
 * Finalizes validation for a field definition.
 *
 * Scans validators for inline `fn` properties, auto-registers them in
 * `customFnConfig.validators`/`asyncValidators`, and replaces `fn` with the generated `functionName`.
 *
 * @param instance - the builder instance whose validators will be finalized
 * @param fieldDef - the field definition being constructed
 */
function _finalizeValidation<C extends DbxForgeFieldFunctionDef<any>>(instance: DbxForgeFieldFunctionFieldDefBuilderFunctionInstance<C>, fieldDef: C): void {
  const validation = instance.getValidation();
  const validators = validation.validators;

  if (validators?.length) {
    _finalizeValidators(instance, fieldDef, validation);
  }
}

function _finalizeValidators<C extends DbxForgeFieldFunctionDef<any>>(instance: DbxForgeFieldFunctionFieldDefBuilderFunctionInstance<C>, fieldDef: C, validation: DbxForgeFieldValidation): void {
  const validators = validation.validators;

  if (validators) {
    let hasOneOrMoreValidatorFunctions = false;

    const validatorCustomFnConfig: {
      validators: Record<string, CustomValidator>;
      asyncValidators: Record<string, AsyncCustomValidator>;
    } = { validators: {}, asyncValidators: {} };

    let validatorFnNameCount = 0;

    function _generateValidatorFunctionName() {
      validatorFnNameCount += 1;
      return `__vfn__${fieldDef.key}_${validatorFnNameCount}`;
    }

    const finalizedValidators: ValidatorConfig[] = validators.map((entry) => {
      let result: ValidatorConfig;

      if (!('fn' in entry)) {
        result = entry as ValidatorConfig;
      } else {
        const { fn, reusableDefinition: _reusableDefinition, ...rest } = entry as any;
        const functionName: string = rest.functionName ?? _generateValidatorFunctionName();
        hasOneOrMoreValidatorFunctions = true;

        switch (entry.type) {
          case 'custom':
            validatorCustomFnConfig.validators[functionName] = fn;
            break;
          case 'async':
            validatorCustomFnConfig.asyncValidators[functionName] = fn;
            break;
          default:
            break;
        }

        // Return a clean ValidatorConfig without fn or reusableDefinition
        result = { ...rest, functionName } as ValidatorConfig;
      }

      return result;
    });

    instance.setValidation({
      validators: finalizedValidators,
      validationMessages: validation.validationMessages
    });

    if (hasOneOrMoreValidatorFunctions) {
      const validatorFormConfig: { validators?: Record<string, CustomValidator>; asyncValidators?: Record<string, AsyncCustomValidator> } = {};

      if (Object.keys(validatorCustomFnConfig.validators).length > 0) {
        validatorFormConfig.validators = validatorCustomFnConfig.validators;
      }

      if (Object.keys(validatorCustomFnConfig.asyncValidators).length > 0) {
        validatorFormConfig.asyncValidators = validatorCustomFnConfig.asyncValidators;
      }

      instance.addFormConfig({
        customFnConfig: validatorFormConfig
      });
    }
  }
}

// MARK: Utils
/**
 * Creates a single {@link DbxForgeBuildFieldDefFunction} from all the input functions.
 *
 * @param fns The functions to apply.
 * @returns A function that applies all of the given functions.
 */
export function dbxForgeFieldFunctionConfigure<C extends DbxForgeFieldFunctionDef<any>, FV = unknown>(...fns: DbxForgeBuildFieldDefFunction<C, FV>[]): DbxForgeBuildFieldDefFunction<C, FV> {
  let fn: DbxForgeBuildFieldDefFunction<C, FV>;

  switch (fns.length) {
    case 0:
      fn = NOOP_MODIFIER;
      break;
    case 1:
      fn = fns[0];
      break;
    default:
      fn = (instance: DbxForgeFieldFunctionFieldDefBuilderFunctionInstance<C, FV>, config: Building<C>) => {
        fns.forEach((fn) => {
          fn(instance, config);
        });
      };
      break;
  }

  return fn;
}

/**
 * Creates a {@link DbxForgeFieldFunctionConfigPropsBuilder} that automatically copies `hint` (or the deprecated `description`)
 * from the top-level field config into `props.hint`.
 *
 * Historically hint/description lived at the base config level. In `@ng-forge/dynamic-forms` hints are
 * expected under `props`, so this builder bridges that gap.
 *
 * @param makeProps - optional delegate that produces additional props; its result is merged before the hint is applied
 * @returns a props builder that includes the hint value
 *
 * @example
 * ```ts
 * const myField = dbxForgeFieldFunction<MyFieldDef>({
 *   type: 'my-field',
 *   buildProps: dbxForgeFieldFunctionConfigPropsWithHintBuilder()
 * });
 * ```
 */
export function dbxForgeFieldFunctionConfigPropsWithHintBuilder<C extends DbxForgeFieldFunctionDef<any> & DbxForgeFieldHintOrDescriptionValueRef<any>>(makeProps?: DbxForgeFieldFunctionConfigPropsBuilder<C>): DbxForgeFieldFunctionConfigPropsBuilder<C> {
  return (input: C) => {
    const props: Partial<C['props']> = makeProps?.(input) ?? {};

    if ('hint' in input) {
      (props as DbxForgeFieldHintValueRef<any>).hint = input.hint;
    } else if ('description' in input) {
      (props as DbxForgeFieldHintValueRef<any>).hint = input.description;
    }

    return props;
  };
}
