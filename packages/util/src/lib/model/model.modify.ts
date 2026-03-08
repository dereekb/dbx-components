import { type ArrayOrValue, asArray } from '../array/array';
import { filterMaybeArrayValues } from '../array/array.value';
import { type Maybe, type MaybeMap } from '../value/maybe.type';
import { maybeMergeModifiers, type ModifierFunction } from '../value/modifier';
import { type ModelConversionOptions, type ModelMapFunction, type ModelMapFunctions } from './model.conversion';

export type ModelInputDataModifier<D extends object> = {
  modifyData: ModifierFunction<D>;
};

export type ModelInputModelModifier<V extends object> = {
  modifyModel: ModifierFunction<V>;
};

export type ModelModifier<V extends object, D extends object> = ModelInputModelModifier<V> & ModelInputDataModifier<D>;
export type PartialModelModifier<V extends object, D extends object> = Partial<MaybeMap<ModelModifier<V, D>>>;

/**
 * Merges one or more partial model modifiers into a single {@link PartialModelModifier}.
 *
 * Combines all `modifyData` and `modifyModel` functions from the input modifiers into unified modifier functions.
 *
 * @param input - One or more partial model modifiers to merge
 * @returns A single merged modifier with combined `modifyData` and `modifyModel` functions
 */
export function maybeMergeModelModifiers<V extends object, D extends object>(input: ArrayOrValue<PartialModelModifier<V, D>>): PartialModelModifier<V, D> {
  const modifiers = asArray(input);
  const allModifyData = filterMaybeArrayValues(modifiers.map((x) => x.modifyData));
  const allModifyModel = filterMaybeArrayValues(modifiers.map((x) => x.modifyModel));
  const modifyData = maybeMergeModifiers(allModifyData);
  const modifyModel = maybeMergeModifiers(allModifyModel);

  return {
    modifyData,
    modifyModel
  };
}

export interface ModifyModelMapFunctionsConfig<V extends object, D extends object> {
  readonly mapFunctions: ModelMapFunctions<V, D>;
  /**
   * Partial model modifiers to use.
   */
  readonly modifiers: ArrayOrValue<PartialModelModifier<V, D>>;
  /**
   * Provides a default value for both copyModel and copyData.
   */
  readonly copy?: boolean;
  /**
   * Whether or not to copy the input model before applying modifiers.
   *
   * Defaults to true.
   */
  readonly copyModel?: boolean;
  /**
   * Whether or not to copy the input data before applying modifiers.
   *
   * Defaults to true.
   */
  readonly copyData?: boolean;
}

/**
 * Wraps existing {@link ModelMapFunctions} with modifier functions that are applied to the input before conversion.
 *
 * Optionally copies the input object before modification to avoid mutating the original.
 *
 * @param config - Configuration with the base map functions, modifiers, and copy options
 * @returns New model map functions with modifiers applied before each conversion
 */
export function modifyModelMapFunctions<V extends object, D extends object>(config: ModifyModelMapFunctionsConfig<V, D>): ModelMapFunctions<V, D> {
  const { copy, copyModel = copy, copyData = copy, mapFunctions, modifiers } = config;
  const { from, to } = mapFunctions;
  const { modifyData, modifyModel } = maybeMergeModelModifiers(modifiers);

  const modifyFrom = modifyModelMapFunction(from, modifyData, copyData);
  const modifyTo = modifyModelMapFunction(to, modifyModel, copyModel);

  return {
    from: modifyFrom,
    to: modifyTo
  };
}

/**
 * Wraps a single {@link ModelMapFunction} with a modifier that is applied to the input before the map function runs.
 *
 * When `copy` is true (default), the input is shallow-copied before modification to avoid mutating the original.
 * If no modifier is provided, the original map function is returned unchanged.
 *
 * @param mapFn - The base map function to wrap
 * @param modifyModel - Optional modifier to apply before mapping
 * @param copy - Whether to shallow-copy the input before modifying; defaults to true
 * @returns The wrapped map function, or the original if no modifier is provided
 */
export function modifyModelMapFunction<I extends object, O extends object>(mapFn: ModelMapFunction<I, O>, modifyModel: Maybe<ModifierFunction<I>>, copy = true): ModelMapFunction<I, O> {
  return modifyModel
    ? (input: Maybe<I>, target?: Maybe<Partial<O>>, options?: Maybe<ModelConversionOptions<I>>) => {
        const inputToMap = copy && input != null ? { ...input } : input;

        if (inputToMap != null) {
          modifyModel(inputToMap);
        }

        return mapFn(inputToMap, target, options);
      }
    : mapFn;
}
