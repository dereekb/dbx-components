import { ArrayOrValue, forEachWithArray } from "../array";
import { Maybe } from "./maybe";

/**
 * Modifier key
 */
export type ModifierKey = string;

/**
 * Modifies the input value.
 */
export type ModifierFunction<T> = (input: T) => void;

/**
 * A modifier that has a key and modify function.
 */
export interface Modifier<T> {

  /**
   * Modifier key.
   */
  readonly key: ModifierKey;

  /**
   * 
   */
  readonly modify: ModifierFunction<T>;

}

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

  forEachWithArray(modifiers, (modifier) => map!.set(modifier.key, modifier));

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
    forEachWithArray(modifiers, (modifier) => map!.delete(modifier.key));
  } else {
    map = new Map();
  }

  return map;
}


export function modifierMapToFunction<T>(map: Maybe<ModifierMap<T>>): ModifierFunction<T> {
  return maybeModifierMapToFunction(map) ?? (() => undefined);
}


/**
 * Converts a ModifierMap to a ModifierFunction if the map is input or has functions. Otherwise returns undefined.
 * 
 * @param map 
 * @returns 
 */
export function maybeModifierMapToFunction<T>(map: Maybe<ModifierMap<T>>): Maybe<ModifierFunction<T>> {
  const fns: ModifierFunction<T>[] = [];
  map?.forEach((x) => fns.push(x.modify));
  return (input) => {
    fns.forEach((fn) => fn(input));
  };
}
