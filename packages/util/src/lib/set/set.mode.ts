/**
 * Set inclusion comparison type.
 * - all: The set must include all values from values (set is a subset of values)
 * - all_reverse: All values must be included in the set (values is a subset of set)
 * - any: Any value from values is in the set
 */
export type SetIncludesMode = 'all' | 'any';
