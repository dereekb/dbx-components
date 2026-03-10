import { objectToMap } from '@dereekb/util';
import { type Query } from '../types';
import { type FirestoreQueryConstraint, type FirestoreQueryConstraintHandlerMap } from '../query/constraint';
import { type FirestoreQueryConstraintFunctionsDriver, type FirestoreQueryDriverQueryFunction } from './query';

/**
 * Configuration for building a {@link FirestoreQueryConstraintFunctionsDriver} from a
 * handler map pattern. Each platform (Web SDK, Admin SDK) provides its own handler map
 * that maps constraint type strings to builder functions.
 *
 * @template B - The platform-specific query builder type (e.g., the Firestore Query itself)
 */
export interface MakeFirestoreQueryConstraintFunctionsDriver<B> extends Omit<FirestoreQueryConstraintFunctionsDriver, 'query' | 'availableConstraintTypes'> {
  /** Maps constraint type names to handler functions that apply them to the builder. */
  mapping: FirestoreQueryConstraintHandlerMap<B>;
  /** Initializes a builder from a base query. */
  init: <T>(query: Query<T>) => B;
  /** Converts the finalized builder back to a query. */
  build: <T>(builder: B) => Query<T>;
}

/**
 * Creates a {@link FirestoreQueryConstraintFunctionsDriver} from a handler map configuration.
 *
 * This factory enables platform-specific query implementations to register their constraint
 * handlers declaratively. The returned driver applies constraints sequentially using the
 * registered handlers and throws if an unsupported constraint type is encountered.
 *
 * @template B - The platform-specific query builder type
 * @param config - The handler map configuration
 * @returns A fully configured constraint functions driver
 *
 * @throws {Error} When a query uses a constraint type not present in the handler map
 */
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
