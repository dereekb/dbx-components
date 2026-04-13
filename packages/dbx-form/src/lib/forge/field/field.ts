import { ArrayOrValue, Building, MAP_IDENTITY, Maybe, MaybeMap, NOOP_MODIFIER, asArray, filterNullAndUndefinedValues, filterUndefinedValues, filterUniqueValues, mapIdentityFunction, mergeArrays, pushItemOrArrayItemsIntoArray, unique } from '@dereekb/util';
import { FieldDef, FieldMeta, FieldWithValidation, ValidationMessages, ValidatorConfig } from '@ng-forge/dynamic-forms';
import { ForgeFieldValidation } from './field.type';

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

// MARK: Field Def
/**
 * This is an internal type.
 *
 * @see {@link DbxForgeFieldFunctionDef} instead.
 */
type _DbxForgeFieldFunctionDef<F extends FieldDef<any>> =
  F extends FieldDef<infer TProps, infer TMeta>
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

// MARK: DbxForgeFieldFunction
/**
 * Creates the target FieldDef value from the input config.
 */
export type DbxForgeFieldFunction<C extends DbxForgeFieldFunctionDef<any>> = C extends DbxForgeFieldFunctionDef<infer F> ? (input: C) => F : never;

/**
 * Builds the FieldDef from the input config and props.
 */
export type DbxForgeFieldFunctionFieldDefBuilder<C extends DbxForgeFieldFunctionDef<any>> = (input: Building<C>, props: C['props']) => C | void;

/**
 * Generates custom props from the input config.
 *
 * This result is merged with the existing props, if they exist.
 *
 * All undefined values are filtered out
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
 * Creates a new DbxForgeFieldFunction from the input config.
 *
 * @param config
 * @returns
 */
export function dbxForgeFieldFunction<C extends DbxForgeFieldFunctionDef<F>, F extends FieldDef<any> = ExtractDbxForgeFieldDef<C>>(config: DbxForgeFieldFunctionConfig<C>): DbxForgeFieldFunction<C> {
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

  return ((input: C) => {
    const props = makeProps(input);

    // always copy the input before passing to makeFieldDef
    const _config = {
      ...input,
      props
    };

    const config = makeFieldDef(_config, props) ?? _config;

    // always set type before returning
    (config as Building<F>).type = type;

    return config;
  }) as unknown as DbxForgeFieldFunction<C>;
}

// MARK: Utilities
export type DbxForgeFieldFunctionFieldDefBuilderFunctionInstanceAddValidationInput = { validators?: Maybe<ArrayOrValue<ValidatorConfig>> } & MaybeMap<Pick<ForgeFieldValidation, 'validationMessages'>>;

export interface DbxForgeFieldFunctionFieldDefBuilderFunctionInstance<C extends DbxForgeFieldFunctionDef<any>> {
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
  getDefaultValidation(): ForgeFieldValidation;
  /**
   * Injects the default validators into the field definition.
   */
  injectDefaultValidation(): void;
  /**
   * Loads all the current validators from the field definition.
   */
  getValidation(): ForgeFieldValidation;
  /**
   * Adds/Merges the input validation into the existing field definition.
   */
  addValidation(input: DbxForgeFieldFunctionFieldDefBuilderFunctionInstanceAddValidationInput): void;
  /**
   * Sets the validation for the field definition.
   */
  setValidation(input: ForgeFieldValidation): void;
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
  configure(fn: DbxForgeBuildFieldDefFunction<C>): void;
}

export type DbxForgeBuildFieldDefFunction<C extends DbxForgeFieldFunctionDef<any>> = (instance: DbxForgeFieldFunctionFieldDefBuilderFunctionInstance<C>, config: Building<C>) => void;

export interface DbxForgeBuildFieldDefConfig<C extends DbxForgeFieldFunctionDef<any>> {
  // TODO: ...
}

/**
 * The default DbxForgeFieldFunctionFieldDefBuilder implementation.
 */
export function dbxForgeBuildFieldDef<C extends DbxForgeFieldFunctionDef<any>>(configureFunction: DbxForgeBuildFieldDefFunction<C>, config?: Maybe<DbxForgeBuildFieldDefConfig<C>>): DbxForgeFieldFunctionFieldDefBuilder<C> {
  // TODO: Default ValidationMessages place, etc.

  return ((fieldDef: C, props: C['props']) => {
    function getFieldDef(): C {
      return fieldDef;
    }

    function getProps(): Building<C['props']> {
      return props;
    }

    function getDefaultValidation(): ForgeFieldValidation {
      return {};
    }

    function injectDefaultValidation(): void {
      const defaultValidation = getDefaultValidation();
      addValidation(defaultValidation);
    }

    function getValidation(): ForgeFieldValidation {
      return {
        validators: fieldDef['validators'],
        validationMessages: fieldDef['validationMessages']
      };
    }

    function addValidation(input: DbxForgeFieldFunctionFieldDefBuilderFunctionInstanceAddValidationInput): void {
      const currentValidation = getValidation();

      let nextValidators: Maybe<ValidatorConfig[]> = currentValidation.validators;
      let nextValidationMessages: Maybe<ValidationMessages> = currentValidation.validationMessages;

      const inputValidators = asArray(input.validators);

      if (inputValidators.length) {
        nextValidators = filterUniqueValues(mergeArrays([currentValidation.validators, inputValidators]), (x) => x.type);
      }

      if (input.validationMessages) {
        nextValidationMessages = {
          ...currentValidation.validationMessages,
          ...filterUndefinedValues(input.validationMessages)
        };
      }

      setValidation({
        validators: nextValidators,
        validationMessages: nextValidationMessages
      });
    }

    function setValidation(input: ForgeFieldValidation): void {
      (fieldDef as Building<FieldWithValidation>)['validators'] = input.validators;
      (fieldDef as Building<FieldWithValidation>)['validationMessages'] = input.validationMessages;
    }

    function configure(fn: DbxForgeBuildFieldDefFunction<C>): void {
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

    const instance: DbxForgeFieldFunctionFieldDefBuilderFunctionInstance<C> = {
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
      configure
    };

    configure(configureFunction);

    return fieldDef;
  }) as DbxForgeFieldFunctionFieldDefBuilder<C>;
}

/**
 * Helper function for configs that extend DbxForgeFieldHintOrDescriptionRef that automatically pulls the hint from the input config.
 *
 * Historically putting hint/description in the base config was the preferred way. In @ng-forge/dynamic-forms hint is typically put under "props"
 *
 * @param makeProps
 * @returns
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
