import { asGetter, Getter, GetterOrValue } from "../getter/getter";
import { filterKeyValueTuples, findPOJOKeys, KeyValueTypleValueFilter } from "../object/object";
import { Maybe } from "../value/maybe";
import { ApplyMapFunctionWithOptions, MapFunction } from "../value/map";
import { KeyValueTransformMap } from '../type';

// MARK: Model
export type ModelDataType<I extends object> = KeyValueTransformMap<I, unknown>;

export type ModelMapFunction<I extends object, O extends object> = ApplyMapFunctionWithOptions<Maybe<I>, O, ModelConversionOptions<I, O>>;
export type ModelFromFunction<V extends object, D extends object> = ModelMapFunction<D, V>;
export type ModelToFunction<V extends object, D extends object> = ModelMapFunction<V, D>;

export interface ModelMapFunctions<V extends object, D extends object> {
  from: ModelFromFunction<V, D>;
  to: ModelToFunction<V, D>;
}

export type ModelFieldsConversionConfig<V extends object, D extends ModelDataType<V> = ModelDataType<V>> = {
  [K in keyof V]: ModelFieldConversionConfig<V[K], D[K]>;
}

export function makeModelMapFunctions<V extends object, D extends ModelDataType<V> = ModelDataType<V>>(fields: ModelFieldsConversionConfig<V, D>): ModelMapFunctions<V, D> {
  const keys = filterKeyValueTuples(fields);
  const conversionsByKey: [keyof V, ModelFieldMapFunctions][] = keys.map(([key, field]) => [key, makeModelFieldMapFunctions(field)]) as ([keyof V, ModelFieldMapFunctions][]);
  const fromConversions: [keyof D, ModelFieldMapFunction][] = conversionsByKey.map(([key, configs]) => ([key as unknown as keyof D, configs.from]));
  const toConversions: [keyof V, ModelFieldMapFunction][] = conversionsByKey.map(([key, configs]) => ([key, configs.to]));

  const from = makeModelConversionFieldValuesFunction<D>(fromConversions) as ModelFromFunction<V, D>;
  const to = makeModelConversionFieldValuesFunction<V>(toConversions) as ModelToFunction<V, D>;

  return {
    from,
    to
  };
}

export type ModelConversionFieldTuple<I extends object> = [keyof I, ModelFieldMapFunction<unknown, unknown>];
export type ModelConversionFieldValuesConfig<I extends object> = ModelConversionFieldTuple<I>[];

export interface ModelConversionOptions<I extends object, O extends object> {
  /**
   * Fields to include.
   */
  fields?: (keyof I)[];
  /**
   * Whether or not to only convert fields that are defined. Fields with a null value are still converted.
   */
  definedOnly?: boolean;
}

export type ModelConversionFieldValuesFunction<I extends object, O extends object> = ApplyMapFunctionWithOptions<Maybe<I>, O, ModelConversionOptions<I, O>>;

export function makeModelConversionFieldValuesFunction<I extends object, O extends ModelDataType<I> = ModelDataType<I>>(fields: ModelConversionFieldValuesConfig<I>): ModelConversionFieldValuesFunction<I, O> {
  return (input: Maybe<I>, target?: Maybe<Partial<O>>, options?: Maybe<ModelConversionOptions<I, O>>) => {
    target = target ?? {} as Partial<O>;

    if (input) {
      let targetFields = fields;

      // if options are provided, filter down.
      if (options) {
        const fieldsToConvert = new Set(findPOJOKeys(input, {
          keysFilter: options.fields,
          valueFilter: (options.definedOnly === false) ? KeyValueTypleValueFilter.NONE : KeyValueTypleValueFilter.UNDEFINED
        }));

        targetFields = fields.filter(x => fieldsToConvert.has(x[0]));
      }

      targetFields.forEach(([key, convert]) => (target!)[key] = convert(input[key]) as O[keyof I]);
    }

    return target as O;
  }
}

// MARK: Fields
export interface ModelFieldConversionConfig<V = unknown, D = unknown> {
  from?: ModelFieldFromConfig<V, D>;
  to?: ModelFieldToConfig<V, D>;
}

export interface ModelFieldConvertConfig<I, O> {

  /**
   * Default value to use if the input value is null/undefined.
   */
  default?: GetterOrValue<O>;

  /**
   * Whether or not to pass through maybe values to the convert function. Must be explicitly set.
   * 
   * If a default value is provided, this option is ignored.
   */
  convertMaybe?: boolean;

  /**
   * Conversion from I to O.
   */
  convert?: MapFunction<I, O>;

}

export interface ModelFieldFromConfig<V = unknown, D = unknown> extends ModelFieldConvertConfig<D, V> { }
export interface ModelFieldToConfig<V = unknown, D = unknown> extends ModelFieldConvertConfig<V, D> { }

export type ModelFieldMapFunction<I = unknown, O = unknown> = MapFunction<Maybe<I>, O>;
export type ModelFieldFromFunction<V, D> = ModelFieldMapFunction<D, V>;
export type ModelFieldToFunction<V, D> = ModelFieldMapFunction<V, D>;

export interface ModelFieldMapFunctions<V = unknown, D = unknown> {
  from: ModelFieldFromFunction<V, D>;
  to: ModelFieldToFunction<V, D>;
}

export function makeModelFieldMapFunction<I, O>(inputConfig: Maybe<ModelFieldConvertConfig<I, O>>): ModelFieldMapFunction<I, O> {
  const config = inputConfig ?? {};
  const { convertMaybe, convert = (x: I) => x as unknown as O, default: defaultValue } = config;
  const getDefaultValue: Getter<Maybe<O>> = asGetter(defaultValue);

  return (input: Maybe<I>) => {
    if (input == null) {
      if (convertMaybe) {
        return convert(input as I);
      } else {
        return getDefaultValue() as O;
      }
    } else {
      return convert(input);
    }
  }
}

export const makeModelFieldFromFunction = makeModelFieldMapFunction;
export const makeModelFieldToFunction = makeModelFieldMapFunction;

export function makeModelFieldMapFunctions<V = unknown, D = unknown>(config: ModelFieldConversionConfig<V, D>): ModelFieldMapFunctions<V, D> {
  return {
    from: makeModelFieldMapFunction(config.from),
    to: makeModelFieldMapFunction(config.to),
  }
}
