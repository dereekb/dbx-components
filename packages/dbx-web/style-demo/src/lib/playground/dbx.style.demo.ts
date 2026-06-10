import { InjectionToken, type Signal, type Type } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type DbxStyleDemoSection, type DbxStyleDemoSectionId } from '../section/section';
import { type DbxStyleDemoStyleTemplateKey } from '../style-loader/style.template';
import { type DbxStyleDemoTemplateToggle } from '../template-toggle/template.toggle';

/**
 * Detach key used by the style-demo controls detach panel.
 */
export const DBX_STYLE_DEMO_CONTROLS_DETACH_KEY = 'dbx-style-demo-controls';

/**
 * Injection token carrying the component class rendered inside the style-demo controls detach panel.
 *
 * `DbxStyleDemoControlsService` opens this component via `DbxDetachService` (so it survives navigation and is available
 * app-wide) reading the service's {@link DbxStyleDemoControls} state. When unregistered, the controls buttons are hidden.
 *
 * `@dereekb/dbx-form/style-demo` registers `DbxFormStyleDemoControlsDetachComponent` (a chip-field controls UI) here —
 * the controls UI lives in dbx-form because it depends on `@dereekb/dbx-form`'s pickable chip field, which dbx-web cannot import.
 */
export const DBX_STYLE_DEMO_CONTROLS_COMPONENT = new InjectionToken<Type<unknown>>('DbxStyleDemoControlsComponent');

/**
 * Configuration for the `<dbx-style-demo>` playground.
 */
export interface DbxStyleDemoConfig {
  /**
   * When set, only sections whose tags intersect this list are rendered. When unset, all registered sections render.
   */
  readonly tags?: Maybe<string[]>;
  /**
   * Reserved for Phase 2 drag/drop section reordering. Accepted but ignored in v1.
   */
  readonly enableDragDrop?: Maybe<boolean>;
  /**
   * Template keys to activate by default when the playground first renders.
   */
  readonly defaultActiveTemplates?: Maybe<DbxStyleDemoStyleTemplateKey[]>;
}

/**
 * The reactive control surface a `<dbx-style-demo>` playground exposes to its controls popover.
 *
 * The popover reads the signals to render its toggle lists and calls the setters to write the user's choices
 * back to the playground, where they drive the rendered sections and the active style-loader templates.
 */
export interface DbxStyleDemoControls {
  /**
   * The sections available to render (already filtered by the playground's configured tags).
   */
  readonly sectionsSignal: Signal<DbxStyleDemoSection[]>;
  /**
   * The ids of the currently-enabled (visible) sections.
   */
  readonly enabledIdsSignal: Signal<Set<DbxStyleDemoSectionId>>;
  /**
   * The registered template-lever toggles.
   */
  readonly templateTogglesSignal: Signal<DbxStyleDemoTemplateToggle[]>;
  /**
   * The keys of the currently-active template levers.
   */
  readonly activeTemplateKeysSignal: Signal<Set<DbxStyleDemoStyleTemplateKey>>;
  /**
   * Enables or disables a section by id.
   */
  setSectionEnabled(id: DbxStyleDemoSectionId, enabled: boolean): void;
  /**
   * Activates or deactivates a template lever by key.
   *
   * Activating a lever that belongs to a non-null toggle group deactivates the other active levers in that group
   * (radio-like), so only one lever per group is active at a time.
   */
  setTemplateActive(key: DbxStyleDemoStyleTemplateKey, active: boolean): void;
}
