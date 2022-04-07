import { Observable } from 'rxjs';
import { ArrayOrValue } from '@dereekb/util';
import { DocumentSnapshot, getDocs, limit, query, QueryConstraint, startAt, Query as FirebaseFirestoreQuery, where, startAfter, orderBy, limitToLast, endBefore, endAt, onSnapshot, Transaction as FirebaseFirestoreTransaction } from "firebase/firestore";
import { FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE, FIRESTORE_START_AFTER_QUERY_CONSTRAINT_TYPE, FIRESTORE_START_AT_QUERY_CONSTRAINT_TYPE, FIRESTORE_WHERE_QUERY_CONSTRAINT_TYPE, FIRESTORE_LIMIT_TO_LAST_QUERY_CONSTRAINT_TYPE, FIRESTORE_ORDER_BY_QUERY_CONSTRAINT_TYPE, FullFirestoreQueryConstraintHandlersMapping, FIRESTORE_OFFSET_QUERY_CONSTRAINT_TYPE, FIRESTORE_END_AT_QUERY_CONSTRAINT_TYPE, FIRESTORE_END_BEFORE_QUERY_CONSTRAINT_TYPE } from './../../common/firestore/query/constraint';
import { makeFirestoreQueryConstraintFunctionsDriver } from '../../common/firestore/driver/query.handler';
import { FirestoreQueryConstraintFunctionsDriver, FirestoreQueryDriver } from "../../common/firestore/driver/query";
import { Query, QuerySnapshot, Transaction } from "../../common/firestore/types";
import { streamFromOnSnapshot } from '../../common/firestore/query/query.util';

export interface FirebaseFirestoreQueryBuilder<T = any> {
  query: Query<T>;
  constraints: QueryConstraint[];
}

export function addConstraintToBuilder<T>(builder: FirebaseFirestoreQueryBuilder<T>, constraint: ArrayOrValue<QueryConstraint>): FirebaseFirestoreQueryBuilder<T> {
  return {
    query: builder.query,
    constraints: builder.constraints.concat(constraint)
  };
}

export const FIRESTORE_CLIENT_QUERY_CONSTRAINT_HANDLER_MAPPING: FullFirestoreQueryConstraintHandlersMapping<FirebaseFirestoreQueryBuilder> = {
  [FIRESTORE_LIMIT_QUERY_CONSTRAINT_TYPE]: (builder, data) => addConstraintToBuilder(builder, limit(data.limit)),
  [FIRESTORE_LIMIT_TO_LAST_QUERY_CONSTRAINT_TYPE]: (builder, data) => addConstraintToBuilder(builder, limitToLast(data.limit)),
  [FIRESTORE_ORDER_BY_QUERY_CONSTRAINT_TYPE]: (builder, data) => addConstraintToBuilder(builder, orderBy(data.fieldPath, data.directionStr)),
  [FIRESTORE_WHERE_QUERY_CONSTRAINT_TYPE]: (builder, data) => addConstraintToBuilder(builder, where(data.fieldPath, data.opStr, data.value)),
  [FIRESTORE_OFFSET_QUERY_CONSTRAINT_TYPE]: undefined,
  [FIRESTORE_START_AT_QUERY_CONSTRAINT_TYPE]: (builder, data) => addConstraintToBuilder(builder, startAt(data.snapshot as DocumentSnapshot)),
  [FIRESTORE_START_AFTER_QUERY_CONSTRAINT_TYPE]: (builder, data) => addConstraintToBuilder(builder, startAfter(data.snapshot as DocumentSnapshot)),
  [FIRESTORE_END_AT_QUERY_CONSTRAINT_TYPE]: (builder, data) => addConstraintToBuilder(builder, endAt(data.snapshot as DocumentSnapshot)),
  [FIRESTORE_END_BEFORE_QUERY_CONSTRAINT_TYPE]: (builder, data) => addConstraintToBuilder(builder, endBefore(data.snapshot as DocumentSnapshot)),
};

export function firebaseFirestoreQueryConstraintFunctionsDriver(): FirestoreQueryConstraintFunctionsDriver {
  return makeFirestoreQueryConstraintFunctionsDriver({
    mapping: FIRESTORE_CLIENT_QUERY_CONSTRAINT_HANDLER_MAPPING,
    init: <T>(query: Query<T>) => ({ query, constraints: [] }),
    build: <T>({ query: initialQuery, constraints }: FirebaseFirestoreQueryBuilder<T>) => query(initialQuery as FirebaseFirestoreQuery<T>, ...constraints)
  });
}

export function firebaseFirestoreQueryDriver(): FirestoreQueryDriver {
  return {
    ...firebaseFirestoreQueryConstraintFunctionsDriver(),
    getDocs<T>(query: Query<T>, transaction?: Transaction): Promise<QuerySnapshot<T>> {
      if (transaction) {
        // TODO: Decide if by design we should log an error, or throw an exception like this.
        throw new Error('The firebaseFirestoreQueryDriver does not support transactions with queries.');
      }

      return getDocs(query as FirebaseFirestoreQuery<T>);
    },
    streamDocs<T>(query: Query<T>): Observable<QuerySnapshot<T>> {
      return streamFromOnSnapshot((obs) => onSnapshot((query as FirebaseFirestoreQuery<T>), obs));
    }
  };
}
