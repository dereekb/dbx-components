
export declare type ClassType<T = any> = {
  new(...args: any[]): T;
};

/**
 * Special type used to defined other type definitions that state the defined type has every key of one type, but each key has a single/new value type.
 */
export type KeyValueTransformMap<T, V, K extends keyof T = keyof T> = { [k in K]: V }

export type BooleanKeyValueTransformMap<T> = KeyValueTransformMap<T, boolean>;


// MARK: Typings
export type RemoveIndex<T> = {
  [ K in keyof T as string extends K ? never : number extends K ? never : K ] : T[K]
};

/**
 * Custom typing used to only retain known keys on types that have a [key: string] in their type.
 * 
 * https://stackoverflow.com/questions/51954558/how-can-i-remove-a-wider-type-from-a-union-type-without-removing-its-subtypes-in/51955852#51955852
 */
export type KnownKeys<T> = keyof RemoveIndex<T>;
