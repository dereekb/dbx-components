import { DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { Component, ElementRef, Type, OnInit, OnDestroy } from '@angular/core';
import { NgPopoverRef } from 'ng-overlay-container';
import { Observable, BehaviorSubject, map } from 'rxjs';
import { AbstractPopoverDirective } from '../popover/abstract.popover.directive';
import { DbxPopoverComponent } from '../popover/popover.component';
import { DbxPopoverService } from '../popover/popover.service';
import { FilterSource, FilterSourceConnector, PresetFilterSource } from '@dereekb/rxjs';
import { DbxPopoverKey } from '../popover/popover';

export interface DbxFilterComponentParams<F = object> {
  /**
   * Custom filter component to initialize.
   */
  customFilterComponentClass?: Type<FilterSource<F>>;
  /**
   * Preset filter component to initialize.
   */
  presetFilterComponentClass?: Type<PresetFilterSource<F>>;
  /**
   * The connector to use.
   */
  connector: FilterSourceConnector<F>;
  /**
   * (Optional) Inital filter to pass to the filter source.
   */
  initialFilterObs?: Observable<F>;
}

export interface DbxFilterPopoverComponentParams<F = object> extends DbxFilterComponentParams<F> {
  /**
   * Origin to add the popover to.
   */
  origin: ElementRef;
}

export const DEFAULT_FILTER_POPOVER_KEY = 'filter';

@Component({
  templateUrl: './filter.popover.component.html'
})
export class DbxFilterPopoverComponent<F> extends AbstractPopoverDirective<unknown, DbxFilterComponentParams<F>> implements OnInit, OnDestroy {
  /**
   * Whether or not to display buttons to toggle between custom and preset filters.
   */
  readonly showSwitchButtons = Boolean(this.config.customFilterComponentClass && this.config.presetFilterComponentClass);

  private _showPreset = new BehaviorSubject<boolean>(false);
  readonly showPreset$ = this._showPreset.asObservable();

  readonly config$: Observable<DbxInjectionComponentConfig<FilterSource<F>>> = this._showPreset.pipe(
    map((showPreset) => {
      const { connector, initialFilterObs, customFilterComponentClass, presetFilterComponentClass } = this.config;
      let componentClass: Type<FilterSource<F>>;

      if (showPreset) {
        componentClass = presetFilterComponentClass as Type<PresetFilterSource<F>>;
      } else {
        componentClass = customFilterComponentClass as Type<FilterSource<F>>;
      }

      const config: DbxInjectionComponentConfig<FilterSource<F>> = {
        componentClass,
        init: (filterSource) => {
          connector.connectWithSource(filterSource);

          if (initialFilterObs && filterSource.initWithFilter) {
            filterSource.initWithFilter(initialFilterObs);
          }
        }
      };

      return config;
    })
  );

  static openPopover<F>(popupService: DbxPopoverService, { origin, initialFilterObs: inputSource, connector, customFilterComponentClass, presetFilterComponentClass }: DbxFilterPopoverComponentParams<F>, popoverKey?: DbxPopoverKey): NgPopoverRef {
    return popupService.open({
      key: popoverKey ?? DEFAULT_FILTER_POPOVER_KEY,
      origin,
      componentClass: DbxFilterPopoverComponent,
      data: {
        initialFilterObs: inputSource,
        connector,
        customFilterComponentClass,
        presetFilterComponentClass
      } as DbxFilterComponentParams<F>
    });
  }

  constructor(popover: DbxPopoverComponent<unknown, DbxFilterComponentParams<F>>) {
    super(popover);
  }

  get config(): DbxFilterComponentParams<F> {
    return this.popover.data as DbxFilterComponentParams<F>;
  }

  ngOnInit(): void {
    let showPreset = false;
    const { customFilterComponentClass, presetFilterComponentClass } = this.config;

    if (customFilterComponentClass) {
      showPreset = false;
    }

    if (presetFilterComponentClass) {
      showPreset = true;
    }

    if (!customFilterComponentClass && !presetFilterComponentClass) {
      throw new Error('Requires a preset or custom class provided for DbxFilterPopover.');
    }

    this._showPreset.next(showPreset);
  }

  ngOnDestroy(): void {
    this._showPreset.complete();
  }

  showPresets() {
    this._showPreset.next(true);
  }

  showCustom() {
    this._showPreset.next(false);
  }
}
