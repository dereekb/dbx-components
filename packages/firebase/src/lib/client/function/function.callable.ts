import { FactoryWithInput, Maybe, PromiseOrValue } from '@dereekb/util';
import { HttpsCallable, HttpsCallableResult } from 'firebase/functions';

export interface MapHttpsCallable<I, O, A, B> {
  mapInput?: FactoryWithInput<PromiseOrValue<A>, Maybe<I>>;
  mapOutput?: FactoryWithInput<PromiseOrValue<O>, Maybe<B>>;
}

/**
 * Maps input and output values for an
 * @param callable
 * @param wrap
 * @returns
 */
export function mapHttpsCallable<I, O, A, B = unknown>(callable: HttpsCallable<A, B>, wrap: MapHttpsCallable<I, O, A, B>): HttpsCallable<I, O> {
  const { mapInput = (x: Maybe<I>) => x as unknown as A, mapOutput = (x: Maybe<B>) => x as unknown as O } = wrap;

  return async (inputData?: Maybe<I>): Promise<HttpsCallableResult<O>> => {
    const data: A = await mapInput(inputData);

    const result: HttpsCallableResult<B> = await callable(data);
    const resultData: Maybe<B> = result.data;
    const mappedResultData: O = await mapOutput(resultData);

    return {
      ...result,
      data: mappedResultData
    };
  };
}
