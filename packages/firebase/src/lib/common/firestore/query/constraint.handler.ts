import { objectToMap } from '@dereekb/util';
import { Query } from '../types';
import { FirestoreQueryConstraint, FirestoreQueryConstraintHandlerMap } from "./constraint";
import { FirestoreQueryConstraintFunctionsDriver, FirestoreQueryDriverQueryFunction } from './driver';

export interface MakeFirestoreQueryConstraintFunctionsDriver<B> {
  mapping: FirestoreQueryConstraintHandlerMap<B>;
  init: <T>(query: Query<T>) => B;
  build: <T>(builder: B) => Query<T>;
}

export function makeFirestoreQueryConstraintFunctionsDriver<B>(config: MakeFirestoreQueryConstraintFunctionsDriver<B>): FirestoreQueryConstraintFunctionsDriver {
  const { mapping, init, build } = config;
  const constraintsMap = objectToMap(mapping);
  const availableConstraintTypes: Set<string> = new Set(constraintsMap.keys());
  const query: FirestoreQueryDriverQueryFunction = <T>(query: Query<T>, ...queryConstraints: FirestoreQueryConstraint[]) => {
    let builder = init(query);

    queryConstraints.forEach((x: FirestoreQueryConstraint) => {
      const handler = constraintsMap.get(x.type);

      if (!handler) {
        throw new Error(`The current driver does not support the query constraint with type "${x.type}".`);
      }

      builder = handler(builder, x);
    });

    return build(builder);
  };

  return {
    availableConstraintTypes,
    query
  };
}
