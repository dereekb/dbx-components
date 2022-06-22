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
export function mapHttpsCallable<I, O, A, B = unknown>(callable: HttpsCallable<A, B>, wrap: MapHttpsCallable<I, O, A, B>): HttpsCallable<I, O>;
export function mapHttpsCallable<I, O, A, B = unknown>(callable: HttpsCallable<A, B>, wrap: MapHttpsCallable<I, O, A, B>, directData: false): HttpsCallable<I, O>;
export function mapHttpsCallable<I, O, A, B = unknown>(callable: HttpsCallable<A, B>, wrap: MapHttpsCallable<I, O, A, B>, directData: true): DirectDataHttpsCallable<HttpsCallable<I, O>>;
export function mapHttpsCallable<I, O, A, B = unknown>(callable: HttpsCallable<A, B>, wrap: MapHttpsCallable<I, O, A, B>, directData?: boolean): HttpsCallable<I, O> | DirectDataHttpsCallable<HttpsCallable<I, O>>;
export function mapHttpsCallable<I, O, A, B = unknown>(callable: HttpsCallable<A, B>, wrap: MapHttpsCallable<I, O, A, B>, directData = false): HttpsCallable<I, O> | DirectDataHttpsCallable<HttpsCallable<I, O>> {
  const { mapInput = (x: Maybe<I>) => x as unknown as A, mapOutput = (x: Maybe<B>) => x as unknown as O } = wrap;

  return (async (inputData?: Maybe<I>): Promise<HttpsCallableResult<O> | O> => {
    const data: A = await mapInput(inputData);

    const result: HttpsCallableResult<B> = await callable(data);
    const resultData: Maybe<B> = result.data;
    const mappedResultData: O = await mapOutput(resultData);

    if (directData) {
      return mappedResultData;
    } else {
      return {
        ...result,
        data: mappedResultData
      };
    }
  }) as HttpsCallable<I, O> | DirectDataHttpsCallable<HttpsCallable<I, O>>;
}

/**
 * Wraps an HttpsCallable value so it returns only the data from the result, rather than an object with data attached.
 */
export type DirectDataHttpsCallable<C extends HttpsCallable<any, any>> = C extends HttpsCallable<infer I, infer O> ? (data?: I | null) => Promise<O> : never;

export function directDataHttpsCallable<I, O, C extends HttpsCallable<I, O> = HttpsCallable<I, O>>(callable: C): DirectDataHttpsCallable<C> {
  return ((data: I) => callable(data).then((x) => x.data)) as DirectDataHttpsCallable<C>;
}
