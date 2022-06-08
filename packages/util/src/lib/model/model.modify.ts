import { MaybeMap } from '@dereekb/util';
import { ArrayOrValue, asArray } from '../array/array';
import { filterMaybeValues } from '../array/array.value';
import { Maybe } from '../value/maybe.type';
import { maybeMergeModifiers, ModifierFunction } from '../value/modifier';
import { ModelConversionOptions, ModelMapFunction, ModelMapFunctions } from './model.conversion';

export type ModelInputDataModifier<D extends object> = {
  modifyData: ModifierFunction<D>;
};

export type ModelInputModelModifier<V extends object> = {
  modifyModel: ModifierFunction<V>;
};

export type ModelModifier<V extends object, D extends object> = ModelInputModelModifier<V> & ModelInputDataModifier<D>;
export type PartialModelModifier<V extends object, D extends object> = Partial<MaybeMap<ModelModifier<V, D>>>;

export function maybeMergeModelModifiers<V extends object, D extends object>(input: ArrayOrValue<PartialModelModifier<V, D>>): PartialModelModifier<V, D> {
  const modifiers = asArray(input);
  const allModifyData = filterMaybeValues(modifiers.map((x) => x.modifyData));
  const allModifyModel = filterMaybeValues(modifiers.map((x) => x.modifyModel));
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
 * Merges a ModifierFunction with a ModelMapFunction
 *
 * @param mapFn
 * @param modifyModel
 * @param copy
 * @returns
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
