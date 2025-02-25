import { filterMaybeArrayValues } from './array';

export type HashSalt = string;

export type HashDecodeMap<H extends string = string, V extends string = string> = Map<H, V>;

export function decodeHashedValues(hashedValues: string[], decodeValues: string[], hashFn: (value: string) => string) {
  const hashDecodeMap = makeHashDecodeMap(decodeValues, hashFn);
  return decodeHashedValuesWithDecodeMap(hashedValues, hashDecodeMap);
}

export function makeHashDecodeMap(decodeValues: string[], hashFn: (value: string) => string): HashDecodeMap {
  const keyValuePairs = decodeValues.map((x) => [hashFn(x), x] as [string, string]);
  const map: HashDecodeMap = new Map(keyValuePairs);
  return map;
}

export function decodeHashedValuesWithDecodeMap(hashedValues: string[], decodeMap: HashDecodeMap): string[] {
  const values = hashedValues.map((x) => decodeMap.get(x));
  return filterMaybeArrayValues(values);
}
