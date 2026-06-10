import { type Maybe } from '@dereekb/util';
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
   * Optional grouping label used to cluster toggles in the controls UI (e.g. `'corner shape'`, `'surface'`).
   */
  readonly group?: Maybe<string>;
}
