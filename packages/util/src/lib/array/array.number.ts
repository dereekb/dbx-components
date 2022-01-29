
export function reduceNumbersWithMax(array: number[], emptyArrayValue?: number): number | undefined {
  return reduceNumbersWithMaxFn(emptyArrayValue)(array);
}

export function reduceNumbersWithMaxFn(emptyArrayValue?: number): (array: number[]) => number | undefined {
  return reduceNumbersFn((a, b) => Math.max(a, b), emptyArrayValue);
}

export function reduceNumbersWithMin(array: number[], emptyArrayValue?: number): number | undefined {
  return reduceNumbersWithMinFn(emptyArrayValue)(array);
}

export function reduceNumbersWithMinFn(emptyArrayValue?: number): (array: number[]) => number | undefined {
  return reduceNumbersFn((a, b) => Math.min(a, b), emptyArrayValue);
}

export function reduceNumbersWithAdd(array: number[], emptyArrayValue = 0): number {
  return reduceNumbersWithAddFn(emptyArrayValue)(array);
}

export function reduceNumbersWithAddFn(emptyArrayValue = 0): (array: number[]) => number {
  return reduceNumbersFn((a, b) => a + b, emptyArrayValue);
}

export function reduceNumbers(reduceFn: ((a: number, b: number) => number), array: number[], emptyArrayValue?: number): number | undefined {
  if (array.length === 0) {
    return emptyArrayValue;
  } else {
    return reduceNumbersFn(reduceFn, emptyArrayValue)(array);
  }
}

export function reduceNumbersFn(reduceFn: ((a: number, b: number) => number)): (array: number[]) => number | undefined;
export function reduceNumbersFn<D extends number>(reduceFn: ((a: number, b: number) => number), emptyArrayValue?: D): (array: number[]) => number | D;
export function reduceNumbersFn<D extends number>(reduceFn: ((a: number, b: number) => number), emptyArrayValue?: D): (array: number[]) => number | D | undefined {
  const rFn = (array: number[]) => array.reduce(reduceFn);
  return (array: number[]) => (array.length) ? rFn(array) : emptyArrayValue;
}

/**
 * Generates an array containing the range of numbers specified.
 * 
 * The end value is not included.
 * 
 * @param param0 
 * @returns 
 */
export function range({ start = 0, end }: { start?: number, end: number }): number[] {
  const range = [];

  for (let i = start; i < end; i += 1) {
    range.push(i);
  }

  return range;
}
