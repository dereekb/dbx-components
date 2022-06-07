/*eslint @typescript-eslint/no-explicit-any:"off"*/
// any is used with intent here, as there isn't enough typing information available when going from a parent of fields to the types of each child.

import { asGetter, Getter, GetterOrValue } from '../getter/getter';
import { findPOJOKeys } from '../object/object.filter.pojo';
import { filterKeyValueTuples, KeyValueTypleValueFilter } from '../object/object.filter.tuple';
import { isMaybeSo, Maybe, MaybeSo } from '../value/maybe';
import { ApplyMapFunctionWithOptions, MapFunction } from '../value/map';
import { MergeReplace, ReplaceType } from '../type';
import { mapObjectMap } from '../object';
import { XOR } from 'ts-essentials';
import { Building } from '../value/build';

// MARK: Model
/**
 * Type used to declare a sister-type to the generic object.
 */
export type MappedModelData<I extends object, R extends object> = MergeReplace<I, R>;
export type TypedMappedModelData<I extends object, O extends object, X = any> = ReplaceType<I, O, X>;

export type ModelMapFunction<I extends object, O extends object> = ApplyMapFunctionWithOptions<Maybe<I>, O, ModelConversionOptions<I>>;
export type ModelMapFromFunction<V extends object, D extends object> = ModelMapFunction<D, V>;
export type ModelMapToFunction<V extends object, D extends object> = ModelMapFunction<V, D>;

export interface ModelMapFunctions<V extends object, D extends object> {
  from: ModelMapFromFunction<V, D>;
  to: ModelMapToFunction<V, D>;
}

export function makeModelMapFunctions<V extends object, D extends object>(fields: ModelFieldConversions<V, D>): ModelMapFunctions<V, D> {
  const keys = filterKeyValueTuples(fields);
  const conversionsByKey: [keyof V, ModelFieldMapFunctions][] = keys.map(([key, field]) => [key, field]) as [keyof V, ModelFieldMapFunctions][];
  const fromConversions: [keyof D, ModelFieldMapFunction][] = conversionsByKey.map(([key, configs]) => [key as unknown as keyof D, configs.from]);
  const toConversions: [keyof V, ModelFieldMapFunction][] = conversionsByKey.map(([key, configs]) => [key, configs.to]);

  const from = makeModelConversionFieldValuesFunction<D, V>(fromConversions) as ModelMapFromFunction<V, D>;
  const to = makeModelConversionFieldValuesFunction<V, D>(toConversions) as ModelMapToFunction<V, D>;

  return {
    from,
    to
  };
}

export type ModelConversionFieldTuple<I extends object> = [keyof I, ModelFieldMapFunction<unknown, unknown>];
export type ModelConversionFieldValuesConfig<I extends object> = ModelConversionFieldTuple<I>[];

export interface ModelConversionOptions<I extends object> {
  /**
   * Fields to include.
   */
  fields?: (keyof I)[];
  /**
   * Whether or not to only convert fields that are defined. Fields with a null value are still converted.
   */
  definedOnly?: boolean;
}

export type ModelConversionFieldValuesFunction<I extends object, O extends object> = ApplyMapFunctionWithOptions<Maybe<I>, O, ModelConversionOptions<I>>;

export function makeModelConversionFieldValuesFunction<I extends object, O extends object>(fields: ModelConversionFieldValuesConfig<I>): ModelConversionFieldValuesFunction<I, O> {
  return (input: Maybe<I>, inputTarget?: Maybe<Partial<O>>, options?: Maybe<ModelConversionOptions<I>>) => {
    const target = (inputTarget ?? {}) as Building<TypedMappedModelData<I, O>>;

    if (input) {
      let targetFields: ModelConversionFieldValuesConfig<I> = fields;

      // if options are provided, filter down.
      if (options) {
        const fieldsToMap = new Set(
          findPOJOKeys(input, {
            keysFilter: options.fields,
            valueFilter: options.definedOnly === false ? KeyValueTypleValueFilter.NONE : KeyValueTypleValueFilter.UNDEFINED
          })
        );

        targetFields = fields.filter((x) => fieldsToMap.has(x[0]));
      }

      targetFields.forEach(([key, convert]) => (target[key] = convert(input[key]) as any));
    }

    return target as O;
  };
}

// MARK: Fields
/**
 * An object map containing a ModelFieldMapFunctions entry for each key (required and optional) from the generic object.
 */
export type ModelFieldConversions<V extends object, D extends object> = Required<{
  [K in keyof V]: ModelFieldMapFunctions<V[K], TypedMappedModelData<V, D>[K]>;
}>;

/**
 * An object map containing a ModelFieldMapFunctionsConfig for each key (required and optional) from the generic object.
 */
export type ModelFieldConversionsConfig<V extends object, D extends object> = Required<{
  [K in keyof V]: ModelFieldMapFunctionsConfig<V[K], TypedMappedModelData<V, D>[K]>;
}>;

export function modelFieldConversions<V extends object, D extends object>(config: ModelFieldConversionsConfig<V, D>): ModelFieldConversions<V, D> {
  return mapObjectMap(config, (x) => modelFieldMapFunctions(x) as any);
}

export type ModelFieldMapFunctions<I = unknown, O = unknown> = {
  readonly from: ModelFieldMapFromFunction<I, O>;
  readonly to: ModelFieldMapToFunction<I, O>;
};

export type ModelFieldMapFunctionsConfig<I = unknown, O = unknown> = {
  readonly from: ModelFieldMapFromConfig<I, O>;
  readonly to: ModelFieldMapToConfig<I, O>;
};

export type ModelFieldMapFunctionsWithDefaultsConfig<I = unknown, O = unknown> = {
  readonly from: ModelFieldMapFromWithDefaultConfig<I, O>;
  readonly to: ModelFieldMapToWithDefaultConfig<I, O>;
};

export function modelFieldMapFunctions<I = unknown, O = unknown>(config: ModelFieldMapFunctionsConfig<I, O>): ModelFieldMapFunctions<I, O> {
  return {
    from: modelFieldMapFunction(config.from),
    to: modelFieldMapFunction(config.to)
  };
}

// MARK: Field
/**
 * ModelFieldMapFunction configuration that can convert a MaybeValue to the target value.
 */
export type ModelFieldMapMaybeTooConfig<I, O> = {
  convertMaybe: ModelFieldMapConvertMaybeFunction<I, O>;
};

export type ModelFieldMapMaybeWithDefaultValueConfig<I, O> = {
  defaultInput: GetterOrValue<I>;
  convert: ModelFieldMapConvertFunction<I, O>;
};

export type ModelFieldMapMaybeWithDefaultDataConfig<I, O> = {
  convert: ModelFieldMapConvertFunction<I, O>;
  default: GetterOrValue<O>;
};

export type ModelFieldMapConvertMaybeFunction<I, O> = MapFunction<Maybe<I>, O>;
export type ModelFieldMapConvertFunction<I, O> = MapFunction<MaybeSo<I>, O>;

/**
 * ModelFieldMapFunction configuration that handles the MaybeNot case with undefined.
 */
export type ModelFieldMapMaybeWithDefaultConfig<I, O> = ModelFieldMapMaybeWithDefaultValueConfig<I, O> | ModelFieldMapMaybeWithDefaultDataConfig<I, O>;

/**
 * Configuration is either a ModelFieldMapMaybeTooConfig or a ModelFieldMapMaybeWithDefaultConfig
 */
export type ModelFieldMapConfig<I, O> = XOR<ModelFieldMapMaybeTooConfig<I, O>, ModelFieldMapMaybeWithDefaultConfig<I, O>>;

export type ModelFieldMapFromConfig<I = unknown, O = unknown> = ModelFieldMapConfig<O, I>;
export type ModelFieldMapToConfig<I = unknown, O = unknown> = ModelFieldMapConfig<I, O>;

export type ModelFieldMapFromWithDefaultConfig<I = unknown, O = unknown> = ModelFieldMapMaybeWithDefaultConfig<O, I>;
export type ModelFieldMapToWithDefaultConfig<I = unknown, O = unknown> = ModelFieldMapMaybeWithDefaultConfig<I, O>;

export type ModelFieldMapFunction<I = unknown, O = unknown> = MapFunction<Maybe<I>, O>;
export type ModelFieldMapFromFunction<I, O> = ModelFieldMapFunction<O, I>;
export type ModelFieldMapToFunction<I, O> = ModelFieldMapFunction<I, O>;

/**
 * Creates a ModelFieldMapFunction.
 *
 * @param config
 * @returns
 */
export function modelFieldMapFunction<I, O>(config: ModelFieldMapConfig<I, O>): ModelFieldMapFunction<I, O> {
  const convert = (config as ModelFieldMapMaybeWithDefaultConfig<I, O>).convert;
  const convertMaybe = (config as ModelFieldMapMaybeTooConfig<I, O>).convertMaybe;
  const defaultOutput = (config as ModelFieldMapMaybeWithDefaultDataConfig<I, O>).default;
  const defaultInput = (config as ModelFieldMapMaybeWithDefaultValueConfig<I, O>).defaultInput;

  const getDefaultOutput: Getter<O> = asGetter(defaultOutput);
  const getDefaultInput: Getter<I> = asGetter(defaultInput);

  return (input: Maybe<I>) => {
    if (isMaybeSo(input)) {
      return convert(input);
    } else {
      if (convertMaybe) {
        return convertMaybe(input ?? getDefaultInput());
      } else {
        return getDefaultOutput();
      }
    }
  };
}
