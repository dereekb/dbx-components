/**
 * Key that corresponds with a function on the server.
 */
export type FirebaseFunctionKey = string;

/**
 * Typings tuple for a FirebaseFunction. Denotes the expected input and output values.
 */
export type FirebaseFunctionType<I = unknown, O = unknown> = [I, O];

/**
 * An asynchronous function that calls a function on the Firebase server.
 */
export type FirebaseFunction<I = unknown, O = unknown> = (input: I) => Promise<O>;

/**
 * Type with keys corresponding to functions on the corresponding server for a client.
 */
export type FirebaseFunctionTypeMap = {
  readonly [key: FirebaseFunctionKey]: FirebaseFunctionType;
};

/**
 * A FirebaseFunction map. Its types are relative to a FirebaseFunctionTypeMap.
 */
export type FirebaseFunctionMap<M extends FirebaseFunctionTypeMap> = {
  readonly [K in keyof M]: FirebaseFunctionMapFunction<M, K>;
};

/**
 * Typings for a function within a FirebaseFunctionMap.
 */
export type FirebaseFunctionMapFunction<M extends FirebaseFunctionTypeMap, K extends keyof M = keyof M> = FirebaseFunction<M[K][0], M[K][1]>;
