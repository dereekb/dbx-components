import { chainMapSameFunctions, type MapFunction } from '../value/map';
import { type Maybe } from '../value/maybe.type';
import { boundNumberFunction, type BoundNumberFunctionConfig } from './bound';
import { cutValueToPrecisionFunction, type NumberPrecision, roundNumberToStepFunction, type RoundNumberToStepFunctionInput } from './round';

export type TransformNumberFunctionConfig<N extends number = number> = {
  /**
   * (Optional) transform function for the input. It is processed first.
   */
  transform?: TransformNumberFunction<N>;
  /**
   * (Optional) step rounding.
   */
  roundToStep?: RoundNumberToStepFunctionInput;
  /**
   * (Optional) decimal precision to retain
   */
  precision?: NumberPrecision;
  /**
   * (Optional bounds to apply to the value)
   */
  bounds?: BoundNumberFunctionConfig<N>;
};

export interface TransformNumberFunctionConfigRef<N extends number = number> {
  transform: TransformNumberFunctionConfig<N>;
}

export type TransformNumberFunction<N extends number = number> = MapFunction<N, N>;

export type TransformNumberFunctionConfigInput<S extends number = number> = TransformNumberFunctionConfig<S> | TransformNumberFunction<S>;

export function transformNumberFunctionConfig<S extends number = number>(config?: TransformNumberFunctionConfigInput<S>): Maybe<TransformNumberFunctionConfig<S>> {
  return config ? (typeof config === 'function' ? { transform: config } : (config as TransformNumberFunctionConfig<S>)) : undefined;
}

export function transformNumberFunction<N extends number = number>(config: TransformNumberFunctionConfig<N>): TransformNumberFunction<N> {
  const transformFunctions: Maybe<TransformNumberFunction<N>>[] = [config.transform];

  if (config.roundToStep) {
    transformFunctions.push(roundNumberToStepFunction(config.roundToStep) as unknown as TransformNumberFunction<N>);
  }

  if (config.precision) {
    transformFunctions.push(cutValueToPrecisionFunction(config.precision) as unknown as TransformNumberFunction<N>);
  }

  if (config.bounds) {
    transformFunctions.push(boundNumberFunction(config.bounds));
  }

  return chainMapSameFunctions<N>(transformFunctions);
}
