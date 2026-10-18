import { flattenModelManifestFields, type ModelManifest } from './model.manifest';

/**
 * One field that stores an enum, as listed by {@link buildModelManifestEnumUsageIndex}.
 */
export interface ModelManifestEnumUsage {
  readonly modelType: string;
  /**
   * Dotted path of persisted short keys from the model root (e.g. `ts`, `r.s`).
   */
  readonly field: string;
  /**
   * Dotted path of long names from the model root (e.g. `textSendState`, `resume.state`).
   */
  readonly longName: string;
}

/**
 * Reverse index from enum name to the fields that store it.
 */
export type ModelManifestEnumUsageIndex = ReadonlyMap<string, readonly ModelManifestEnumUsage[]>;

/**
 * Builds the enum → fields reverse index: for every field with an `enumRef`, nested fields included.
 * Usages are listed in manifest order, each model's fields pre-order.
 *
 * @param manifest - The model manifest to index.
 * @returns The usages of each referenced enum name.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildModelManifestEnumUsageIndex(manifest: ModelManifest): ModelManifestEnumUsageIndex {
  const index = new Map<string, ModelManifestEnumUsage[]>();

  for (const entry of manifest) {
    for (const { field, path, longPath } of flattenModelManifestFields(entry.fields)) {
      const enumRef = field.enumRef;

      if (enumRef) {
        let usages = index.get(enumRef);

        if (usages == null) {
          usages = [];
          index.set(enumRef, usages);
        }

        usages.push({ modelType: entry.modelType, field: path, longName: longPath });
      }
    }
  }

  return index;
}
