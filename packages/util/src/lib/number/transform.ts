import { chainMapSameFunctions, MapFunction, MAP_IDENTITY } from '../value/map';
import { Maybe } from '../value/maybe.type';
import { boundNumberFunction, BoundNumberFunctionConfig } from './bound';
import { cutValueToPrecisionFunction, NumberPrecision, roundNumberToStepFunction, RoundNumberToStepFunctionInput } from './round';

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

export type TransformNumberFunction<N extends number = number> = MapFunction<N, N>;

export function transformNumberFunction<N extends number = number>(config: TransformNumberFunctionConfig<N>): TransformNumberFunction<N> {
  let transformFunctions: Maybe<TransformNumberFunction<N>>[] = [config.transform];

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
