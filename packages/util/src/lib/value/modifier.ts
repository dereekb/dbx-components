import { ArrayOrValue, forEachWithArray } from '../array';
import { Maybe } from './maybe.type';

/**
 * Modifier key
 */
export type ModifierKey = string;

/**
 * Modifies the input value.
 */
export type ModifierFunction<T> = (input: T) => void;

/**
 * Retains a reference to a ModifierFunction
 */
export interface ModifierFunctionRef<T> {
  readonly modify: ModifierFunction<T>;
}

/**
 * A modifier that has a key and modify function.
 */
export interface Modifier<T> extends ModifierFunctionRef<T> {
  /**
   * Modifier key.
   */
  readonly key: ModifierKey;
}

/**
 * Creates a new modifier
 *
 * @param key
 * @param modify
 * @returns
 */
export function modifier<T>(key: string, modify: ModifierFunction<T>): Modifier<T> {
  return {
    key,
    modify
  };
}

export const NOOP_MODIFIER: ModifierFunction<any> = () => undefined;

/**
 * Map of Modifiers keyed by the modifier key.
 */
export type ModifierMap<T> = Map<ModifierKey, Modifier<T>>;

/**
 * Adds a modifier to the modifier map and returns the map.
 *
 * @param modifier
 * @param map
 * @returns
 */
export function addModifiers<T>(modifiers: ArrayOrValue<Modifier<T>>, map?: Maybe<ModifierMap<T>>): ModifierMap<T> {
  if (!map) {
    map = new Map();
  }

  forEachWithArray(modifiers, (modifier) => (map as ModifierMap<T>).set(modifier.key, modifier));

  return map;
}

/**
 * Removes a modifier from the modifier map and returns the map.
 *
 * @param modifier
 * @param map
 */
export function removeModifiers<T>(modifiers: ArrayOrValue<Modifier<T>>, map: Maybe<ModifierMap<T>>): ModifierMap<T> {
  if (map) {
    forEachWithArray(modifiers, (modifier) => (map as ModifierMap<T>).delete(modifier.key));
  } else {
    map = new Map();
  }

  return map;
}

export function modifierMapToFunction<T>(map: Maybe<ModifierMap<T>>): ModifierFunction<T> {
  return maybeModifierMapToFunction(map) ?? NOOP_MODIFIER;
}

/**
 * Converts a ModifierMap to a ModifierFunction if the map is input or has functions. Otherwise returns undefined.
 *
 * @param map
 * @returns
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
 * Merges all modifiers into a single function.
 *
 * @param map
 * @returns
 */
export function mergeModifiers<T>(modifiers: ModifierFunction<T>[]): ModifierFunction<T> {
  return maybeMergeModifiers(modifiers) ?? NOOP_MODIFIER;
}

/**
 * Merges all modifiers into a single function. If not modifier functions are input, returns
 *
 * @param map
 * @returns
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
