import { DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { Component, ElementRef, Type, OnInit, OnDestroy } from '@angular/core';
import { NgPopoverRef } from 'ng-overlay-container';
import { Observable, BehaviorSubject, map, skip, first, defaultIfEmpty } from 'rxjs';
import { AbstractPopoverDirective } from '../popover/abstract.popover.directive';
import { DbxPopoverConfigSizing, DbxPopoverService } from '../popover/popover.service';
import { FilterSource, FilterSourceConnector, PresetFilterSource, filterMaybe, SubscriptionObject } from '@dereekb/rxjs';
import { DbxPopoverKey } from '../popover/popover';
import { type Maybe } from '@dereekb/util';

export interface DbxFilterComponentParams<F extends object = object, P extends string = string, CF extends FilterSource<F> = FilterSource<F>, PF extends PresetFilterSource<F, P> = PresetFilterSource<F, P>> extends DbxPopoverConfigSizing {
  /**
   * Custom icon
   *
   * Defaults to "filter_list"
   */
  icon?: string;
  /**
   * Custom header text
   *
   * Defaults to "Filter"
   */
  header?: string;
  /**
   * Custom customize button text. If not defined, defaults to "Customize"
   */
  customizeButtonText?: string;
  /**
   * Custom close button text. If not defined, defaults to "Close"
   */
  closeButtonText?: string;
  /**
   * Whether or not to show the close button. Defaults to the value of !closeOnFilterChange
   */
  showCloseButton?: Maybe<boolean>;
  /**
   * Custom filter component to initialize.
   */
  customFilterComponentClass?: Type<CF>;
  /**
   * Preset filter component to initialize.
   */
  presetFilterComponentClass?: Type<PF>;
  /**
   * DbxInjectionComponentConfig for the custom filter component to initialize.
   */
  customFilterComponentConfig?: DbxInjectionComponentConfig<CF>;
  /**
   * DbxInjectionComponentConfig for the preset filter component to initialize.
   */
  presetFilterComponentConfig?: DbxInjectionComponentConfig<PF>;
  /**
   * The connector to use.
   */
  connector: FilterSourceConnector<F>;
  /**
   * (Optional) Inital filter to pass to the filter source.
   */
  initialFilterObs?: Observable<F>;
  /**
   * (Optional) Whether or not to close the component if the filter changes.
   *
   * True by default.
   */
  closeOnFilterChange?: boolean;
}

export interface DbxFilterPopoverComponentParams<F extends object = object> extends DbxFilterComponentParams<F> {
  /**
   * Origin to add the popover to.
   */
  origin: ElementRef;
}

export const DEFAULT_FILTER_POPOVER_KEY = 'filter';

@Component({
  templateUrl: './filter.popover.component.html'
})
export class DbxFilterPopoverComponent<F extends object> extends AbstractPopoverDirective<unknown, DbxFilterComponentParams<F>> implements OnInit, OnDestroy {
  private _closeOnChangeSub = new SubscriptionObject();

  readonly showCloseButton = this.config.showCloseButton ?? !(this.config.closeOnFilterChange ?? true);
  readonly closeButtonText = this.config.closeButtonText ?? 'Close';
  readonly customizeButtonText = this.config.customizeButtonText ?? 'Customize';

  /**
   * Whether or not to display buttons to toggle between custom and preset filters.
   */
  readonly showSwitchButtons = Boolean(this.config.customFilterComponentClass && this.config.presetFilterComponentClass);

  private _showPreset = new BehaviorSubject<boolean>(false);
  readonly showPreset$ = this._showPreset.asObservable();

  readonly config$: Observable<DbxInjectionComponentConfig<FilterSource<F>>> = this._showPreset.pipe(
    map((showPreset) => {
      const { closeOnFilterChange = true, connector, initialFilterObs, customFilterComponentClass, presetFilterComponentClass, customFilterComponentConfig, presetFilterComponentConfig } = this.config;
      let componentClass: Type<FilterSource<F>>;
      let baseConfig: Maybe<DbxInjectionComponentConfig<FilterSource<F>>>;

      if (showPreset) {
        componentClass = (presetFilterComponentConfig?.componentClass ?? presetFilterComponentClass) as Type<FilterSource<F>>;
        baseConfig = presetFilterComponentConfig;
      } else {
        componentClass = (customFilterComponentConfig?.componentClass ?? customFilterComponentClass) as Type<FilterSource<F>>;
        baseConfig = customFilterComponentConfig;
      }

      const config: DbxInjectionComponentConfig<FilterSource<F>> = {
        ...baseConfig,
        componentClass,
        init: (filterSource) => {
          connector.connectWithSource(filterSource);

          if (initialFilterObs && filterSource.initWithFilter) {
            filterSource.initWithFilter(initialFilterObs);
          }

          if (closeOnFilterChange !== false) {
            this._closeOnChangeSub.subscription = filterSource.filter$.pipe(skip(1), filterMaybe(), first(), defaultIfEmpty(undefined)).subscribe(() => {
              this.close();
            });
          }

          // run the next init if provided
          baseConfig?.init?.(filterSource);
        }
      };

      return config;
    })
  );

  static openPopover<F extends object>(popupService: DbxPopoverService, { width, height, isResizable, origin, header, icon, customFilterComponentClass, presetFilterComponentClass, customFilterComponentConfig, presetFilterComponentConfig, connector, initialFilterObs, closeOnFilterChange, customizeButtonText, showCloseButton, closeButtonText }: DbxFilterPopoverComponentParams<F>, popoverKey?: DbxPopoverKey): NgPopoverRef {
    return popupService.open({
      key: popoverKey ?? DEFAULT_FILTER_POPOVER_KEY,
      origin,
      componentClass: DbxFilterPopoverComponent,
      width,
      height,
      isResizable,
      data: {
        header,
        icon,
        customizeButtonText,
        showCloseButton,
        closeButtonText,
        customFilterComponentClass,
        presetFilterComponentClass,
        customFilterComponentConfig,
        presetFilterComponentConfig,
        connector,
        initialFilterObs,
        closeOnFilterChange
      } as DbxFilterComponentParams<F>
    });
  }

  get config(): DbxFilterComponentParams<F> {
    return this.popover.data as DbxFilterComponentParams<F>;
  }

  get icon() {
    return this.config.icon ?? 'filter_list';
  }

  get header() {
    return this.config.header ?? 'Filter';
  }

  ngOnInit(): void {
    let showPreset = false;
    const { customFilterComponentClass, presetFilterComponentClass, customFilterComponentConfig, presetFilterComponentConfig } = this.config;

    if (customFilterComponentClass || customFilterComponentConfig) {
      showPreset = false;
    }

    if (presetFilterComponentClass || presetFilterComponentConfig) {
      showPreset = true;
    }

    if (!(customFilterComponentClass || customFilterComponentConfig) && !(presetFilterComponentClass || presetFilterComponentConfig)) {
      throw new Error('Requires a preset or custom class provided for DbxFilterPopover.');
    }

    this._showPreset.next(showPreset);
  }

  ngOnDestroy(): void {
    this._closeOnChangeSub.destroy();
    this._showPreset.complete();
  }

  showPresets() {
    this._showPreset.next(true);
  }

  showCustom() {
    this._showPreset.next(false);
  }
}
