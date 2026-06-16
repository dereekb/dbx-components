import { type Type } from '@angular/core';
import { type Maybe } from '@dereekb/util';

/**
 * Identifier for a {@link DbxStyleDemoSection}, unique across all registered sections.
 */
export type DbxStyleDemoSectionId = string;

/**
 * A single showcase region rendered by the style-demo playground.
 *
 * Each section is a standalone component demonstrating a styling pattern; the playground renders enabled
 * sections beneath the style-loader host so they repaint live as template levers are toggled.
 */
export interface DbxStyleDemoSection {
  /**
   * Identifier, unique across all registered sections.
   */
  readonly id: DbxStyleDemoSectionId;
  /**
   * Human-readable title shown in the section's card header and the controls toggle list.
   */
  readonly title: string;
  /**
   * Optional grouping label used to cluster sections in the controls UI (e.g. `'cards'`, `'color'`).
   */
  readonly group?: Maybe<string>;
  /**
   * Optional tags used to filter which sections a playground instance renders.
   */
  readonly tags?: Maybe<string[]>;
  /**
   * The standalone component rendered for this section.
   */
  readonly component: Type<unknown>;
  /**
   * Whether the section is enabled by default when the playground first renders. Defaults to true.
   */
  readonly defaultEnabled?: Maybe<boolean>;
}

/**
 * A library's contribution of sections to the style-demo playground, registered via `provideDbxStyleDemoSections`.
 */
export interface DbxStyleDemoSectionGroup {
  /**
   * Identifier of the contributing library (e.g. `'dbx-web'`, `'dbx-form'`).
   */
  readonly libId: string;
  /**
   * The sections this library contributes.
   */
  readonly sections: DbxStyleDemoSection[];
}
