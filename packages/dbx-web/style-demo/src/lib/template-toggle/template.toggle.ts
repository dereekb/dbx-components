import { type Maybe, makeValuesGroupMap } from '@dereekb/util';
import { type DbxStyleDemoStyleTemplateKey } from '../style-loader/style.template';

/**
 * A user-facing lever in the style-demo controls that toggles a registered {@link DbxStyleDemoStyleTemplate} on/off.
 *
 * Active toggles are collected by the playground and fed to the `[dbxStyleDemoStyleLoader]` host so their token
 * overrides ripple through every rendered section.
 */
export interface DbxStyleDemoTemplateToggle {
  /**
   * Key of the registered {@link DbxStyleDemoStyleTemplate} this toggle activates.
   */
  readonly templateName: DbxStyleDemoStyleTemplateKey;
  /**
   * Human-readable label shown in the controls UI.
   */
  readonly label: string;
  /**
   * Optional grouping label used to cluster toggles in the controls UI (e.g. `'Shape'`, `'Surface'`).
   *
   * Toggles sharing a non-null group are treated as mutually exclusive (radio-like): activating one in the controls
   * deactivates the others in the same group. Ungrouped toggles (`null`/`undefined` group) toggle independently.
   */
  readonly group?: Maybe<string>;
}

/**
 * A cluster of {@link DbxStyleDemoTemplateToggle}s sharing the same {@link DbxStyleDemoTemplateToggle.group} label.
 *
 * Produced by {@link groupDbxStyleDemoTemplateToggles} so the controls UI can render each group under a sub-label.
 */
export interface DbxStyleDemoTemplateToggleGroup {
  /**
   * The shared group label, or `null` for the leading cluster of ungrouped toggles.
   */
  readonly label: Maybe<string>;
  /**
   * The toggles in this cluster, in their original registration order.
   */
  readonly toggles: DbxStyleDemoTemplateToggle[];
}

/**
 * Clusters template toggles by their {@link DbxStyleDemoTemplateToggle.group} label for grouped rendering.
 *
 * The ungrouped cluster (`label: null`) is emitted first when any ungrouped toggle exists, followed by each named
 * group in first-seen order. Toggle order within a cluster is preserved.
 *
 * @param toggles - The toggles to cluster.
 * @returns The clusters in render order.
 *
 * @example
 * ```ts
 * groupDbxStyleDemoTemplateToggles([
 *   { templateName: 'a', label: 'A' },
 *   { templateName: 'b', label: 'B', group: 'Shape' },
 *   { templateName: 'c', label: 'C', group: 'Shape' }
 * ]);
 * // -> [{ label: null, toggles: [A] }, { label: 'Shape', toggles: [B, C] }]
 * ```
 */
export function groupDbxStyleDemoTemplateToggles(toggles: DbxStyleDemoTemplateToggle[]): DbxStyleDemoTemplateToggleGroup[] {
  const groupMap = makeValuesGroupMap(toggles, (toggle) => toggle.group ?? null);
  const result: DbxStyleDemoTemplateToggleGroup[] = [];

  const ungrouped = groupMap.get(null);

  if (ungrouped != null) {
    result.push({ label: null, toggles: ungrouped });
  }

  groupMap.forEach((groupToggles, label) => {
    if (label != null) {
      result.push({ label, toggles: groupToggles });
    }
  });

  return result;
}
