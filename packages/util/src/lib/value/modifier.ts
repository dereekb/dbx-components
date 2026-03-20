import { type ArrayOrValue, forEachWithArray } from '../array';
import { type Maybe } from './maybe.type';

/**
 * String key that uniquely identifies a modifier within a {@link ModifierMap}.
 */
export type ModifierKey = string;

/**
 * Function that mutates the input value in place.
 */
export type ModifierFunction<T> = (input: T) => void;

/**
 * Holds a reference to a {@link ModifierFunction}.
 */
export interface ModifierFunctionRef<T> {
  readonly modify: ModifierFunction<T>;
}

/**
 * A keyed modifier that pairs a unique {@link ModifierKey} with a {@link ModifierFunction}.
 *
 * The key allows modifiers to be added, replaced, or removed from a {@link ModifierMap} by identity.
 */
export interface Modifier<T> extends ModifierFunctionRef<T> {
  /**
   * Unique key identifying this modifier.
   */
  readonly key: ModifierKey;
}

/**
 * Creates a {@link Modifier} with the given key and modify function.
 *
 * @param key - unique identifier for the modifier
 * @param modify - function that mutates the target value
 * @returns a new {@link Modifier} pairing the key with the modify function
 *
 * @example
 * ```ts
 * const uppercaseName = modifier<{ name: string }>('uppercase', (x) => { x.name = x.name.toUpperCase(); });
 * const obj = { name: 'alice' };
 * uppercaseName.modify(obj);
 * // obj.name === 'ALICE'
 * ```
 */
export function modifier<T>(key: string, modify: ModifierFunction<T>): Modifier<T> {
  return {
    key,
    modify
  };
}

/**
 * A no-operation modifier that does nothing to the input. Useful as a default/fallback.
 *
 * @returns undefined (no mutation is performed)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const NOOP_MODIFIER: ModifierFunction<any> = () => undefined;

/**
 * Map of {@link Modifier} instances keyed by their {@link ModifierKey}, enabling lookup, replacement, and removal by key.
 */
export type ModifierMap<T> = Map<ModifierKey, Modifier<T>>;

/**
 * Adds one or more modifiers to the map, creating a new map if none is provided.
 *
 * If a modifier with the same key already exists, it is replaced.
 *
 * @param modifiers - modifier(s) to add
 * @param map - existing map to add to, or undefined to create a new one
 * @returns the modifier map with the new modifiers added
 *
 * @example
 * ```ts
 * const mod = modifier<{ x: number }>('double', (o) => { o.x *= 2; });
 * const map = addModifiers(mod);
 * map.has('double'); // true
 * ```
 */
export function addModifiers<T>(modifiers: ArrayOrValue<Modifier<T>>, map?: Maybe<ModifierMap<T>>): ModifierMap<T> {
  map ??= new Map();

  forEachWithArray(modifiers, (modifier) => (map as ModifierMap<T>).set(modifier.key, modifier));

  return map;
}

/**
 * Removes one or more modifiers from the map by key. Returns an empty map if no map is provided.
 *
 * @param modifiers - modifier(s) whose keys should be removed
 * @param map - the map to remove from
 * @returns the modifier map with the specified modifiers removed
 *
 * @example
 * ```ts
 * const mod = modifier<{ x: number }>('double', (o) => { o.x *= 2; });
 * const map = addModifiers(mod);
 * const result = removeModifiers(mod, map);
 * result.has('double'); // false
 * ```
 */
export function removeModifiers<T>(modifiers: ArrayOrValue<Modifier<T>>, map: Maybe<ModifierMap<T>>): ModifierMap<T> {
  if (map) {
    forEachWithArray(modifiers, (modifier) => (map as ModifierMap<T>).delete(modifier.key));
  } else {
    map = new Map();
  }

  return map;
}

/**
 * Converts a {@link ModifierMap} to a single {@link ModifierFunction} that applies all modifiers in sequence.
 *
 * Returns {@link NOOP_MODIFIER} if the map is nullish or empty.
 *
 * @param map - the modifier map to convert
 * @returns a single modifier function that applies all mapped modifiers, or {@link NOOP_MODIFIER} if empty
 *
 * @example
 * ```ts
 * const mod = modifier<{ x: number }>('inc', (o) => { o.x += 1; });
 * const map = addModifiers(mod);
 * const fn = modifierMapToFunction(map);
 * const obj = { x: 0 };
 * fn(obj);
 * // obj.x === 1
 * ```
 */
export function modifierMapToFunction<T>(map: Maybe<ModifierMap<T>>): ModifierFunction<T> {
  return maybeModifierMapToFunction(map) ?? NOOP_MODIFIER;
}

/**
 * Converts a {@link ModifierMap} to a single {@link ModifierFunction} if the map is non-null.
 *
 * Returns undefined if no map is provided, allowing callers to distinguish "no modifiers" from "empty modifiers".
 *
 * @param map - the modifier map to convert
 * @returns a composed modifier function, or `undefined` if no map is provided
 */
export function maybeModifierMapToFunction<T>(map: Maybe<ModifierMap<T>>): Maybe<ModifierFunction<T>> {
  let fn: Maybe<ModifierFunction<T>>;

  if (map != null) {
    const fns: ModifierFunction<T>[] = [];
    map.forEach((x) => fns.push(x.modify));
    fn = (input) => fns.forEach((fn) => fn(input));
  }

  return fn;
}

/**
 * Merges an array of {@link ModifierFunction} values into a single function that applies them all in order.
 *
 * Returns {@link NOOP_MODIFIER} if the array is empty or nullish.
 *
 * @param modifiers - array of modifier functions to merge
 * @returns a single modifier function that applies all provided modifiers, or {@link NOOP_MODIFIER} if empty
 *
 * @example
 * ```ts
 * const add1 = (o: { x: number }) => { o.x += 1; };
 * const double = (o: { x: number }) => { o.x *= 2; };
 * const merged = mergeModifiers([add1, double]);
 * const obj = { x: 3 };
 * merged(obj);
 * // obj.x === 8 (3 + 1 = 4, then 4 * 2 = 8)
 * ```
 */
export function mergeModifiers<T>(modifiers: ModifierFunction<T>[]): ModifierFunction<T> {
  return maybeMergeModifiers(modifiers) ?? NOOP_MODIFIER;
}

/**
 * Merges an array of {@link ModifierFunction} values into a single function. Returns undefined if the input is nullish.
 *
 * If only one modifier is provided, returns it directly without wrapping.
 *
 * @param modifiers - array of modifier functions to merge, or undefined
 * @returns a composed modifier function, the single modifier if only one provided, or `undefined` if input is nullish
 */
export function maybeMergeModifiers<T>(modifiers: Maybe<ModifierFunction<T>[]>): Maybe<ModifierFunction<T>> {
  let result: Maybe<ModifierFunction<T>> = undefined;

  if (modifiers != null) {
    switch (modifiers.length) {
      case 1:
        result = modifiers[0];
        break;
      default:
        result = (input) => (modifiers as ModifierFunction<T>[]).forEach((fn) => fn(input));
        break;
    }
  }

  return result;
}
