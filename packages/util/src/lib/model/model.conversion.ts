import { asGetter, Getter, GetterOrValue } from "../getter/getter";
import { filterKeyValueTuples } from "../object";
import { Maybe } from "../value/maybe";
import { ApplyMapFunction, MapFunction } from "../value/map";

// MARK: Model
export type ModelMapFunction<I extends object, O extends object> = ApplyMapFunction<Maybe<I>, O>;
export type ModelFromFunction<V extends object, D extends object> = ModelMapFunction<D, V>;
export type ModelToFunction<V extends object, D extends object> = ModelMapFunction<V, D>;

export interface ModelMapFunctions<V extends object, D extends object> {
  from: ModelFromFunction<V, D>;
  to: ModelToFunction<V, D>;
}

export type ModelFieldsConversionConfig<I extends object> = {
  [K in keyof I]: ModelFieldConversionConfig;
}

export function makeModelMapFunctions<V extends object, D extends object>(fields: ModelFieldsConversionConfig<V>): ModelMapFunctions<V, D> {
  const keys = filterKeyValueTuples(fields);
  const conversionsByKey: [keyof V, ModelFieldMapFunctions][] = keys.map(([key, field]) => [key, makeModelFieldMapFunctions(field)]);
  const fromConversions: [keyof D, ModelFieldMapFunction][] = conversionsByKey.map(([key, configs]) => ([key as any as keyof D, configs.from]));
  const toConversions: [keyof V, ModelFieldMapFunction][] = conversionsByKey.map(([key, configs]) => ([key, configs.to]));

  const from: ModelFromFunction<V, D> = makeModelConversionFieldValuesFunction<D, V>(fromConversions);
  const to: ModelToFunction<V, D> = makeModelConversionFieldValuesFunction<V, D>(toConversions);

  return {
    from,
    to
  };
}

export type ModelConversionFieldTuple<I extends object> = [keyof I, ModelFieldMapFunction<any, any>];
export type ModelConversionFieldValuesConfig<I extends object> = ModelConversionFieldTuple<I>[];
export type ModelConversionFieldValuesFunction<I extends object, O extends object> = ApplyMapFunction<Maybe<I>, O>;

export function makeModelConversionFieldValuesFunction<I extends object, O extends object>(fields: ModelConversionFieldValuesConfig<I>): ModelConversionFieldValuesFunction<I, O> {
  return (input: Maybe<I>, target: Maybe<Partial<O>>) => {
    target = target ?? {} as Partial<O>;

    if (input) {
      fields.forEach(([key, convert]) => target![key as unknown as keyof O] = convert(input[key]));
    }

    return target as O;
  }
}

// MARK: Fields
export interface ModelFieldConversionConfig<V = any, D = any> {
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

export interface ModelFieldFromConfig<V = any, D = any> extends ModelFieldConvertConfig<D, V> { }
export interface ModelFieldToConfig<V = any, D = any> extends ModelFieldConvertConfig<V, D> { }

export type ModelFieldMapFunction<I = any, O = any> = MapFunction<Maybe<I>, O>;
export type ModelFieldFromFunction<V, D> = ModelFieldMapFunction<D, V>;
export type ModelFieldToFunction<V, D> = ModelFieldMapFunction<V, D>;

export interface ModelFieldMapFunctions<V = any, D = any> {
  from: ModelFieldFromFunction<V, D>;
  to: ModelFieldToFunction<V, D>;
}

export function makeModelFieldMapFunction<I, O>(inputConfig: Maybe<ModelFieldConvertConfig<I, O>>): ModelFieldMapFunction<I, O> {
  const config = inputConfig ?? {};
  const { convertMaybe, convert = (x: I) => x as any, default: defaultValue } = config;
  const getDefaultValue: Getter<Maybe<O>> = asGetter(defaultValue);

  return (input: Maybe<I>) => {
    if (input == null) {
      if (convertMaybe) {
        return convert(input as any);
      } else {
        return getDefaultValue();
      }
    } else {
      return convert(input);
    }
  }
}

export const makeModelFieldFromFunction = makeModelFieldMapFunction;
export const makeModelFieldToFunction = makeModelFieldMapFunction;

export function makeModelFieldMapFunctions<V = any, D = any>(config: ModelFieldConversionConfig<V, D>): ModelFieldMapFunctions<V, D> {
  return {
    from: makeModelFieldMapFunction(config.from),
    to: makeModelFieldMapFunction(config.to),
  }
}
