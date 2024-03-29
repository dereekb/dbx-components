import { objectToMap } from '@dereekb/util';
import { type Query } from '../types';
import { type FirestoreQueryConstraint, type FirestoreQueryConstraintHandlerMap } from '../query/constraint';
import { type FirestoreQueryConstraintFunctionsDriver, type FirestoreQueryDriverQueryFunction } from './query';

export interface MakeFirestoreQueryConstraintFunctionsDriver<B> extends Omit<FirestoreQueryConstraintFunctionsDriver, 'query' | 'availableConstraintTypes'> {
  mapping: FirestoreQueryConstraintHandlerMap<B>;
  init: <T>(query: Query<T>) => B;
  build: <T>(builder: B) => Query<T>;
}

export function makeFirestoreQueryConstraintFunctionsDriver<B>(config: MakeFirestoreQueryConstraintFunctionsDriver<B>): FirestoreQueryConstraintFunctionsDriver {
  const { mapping, init, build, documentIdFieldPath } = config;
  const constraintsMap = objectToMap(mapping);
  const availableConstraintTypes: Set<string> = new Set(constraintsMap.keys());
  const query: FirestoreQueryDriverQueryFunction = <T>(query: Query<T>, ...queryConstraints: FirestoreQueryConstraint[]) => {
    let builder = init(query);

    queryConstraints.forEach((x: FirestoreQueryConstraint) => {
      const handler = constraintsMap.get(x.type);

      if (!handler) {
        throw new Error(`The current driver does not support the query constraint with type "${x.type}".`);
      }

      builder = handler(builder, x.data, x);
    });

    return build(builder);
  };

  return {
    availableConstraintTypes,
    query,
    documentIdFieldPath
  };
}
