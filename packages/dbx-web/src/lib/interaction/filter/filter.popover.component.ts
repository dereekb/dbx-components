import { DbxInjectionComponent, DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { Component, ElementRef, Type, OnInit, OnDestroy, signal, ChangeDetectionStrategy } from '@angular/core';
import { NgPopoverRef } from 'ng-overlay-container';
import { Observable, BehaviorSubject, map, skip, first, defaultIfEmpty } from 'rxjs';
import { AbstractPopoverDirective } from '../popover/abstract.popover.directive';
import { DbxPopoverConfigSizing, DbxPopoverService } from '../popover/popover.service';
import { FilterSource, FilterSourceConnector, PresetFilterSource, filterMaybe, SubscriptionObject } from '@dereekb/rxjs';
import { DbxPopoverKey } from '../popover/popover';
import { type Maybe } from '@dereekb/util';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DbxFilterComponentConfig } from './filter.config';
import { DbxPopoverContentComponent, DbxPopoverHeaderComponent, DbxPopoverInteractionModule } from '../popover';
import { MatButton } from '@angular/material/button';
import { DbxButtonSpacerDirective } from '../../button';

export interface DbxFilterPopoverComponentConfig<F extends object = object> extends DbxFilterComponentConfig<F> {
  /**
   * Origin to add the popover to.
   */
  readonly origin: ElementRef;
}

export const DEFAULT_FILTER_POPOVER_KEY = 'filter';

@Component({
  templateUrl: './filter.popover.component.html',
  imports: [DbxPopoverInteractionModule, DbxInjectionComponent, MatButton, DbxButtonSpacerDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFilterPopoverComponent<F extends object> extends AbstractPopoverDirective<unknown, DbxFilterComponentConfig<F>> implements OnInit, OnDestroy {
  private readonly _closeOnChangeSub = new SubscriptionObject();

  readonly config: DbxFilterComponentConfig<F> = this.popover.data as DbxFilterComponentConfig<F>;

  readonly icon = this.config.icon ?? 'filter_list';
  readonly header = this.config.header ?? 'Filter';

  readonly showCloseButton = this.config.showCloseButton ?? !(this.config.closeOnFilterChange ?? true);
  readonly closeButtonText = this.config.closeButtonText ?? 'Close';
  readonly customizeButtonText = this.config.customizeButtonText ?? 'Customize';

  /**
   * Whether or not to display buttons to toggle between custom and preset filters.
   */
  readonly showSwitchButtons = Boolean(this.config.customFilterComponentClass && this.config.presetFilterComponentClass);

  readonly showPresetSignal = signal<boolean>(false);

  readonly config$: Observable<DbxInjectionComponentConfig<FilterSource<F>>> = toObservable(this.showPresetSignal).pipe(
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

  readonly configSignal = toSignal(this.config$);

  static openPopover<F extends object>(popupService: DbxPopoverService, { width, height, isResizable, origin, header, icon, customFilterComponentClass, presetFilterComponentClass, customFilterComponentConfig, presetFilterComponentConfig, connector, initialFilterObs, closeOnFilterChange, customizeButtonText, showCloseButton, closeButtonText }: DbxFilterPopoverComponentConfig<F>, popoverKey?: DbxPopoverKey): NgPopoverRef {
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
      } as DbxFilterComponentConfig<F>
    });
  }

  ngOnInit(): void {
    let showPreset: boolean = false;

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

    this.showPresetSignal.set(showPreset);
  }

  ngOnDestroy(): void {
    this._closeOnChangeSub.destroy();
  }

  showPresets() {
    this.showPresetSignal.set(true);
  }

  showCustom() {
    this.showPresetSignal.set(false);
  }
}
