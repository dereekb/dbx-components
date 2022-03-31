import { ArrayOrValue } from '@dereekb/util';
import { DocumentSnapshot, getDocs, limit, query, QueryConstraint, startAt, Query as FirebaseFirestoreQuery } from "firebase/firestore";
import { FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE, FIRESTORE_START_AT_QUERY_CONSTRAINT_TYPE, FullFirestoreQueryConstraintHandlersMapping, makeFirestoreQueryConstraintFunctionsDriver, Query, QuerySnapshot } from "../../common";
import { FirestoreQueryConstraintFunctionsDriver, FirestoreQueryDriver } from "../../common/firestore/query/driver";

export interface FirestoreClientQueryBuilder<T = any> {
  query: Query<T>;
  constraints: QueryConstraint[];
}

export function addConstraintToBuilder<T>(builder: FirestoreClientQueryBuilder<T>, constraint: ArrayOrValue<QueryConstraint>): FirestoreClientQueryBuilder<T> {
  return {
    query: builder.query,
    constraints: builder.constraints.concat(constraint)
  };
}

export const FIRESTORE_CLIENT_QUERY_CONSTRAINT_HANDLER_MAPPING: FullFirestoreQueryConstraintHandlersMapping<FirestoreClientQueryBuilder> = {
  [FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE]: (builder, data) => addConstraintToBuilder(builder, limit(data.limit)),
  [FIRESTORE_START_AT_QUERY_CONSTRAINT_TYPE]: (builder, data) => addConstraintToBuilder(builder, startAt(data.snapshot as DocumentSnapshot)),
};

export function firestoreClientQueryConstraintFunctionsDriver(): FirestoreQueryConstraintFunctionsDriver {
  return makeFirestoreQueryConstraintFunctionsDriver({
    mapping: FIRESTORE_CLIENT_QUERY_CONSTRAINT_HANDLER_MAPPING,
    init: <T>(query: Query<T>) => ({ query, constraints: [] }),
    build: <T>({ query: initialQuery, constraints }: FirestoreClientQueryBuilder<T>) => query(initialQuery as FirebaseFirestoreQuery<T>, ...constraints)
  });
}

export function firestoreClientQueryDriver(): FirestoreQueryDriver {
  return {
    ...firestoreClientQueryConstraintFunctionsDriver(),
    getDocs<T>(query: Query<T>): Promise<QuerySnapshot<T>> {
      return getDocs(query as FirebaseFirestoreQuery<T>);
    }
  };
}
