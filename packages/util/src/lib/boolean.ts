export function reduceBooleansWithAnd(array: boolean[], emptyArrayValue?: boolean): boolean {
  return reduceBooleansWithAndFn(emptyArrayValue)(array);
}

export function reduceBooleansWithOr(array: boolean[], emptyArrayValue?: boolean): boolean {
  return reduceBooleansWithOrFn(emptyArrayValue)(array);
}

export function reduceBooleansWithAndFn(emptyArrayValue?: boolean): (array: boolean[]) => boolean {
  return reduceBooleansFn((a, b) => a && b, emptyArrayValue);
}

export function reduceBooleansWithOrFn(emptyArrayValue?: boolean): (array: boolean[]) => boolean {
  return reduceBooleansFn((a, b) => a || b, emptyArrayValue);
}

export function reduceBooleansFn(reduceFn: (a: boolean, b: boolean) => boolean, emptyArrayValue?: boolean): (array: boolean[]) => boolean {
  const rFn = (array: boolean[]) => Boolean(array.reduce(reduceFn));

  if (emptyArrayValue != null) {
    return (array: boolean[]) => (array.length ? rFn(array) : emptyArrayValue);
  } else {
    return rFn;
  }
}
