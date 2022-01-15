import { Maybe } from "@dereekb/util";

export function filterMaybeValues<T>(values: Maybe<Maybe<T>[]>): T[] {
  if (values) {
    return values.filter(x => x != null) as T[];
  } else {
    return [];
  }
}
