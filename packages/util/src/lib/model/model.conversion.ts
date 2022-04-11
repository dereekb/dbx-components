import { asGetter, Getter, getValueFromGetter, GetterOrValue } from "../getter/getter";
import { toKeyValueTuples } from "../object";
import { ApplyConversionFunction, ConversionFunction, Maybe } from "../value";

// MARK: Model
export type ModelConversionFunction<I extends object, O extends object> = ApplyConversionFunction<Maybe<I>, O>;
export type ModelFromFunction<V extends object, D extends object> = ModelConversionFunction<D, V>;
export type ModelToFunction<V extends object, D extends object> = ModelConversionFunction<V, D>;

export interface ModelConversionFunctions<V extends object, D extends object> {
  from: ModelFromFunction<V, D>;
  to: ModelToFunction<V, D>;
}

export type ModelFieldsConversionConfig<I extends object> = {
  [K in keyof I]: ModelFieldConversionConfig;
}

export function makeModelConversionFunctions<V extends object, D extends object>(fields: ModelFieldsConversionConfig<V>): ModelConversionFunctions<V, D> {
  const keys = toKeyValueTuples(fields);
  const conversionsByKey: [keyof V, ModelFieldConversionFunctions][] = keys.map(([key, field]) => [key, makeModelFieldConversionFunctions(field)]);
  const fromConversions: [keyof D, ModelFieldConversionFunction][] = conversionsByKey.map(([key, configs]) => ([key as any as keyof D, configs.from]));
  const toConversions: [keyof V, ModelFieldConversionFunction][] = conversionsByKey.map(([key, configs]) => ([key, configs.to]));

  const from: ModelFromFunction<V, D> = makeModelConversionFieldValuesFunction<D, V>(fromConversions);
  const to: ModelToFunction<V, D> = makeModelConversionFieldValuesFunction<V, D>(toConversions);

  return {
    from,
    to
  };
}

export type ModelConversionFieldTuple<I extends object> = [keyof I, ModelFieldConversionFunction<any, any>];
export type ModelConversionFieldValuesConfig<I extends object> = ModelConversionFieldTuple<I>[];
export type ModelConversionFieldValuesFunction<I extends object, O extends object> = ApplyConversionFunction<Maybe<I>, O>;

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
  convert?: ConversionFunction<I, O>;

}

export interface ModelFieldFromConfig<V = any, D = any> extends ModelFieldConvertConfig<D, V> { }
export interface ModelFieldToConfig<V = any, D = any> extends ModelFieldConvertConfig<V, D> { }

export type ModelFieldConversionFunction<I = any, O = any> = ConversionFunction<Maybe<I>, O>;
export type ModelFieldFromFunction<V, D> = ModelFieldConversionFunction<D, V>;
export type ModelFieldToFunction<V, D> = ModelFieldConversionFunction<V, D>;

export interface ModelFieldConversionFunctions<V = any, D = any> {
  from: ModelFieldFromFunction<V, D>;
  to: ModelFieldToFunction<V, D>;
}

export function makeModelFieldConversionFunction<I, O>(inputConfig: Maybe<ModelFieldConvertConfig<I, O>>): ModelFieldConversionFunction<I, O> {
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

export const makeModelFieldFromFunction = makeModelFieldConversionFunction;
export const makeModelFieldToFunction = makeModelFieldConversionFunction;

export function makeModelFieldConversionFunctions<V = any, D = any>(config: ModelFieldConversionConfig<V, D>): ModelFieldConversionFunctions<V, D> {
  return {
    from: makeModelFieldConversionFunction(config.from),
    to: makeModelFieldConversionFunction(config.to),
  }
}
