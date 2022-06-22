import { FactoryWithRequiredInput } from '../getter/getter';
import { MapFunction, AsyncMapFunction } from './map';

/**
 * A map function that derives a boolean from the input.
 */
export type DecisionFunction<I> = MapFunction<I, boolean>;
export type AsyncDecisionFunction<I> = AsyncMapFunction<DecisionFunction<I>>;

export type DecisionFunctionFactory<C, I> = FactoryWithRequiredInput<DecisionFunction<I>, C>;
