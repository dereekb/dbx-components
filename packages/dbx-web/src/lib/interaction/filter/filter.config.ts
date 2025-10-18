import { type Type } from '@angular/core';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { type FilterSource, type PresetFilterSource, type FilterSourceConnector } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { type Observable } from 'rxjs';
import { type DbxPopoverConfigSizing } from '../popover/popover.service';

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
   * Custom close button text. If not defined, defaults to "Close"
   */
  readonly closeButtonText?: string;
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
   * (Optional) Inital filter to pass to the filter source.
   */
  readonly initialFilterObs?: Observable<F>;
  /**
   * (Optional) Whether or not to close the component if the filter changes.
   *
   * True by default.
   */
  readonly closeOnFilterChange?: boolean;
}
