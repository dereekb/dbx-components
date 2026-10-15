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
   * (Optional) Whether or not to show the popover's buttons in its header: the "Customize"/"Presets" switch button and the close button.
   *
   * True by default.
   */
  readonly showButtonsInHeader?: Maybe<boolean>;
  /**
   * (Optional) Whether or not to also show the popover's buttons below the filter content, such as right under a preset list or a form:
   * the same switch and close buttons as the header.
   *
   * False by default. Can be shown together with the header buttons. To place a switch button elsewhere, the filter content can show a
   * `dbx-filter-popover-switch-button` itself.
   */
  readonly showButtonsBelowContent?: Maybe<boolean>;
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
   * Whether or not to show the close button.
   *
   * Defaults to whether the shown filter keeps the popover open on a filter change: {@link closeOnFilterChange} for the preset filter,
   * {@link closeOnCustomFilterChange} for the custom filter. The close button is the only way to close a popover that stays open, besides
   * clicking outside of it.
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
   * (Optional) Whether or not to close the popover when the filter changes.
   *
   * True by default. Applies to the preset filter, and to the custom filter unless {@link closeOnCustomFilterChange} is set.
   */
  readonly closeOnFilterChange?: boolean;
  /**
   * (Optional) Whether or not to close the popover when the filter changes while the custom filter is shown.
   *
   * Defaults to {@link closeOnFilterChange}. Set it to false with a preset filter to have a preset close the popover right away,
   * while the custom filter applies each change right away and keeps the popover open until its close button is clicked.
   */
  readonly closeOnCustomFilterChange?: Maybe<boolean>;
  /**
   * (Optional) Whether or not to close the popover when a route transition succeeds.
   *
   * Defaults to false when a filter in the popover keeps it open across filter changes (see {@link closeOnFilterChange} and
   * {@link closeOnCustomFilterChange}), and true otherwise. A filter written to the URL (see DbxFilterMapRouteParamsDirective)
   * causes a transition on every change, so the popover must stay open across both while it is edited. The popover still closes
   * when the button that opened it is destroyed, such as when navigating to another page.
   */
  readonly closeOnTransition?: Maybe<boolean>;
}
