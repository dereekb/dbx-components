import { MapStringFunction } from '@dereekb/util';
import { Transform } from 'class-transformer';
import { transformCommaSeparatedValueToArray, transformCommaSeparatedStringValueToArray, transformCommaSeparatedNumberValueToArray, transformStringToBoolean } from './type';

// MARK: Transform Annotations
export function TransformCommaSeparatedValueToArray<T>(mapFn: MapStringFunction<T>) {
  return Transform(transformCommaSeparatedValueToArray(mapFn));
}

export const TransformCommaSeparatedStringValueToArray = () => Transform(transformCommaSeparatedStringValueToArray);
export const TransformCommaSeparatedNumberValueToArray = () => Transform(transformCommaSeparatedNumberValueToArray);

export const TransformStringValueToBoolean = () => Transform(transformStringToBoolean());
