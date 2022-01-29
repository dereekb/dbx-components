
export declare type ClassType<T> = {
  new (...args: any[]): T;
};

/**
 * Special type used to defined other type definitions that state the defined type has every key of one type, but each key has a single/new value type.
 */
 export type KeyValueTransformMap<T, V, K extends keyof T = keyof T> = { [k in K]: V }
