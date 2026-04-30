/**
 * Walks an interface's `extends` chain through a same-file lookup map and
 * merges every ancestor's properties into a single name → prop record.
 * Closer ancestors override more distant ones, matching the `.mjs`
 * extractor's `collectInheritedProps`.
 *
 * Cross-file inheritance is intentionally ignored — the registry only
 * follows the chain inside the model's own file. Model interfaces in this
 * codebase consistently keep their inheritance local, so this matches the
 * existing behaviour.
 */

import type { ExtractedInterface, ExtractedInterfaceProp } from './types.js';

/**
 * Returns a map of property-name → prop merged across the supplied
 * interface and every ancestor reachable via `extendsNames`. Walk order
 * is parents-first so the supplied interface's own props win on conflict.
 *
 * @param iface - the interface to start from
 * @param interfaceByName - lookup map of every interface in the same file
 * @returns the merged property map
 */
export function collectInheritedProps(iface: ExtractedInterface, interfaceByName: ReadonlyMap<string, ExtractedInterface>): ReadonlyMap<string, ExtractedInterfaceProp> {
  const out = new Map<string, ExtractedInterfaceProp>();
  const visited = new Set<string>();
  walk(iface, interfaceByName, visited, out);
  return out;
}

function walk(current: ExtractedInterface, interfaceByName: ReadonlyMap<string, ExtractedInterface>, visited: Set<string>, out: Map<string, ExtractedInterfaceProp>): void {
  if (visited.has(current.name)) return;
  visited.add(current.name);
  for (const parentName of current.extendsNames) {
    const parent = interfaceByName.get(parentName);
    if (parent) walk(parent, interfaceByName, visited, out);
  }
  for (const p of current.props) out.set(p.name, p);
}
