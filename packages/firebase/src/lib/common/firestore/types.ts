/**
 * Platform-agnostic Firestore type definitions.
 *
 * These types mirror the interfaces from both `@google-cloud/firestore` (Admin SDK) and
 * `firebase/firestore` (Web SDK) so that the rest of the codebase can work with either
 * platform without importing platform-specific packages directly. This is the foundation
 * of the cross-platform driver abstraction.
 *
 * @module
 */
/* eslint-disable */

import { StringKeyPropertyKeys } from '@dereekb/util';
import { UnionToIntersection } from 'ts-essentials';
import { FirestoreModelKey, FirestoreModelId } from './collection';

// MARK: Firestore
/**
 * Minimal shape of the Firebase Web SDK Firestore instance.
 */
export type FirebaseFirestoreLikeFirestore = { type: string };

/**
 * Minimal shape of the Google Cloud Admin SDK Firestore instance.
 */
export type GoogleCloudLikeFirestore = { terminate(): Promise<void> };

/**
 * Union type representing either a Web SDK or Admin SDK Firestore instance.
 *
 * Code that needs the concrete type should cast through the driver layer.
 * Direct access to this type is rarely needed outside of driver implementations.
 */
export type Firestore = FirebaseFirestoreLikeFirestore | GoogleCloudLikeFirestore;

// MARK: Data
export type Primitive = string | number | boolean | undefined | null;

export interface FieldValue {
  isEqual(other: FieldValue): boolean;
}

export type PartialWithFieldValue<T> = Partial<T> | (T extends Primitive ? T : T extends {} ? { [K in keyof T]?: PartialWithFieldValue<T[K]> | FieldValue } : never);

export type WithFieldValue<T> = T | (T extends Primitive ? T : T extends {} ? { [K in keyof T]: WithFieldValue<T[K]> | FieldValue } : never);

export type AddPrefixToKeys<Prefix extends string, T extends Record<string, unknown>> = { [K in keyof T & string as `${Prefix}.${K}`]+?: T[K] };
export type ChildUpdateFields<K extends string, V> = V extends Record<string, unknown> ? AddPrefixToKeys<K, UpdateData<V>> : never;
export type NestedUpdateFields<T extends Record<string, unknown>> = UnionToIntersection<{ [K in keyof T & string]: ChildUpdateFields<K, T[K]> }[keyof T & string]>;
export type UpdateData<T> = T extends Primitive ? T : T extends {} ? { [K in keyof T]?: UpdateData<T[K]> | FieldValue } & NestedUpdateFields<T> : Partial<T>;

export interface FieldPath {
  isEqual(other: FieldPath): boolean;
}

/**
 * A field path expressed as either a dot-separated string or a {@link FieldPath} object.
 */
export type FieldPathOrStringPath = string | FieldPath;

/**
 * A type-safe field path that restricts string keys to those present on `T`.
 */
export type FieldPathOrStringPathOf<T = object> = StringKeyPropertyKeys<T> | FieldPath;

/**
 * Extracts the top-level field name from each path, discarding nested segments.
 *
 * @param input - Array of field paths (strings or FieldPath objects)
 * @returns Array of top-level field name strings
 */
export function asTopLevelFieldPaths(input: (string | FieldPath)[]): string[] {
  return input.map(asTopLevelFieldPath);
}

/**
 * Extracts the top-level field name from a path, discarding nested segments.
 * For example, `'address.city'` returns `'address'`.
 *
 * @param input - A field path (string or FieldPath object)
 * @returns The top-level field name
 */
export function asTopLevelFieldPath(input: string | FieldPath): string {
  let path: string;

  if (typeof input === 'string') {
    path = input;
  } else {
    const fullPath = input.toString();
    path = fullPath.split('.')[0];
  }

  return path;
}

export interface Timestamp {
  readonly seconds: number;
  readonly nanoseconds: number;
  toDate(): Date;
  toMillis(): number;
  isEqual(other: Timestamp): boolean;
  toString(): string;
  valueOf(): string;
}

// MARK: Snapshots
export interface DocumentData {
  [field: string]: any;
}

/**
 * Document data with the id appended to it.
 */
export type DocumentDataWithId<T = DocumentData> = T & { id: FirestoreModelId };

/**
 * Document data with the key appended to it.
 */
export type DocumentDataWithKey<T = DocumentData> = T & { key: FirestoreModelKey };

/**
 * Document data with the id and key appended to it.
 */
export type DocumentDataWithIdAndKey<T = DocumentData> = DocumentDataWithId<T> & DocumentDataWithKey<T>;

export interface DocumentSnapshot<T = DocumentData> {
  readonly id: string;
  readonly ref: DocumentReference<T>;
  data(options?: SnapshotOptions): T | undefined;
}

export type SetOptions = SetOptionsMerge | SetOptionsMergeFields;

export interface SetOptionsMerge {
  readonly merge: boolean | undefined;
}

export interface SetOptionsMergeFields {
  readonly mergeFields: Array<string | FieldPath>;
}

export interface SnapshotOptions {
  readonly serverTimestamps?: 'estimate' | 'previous' | 'none';
}

export interface SnapshotListenOptions {
  readonly includeMetadataChanges?: boolean;
}

// MARK: Converter
/**
 * Mirrors the types/methods of FirestoreDataConverter.
 */
export interface FirestoreDataConverter<T, O = DocumentData> {
  toFirestore(modelObject: WithFieldValue<T>): O;
  toFirestore(modelObject: PartialWithFieldValue<T>, options: SetOptions): O;
  fromFirestore(snapshot: QueryDocumentSnapshot<O>, options?: SnapshotOptions): T;
}

// MARK: Document
export interface DocumentReference<T = DocumentData> {
  readonly type?: 'document';
  readonly firestore: Firestore;
  readonly id: string;
  readonly path: string;
  readonly parent?: CollectionReference<T>;
  withConverter<U>(converter: FirestoreDataConverter<U>): DocumentReference<U>;
  withConverter(converter: null): DocumentReference<DocumentData>;
}

// MARK: Collection
export interface CollectionReference<T = DocumentData, P = DocumentData> extends Query<T> {
  readonly type?: 'collection';
  readonly id: string;
  readonly path: string;
  readonly parent: DocumentReference<P> | null;
  withConverter<U, P = DocumentData>(converter: FirestoreDataConverter<U>): CollectionReference<U, P>;
  withConverter<P = DocumentData>(converter: null): CollectionReference<DocumentData, P>;
}

// MARK: CollectionGroup
export interface CollectionGroup<T = DocumentData> extends Query<T> {
  readonly type?: 'query';
  withConverter<U>(converter: FirestoreDataConverter<U>): CollectionGroup<U>;
  withConverter(converter: null): CollectionGroup<DocumentData>;
}

// MARK: Batch
export interface WriteBatch {
  /**
   * Commits the changes.
   */
  commit(): Promise<WriteResult[] | void>;
}

export type Transaction = object;

// MARK: Query
export interface Query<T = DocumentData> {
  readonly type?: 'query' | 'collection';
  readonly firestore: Firestore;
  withConverter<U>(converter: FirestoreDataConverter<U>): Query<U>;
  withConverter(converter: null): Query<DocumentData>;
}

export type QueryConstraintType = 'where' | 'orderBy' | 'limit' | 'limitToLast' | 'startAt' | 'startAfter' | 'endAt' | 'endBefore';

export interface QueryConstraint {
  readonly type: QueryConstraintType;
}

export interface QuerySnapshot<T = DocumentData> {
  readonly query: Query<T>;
  readonly docs: Array<QueryDocumentSnapshot<T>>;
  readonly size: number;
  readonly empty: boolean;
  forEach(callback: (result: QueryDocumentSnapshot<T>) => void, thisArg?: unknown): void;
  docChanges(): DocumentChange<T>[];
}

export interface QueryDocumentSnapshot<T = DocumentData> extends DocumentSnapshot<T> {
  // readonly createTime: Timestamp;
  // readonly updateTime: Timestamp;
  data(options?: SnapshotOptions): T;
}

export type QueryDocumentSnapshotArray<T> = QueryDocumentSnapshot<T>[];

export declare type DocumentChangeType = 'added' | 'removed' | 'modified';

export declare interface DocumentChange<T = DocumentData> {
  readonly type: DocumentChangeType;
  readonly doc: QueryDocumentSnapshot<T>;
  readonly oldIndex: number;
  readonly newIndex: number;
}

// MARK: Server-Specific
export interface WriteResult {
  readonly writeTime: Timestamp;
}

export interface Precondition {
  readonly lastUpdateTime?: Timestamp;
}

export interface ReadOnlyTransactionOptions {
  readOnly: true;
  readTime?: Timestamp;
}

export interface ReadWriteTransactionOptions {
  readOnly?: false;
  maxAttempts?: number;
}
