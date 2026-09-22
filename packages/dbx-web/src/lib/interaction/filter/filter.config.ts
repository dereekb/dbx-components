import { type Type } from '@angular/core';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { type FilterSource, type PresetFilterSource, type FilterSourceConnector } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { type Observable } from 'rxjs';
import { type DbxPopoverConfigSizing } from '../popover/popover.service';
import { type DbxButtonStyle } from '../../button/button';

/**
 * Configuration for the filter popover component, defining custom and preset filter components along with display options.
 */
export interface DbxFilterComponentConfig<F extends object = object, P extends string = string, CF extends FilterSource<F> = FilterSource<F>, PF extends PresetFilterSource<F, P> = PresetFilterSource<F, P>> extends DbxPopoverConfigSizing {
  /**
   * Custom icon
   *
   * Defaults to "filter_list"
   */
  readonly icon?: string;
  /**
   * Custom header text
   *
   * Defaults to "Filter"
   */
  readonly header?: string;
  /**
   * Custom customize button text. If not defined, defaults to "Customize"
   */
  readonly customizeButtonText?: string;
  /**
   * Custom presets button text. If not defined, defaults to "Presets"
   */
  readonly presetsButtonText?: string;
  /**
   * Custom close button text. If not defined, defaults to "Close"
   */
  readonly closeButtonText?: string;
  /**
   * (Optional) Style for the "Customize"/"Presets" switch buttons in the popover header.
   *
   * Defaults to {@link DEFAULT_FILTER_POPOVER_SWITCH_BUTTON_STYLE}.
   *
   * Only the style is configurable here; the button text comes from {@link customizeButtonText} / {@link presetsButtonText}.
   */
  readonly switchButtonStyle?: Maybe<DbxButtonStyle>;
  /**
   * (Optional) Style for the close button in the popover header.
   *
   * Defaults to {@link DEFAULT_FILTER_POPOVER_CLOSE_BUTTON_STYLE}. Set a `color` here to paint the close button with an
   * arbitrary {@link DbxColorInput} (including a registered color template) rather than the default accent palette.
   *
   * Only the style is configurable here; the button text comes from {@link closeButtonText}.
   */
  readonly closeButtonStyle?: Maybe<DbxButtonStyle>;
  /**
   * Whether or not to show the close button. Defaults to the value of !closeOnFilterChange
   */
  readonly showCloseButton?: Maybe<boolean>;
  /**
   * Custom filter component to initialize.
   */
  readonly customFilterComponentClass?: Type<CF>;
  /**
   * Preset filter component to initialize.
   */
  readonly presetFilterComponentClass?: Type<PF>;
  /**
   * DbxInjectionComponentConfig for the custom filter component to initialize.
   */
  readonly customFilterComponentConfig?: DbxInjectionComponentConfig<CF>;
  /**
   * DbxInjectionComponentConfig for the preset filter component to initialize.
   */
  readonly presetFilterComponentConfig?: DbxInjectionComponentConfig<PF>;
  /**
   * The connector to use.
   */
  readonly connector: FilterSourceConnector<F>;
  /**
   * (Optional) Initial filter to pass to the filter source.
   *
   * Must be independent of the connector's output. Deriving this from the connector's own filter$ (the stream this popover's source feeds) is a cycle: the source waits on the connector and the connector waits on the source, so the popover opens with no value. Pass a snapshot of the currently applied filter instead.
   */
  readonly initialFilterObs?: Observable<F>;
  /**
   * (Optional) Whether or not to close the component if the filter changes.
   *
   * True by default.
   */
  readonly closeOnFilterChange?: boolean;
}
