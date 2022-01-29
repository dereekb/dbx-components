import { Maybe } from "@dereekb/util";

export function filterMaybeValues<T>(values: Maybe<Maybe<T>[]>): T[] {
  if (values) {
    return values.filter(filterMaybeValuesFn);
  } else {
    return [];
  }
}

export function filterMaybeValuesFn<T>(value: Maybe<T>): value is T {
  return value != null;
}
