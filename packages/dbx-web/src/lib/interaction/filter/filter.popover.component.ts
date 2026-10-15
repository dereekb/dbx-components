import { cleanSubscription, DbxInjectionComponent, type DbxInjectionComponentConfig, mergeStaticProviders } from '@dereekb/dbx-core';
import { ApplicationRef, Component, DOCUMENT, ElementRef, ErrorHandler, type Type, computed, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { type NgPopoverRef } from 'ng-overlay-container';
import { type Observable, map, skip, first, defaultIfEmpty } from 'rxjs';
import { AbstractPopoverDirective } from '../popover/abstract.popover.directive';
import { type DbxPopoverService } from '../popover/popover.service';
import { type FilterSource, filterMaybe } from '@dereekb/rxjs';
import { type DbxPopoverKey } from '../popover/popover';
import { type DestroyFunction, type Maybe } from '@dereekb/util';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { type DbxFilterComponentConfig } from './filter.config';
import { DbxPopoverInteractionModule } from '../popover';
import { DbxButtonComponent } from '../../button/button.component';
import { DbxButtonSpacerDirective } from '../../button/button.spacer.directive';
import { DbxFilterPopoverViewService } from './filter.popover.view';
import { DbxFilterPopoverSwitchButtonComponent } from './filter.popover.switch.button.component';
import { type DbxButtonStyle } from '../../button/button';
import { type DbxFilterPopoverApplyPendingFunction, DbxFilterPopoverPendingChanges, DbxFilterPopoverPendingChangesInstance } from './filter.popover.pending';

/**
 * Configuration for opening a filter popover, extending the base filter config with origin positioning.
 */
export interface DbxFilterPopoverComponentConfig<F extends object = object> extends DbxFilterComponentConfig<F> {
  /**
   * Origin to add the popover to.
   */
  readonly origin: ElementRef;
}

/**
 * Default popover key used by filter popovers to ensure only one filter popover is open at a time.
 */
export const DEFAULT_FILTER_POPOVER_KEY = 'filter';

/**
 * Default style for the popover header's "Customize"/"Presets" switch buttons.
 */
export const DEFAULT_FILTER_POPOVER_SWITCH_BUTTON_STYLE: DbxButtonStyle = { type: 'flat', color: 'accent' };

/**
 * Default style for the popover header's close button.
 */
export const DEFAULT_FILTER_POPOVER_CLOSE_BUTTON_STYLE: DbxButtonStyle = { type: 'stroked', color: 'accent' };

/**
 * Popover component that renders custom and/or preset filter components with toggling support.
 *
 * Use the static `openPopover` method to programmatically open the filter popover.
 *
 * With both a preset and a custom filter, the header shows a button to switch between them, and each closes the popover on a filter
 * change as configured: {@link DbxFilterComponentConfig.closeOnFilterChange} for the preset filter, and
 * {@link DbxFilterComponentConfig.closeOnCustomFilterChange} for the custom filter. The close button shows while the shown filter
 * keeps the popover open. The view is shared through {@link DbxFilterPopoverViewService}, which the popover provides to its
 * filter content and switch buttons. The switch and close buttons show in the header and/or below the filter content, as configured
 * by {@link DbxFilterComponentConfig.showButtonsInHeader} and {@link DbxFilterComponentConfig.showButtonsBelowContent}.
 *
 * Provides itself as {@link DbxFilterPopoverPendingChanges} to the filter content. While content has a function registered,
 * this component owns its popover's `getClosingValueFn`: before closing on the close button, on a filter change, on a transition
 * or on a click outside, it blurs the focused element inside the popover (committing typed input), runs pending change detection
 * and effects so that input reaches the content's form value, then calls the registered functions. All of this is synchronous,
 * so the popover closes right away.
 *
 * @example
 * ```ts
 * DbxFilterPopoverComponent.openPopover(popoverService, {
 *   origin: elementRef,
 *   connector: filterConnector,
 *   customFilterComponentClass: MyFilterComponent
 * });
 * ```
 */
@Component({
  templateUrl: './filter.popover.component.html',
  providers: [DbxFilterPopoverViewService],
  imports: [DbxPopoverInteractionModule, DbxInjectionComponent, DbxButtonComponent, DbxButtonSpacerDirective, DbxFilterPopoverSwitchButtonComponent, NgTemplateOutlet]
})
export class DbxFilterPopoverComponent<F extends object> extends AbstractPopoverDirective<unknown, DbxFilterComponentConfig<F>> implements DbxFilterPopoverPendingChanges {
  private readonly _elementRef = inject(ElementRef<HTMLElement>);
  private readonly _document = inject(DOCUMENT);
  private readonly _appRef = inject(ApplicationRef);
  private readonly _errorHandler = inject(ErrorHandler);
  private readonly _pendingChanges = new DbxFilterPopoverPendingChangesInstance((error) => this._errorHandler.handleError(error));

  readonly viewService = inject(DbxFilterPopoverViewService);

  readonly config: DbxFilterComponentConfig<F> = this.popover.data as DbxFilterComponentConfig<F>;

  readonly icon = this.config.icon ?? 'filter_list';
  readonly header = this.config.header ?? 'Filter';

  readonly closeButtonText = this.config.closeButtonText ?? 'Close';
  readonly customizeButtonText = this.config.customizeButtonText ?? 'Customize';
  readonly presetsButtonText = this.config.presetsButtonText ?? 'Presets';

  readonly switchButtonStyle = this.config.switchButtonStyle ?? DEFAULT_FILTER_POPOVER_SWITCH_BUTTON_STYLE;
  readonly closeButtonStyle = this.config.closeButtonStyle ?? DEFAULT_FILTER_POPOVER_CLOSE_BUTTON_STYLE;

  private readonly _hasCustomFilter = Boolean(this.config.customFilterComponentClass || this.config.customFilterComponentConfig);
  private readonly _hasPresetFilter = Boolean(this.config.presetFilterComponentClass || this.config.presetFilterComponentConfig);

  readonly closeOnPresetFilterChange = this.config.closeOnFilterChange ?? true;
  readonly closeOnCustomFilterChange = this.config.closeOnCustomFilterChange ?? this.closeOnPresetFilterChange;

  /**
   * Whether or not to display buttons to toggle between custom and preset filters.
   */
  readonly showSwitchButtons = this._hasCustomFilter && this._hasPresetFilter;

  readonly showButtonsInHeader = this.config.showButtonsInHeader ?? true;
  readonly showButtonsBelowContent = this.config.showButtonsBelowContent ?? false;

  readonly showPresetSignal = this.viewService.showPresetSignal;

  /**
   * Whether or not the shown filter closes the popover when the filter changes.
   */
  readonly closeOnFilterChangeSignal = computed(() => (this.showPresetSignal() ? this.closeOnPresetFilterChange : this.closeOnCustomFilterChange));

  readonly showCloseButtonSignal = computed(() => {
    const closeOnFilterChange = this.closeOnFilterChangeSignal();
    return this.config.showCloseButton ?? !closeOnFilterChange;
  });

  /**
   * Whether or not there is a switch or close button to show.
   */
  readonly hasButtonsSignal = computed(() => {
    const showCloseButton = this.showCloseButtonSignal();
    return this.showSwitchButtons || showCloseButton;
  });

  readonly config$: Observable<DbxInjectionComponentConfig<FilterSource<F>>> = toObservable(this.showPresetSignal).pipe(
    map((showPreset) => {
      const { connector, initialFilterObs, customFilterComponentClass, presetFilterComponentClass, customFilterComponentConfig, presetFilterComponentConfig } = this.config;
      const closeOnFilterChange = showPreset ? this.closeOnPresetFilterChange : this.closeOnCustomFilterChange;
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
        providers: mergeStaticProviders(baseConfig?.providers, { provide: DbxFilterPopoverPendingChanges, useValue: this }, { provide: DbxFilterPopoverViewService, useValue: this.viewService }),
        init: (filterSource) => {
          // NOTE: the source is seeded before it is connected, as connecting subscribes to filter$ immediately.
          // A source that carries a default filter would otherwise emit that default at connect time, so merely opening the popover would reset the filter to the default.
          if (initialFilterObs && filterSource.initWithFilter) {
            filterSource.initWithFilter(initialFilterObs);
          }

          connector.connectWithSource(filterSource);

          if (closeOnFilterChange) {
            cleanSubscription(
              filterSource.filter$.pipe(skip(1), filterMaybe(), first(), defaultIfEmpty(undefined)).subscribe(() => {
                this.close();
              })
            );
          }

          // run the next init if provided
          baseConfig?.init?.(filterSource);
        }
      };

      return config;
    })
  );

  readonly configSignal = toSignal(this.config$);

  static openPopover<F extends object>(
    popupService: DbxPopoverService,
    {
      width,
      height,
      isResizable,
      origin,
      header,
      icon,
      customFilterComponentClass,
      presetFilterComponentClass,
      customFilterComponentConfig,
      presetFilterComponentConfig,
      connector,
      initialFilterObs,
      closeOnFilterChange,
      closeOnCustomFilterChange,
      closeOnTransition,
      customizeButtonText,
      presetsButtonText,
      showCloseButton,
      closeButtonText,
      switchButtonStyle,
      showButtonsInHeader,
      showButtonsBelowContent,
      closeButtonStyle
    }: DbxFilterPopoverComponentConfig<F>,
    popoverKey?: DbxPopoverKey
  ): NgPopoverRef {
    const closesOnPresetFilterChange = closeOnFilterChange ?? true;
    const closesOnCustomFilterChange = closeOnCustomFilterChange ?? closesOnPresetFilterChange;
    const hasCustomFilter = Boolean(customFilterComponentClass || customFilterComponentConfig);
    const hasPresetFilter = Boolean(presetFilterComponentClass || presetFilterComponentConfig);

    // a filter that keeps the popover open across filter changes also keeps it open across the transitions they cause
    const closesOnEveryFilterChange = (!hasPresetFilter || closesOnPresetFilterChange) && (!hasCustomFilter || closesOnCustomFilterChange);

    return popupService.open({
      key: popoverKey ?? DEFAULT_FILTER_POPOVER_KEY,
      origin,
      componentClass: DbxFilterPopoverComponent,
      width,
      height,
      isResizable,
      closeOnTransition: closeOnTransition ?? closesOnEveryFilterChange,
      data: {
        header,
        icon,
        customizeButtonText,
        presetsButtonText,
        showCloseButton,
        closeButtonText,
        switchButtonStyle,
        showButtonsInHeader,
        showButtonsBelowContent,
        closeButtonStyle,
        customFilterComponentClass,
        presetFilterComponentClass,
        customFilterComponentConfig,
        presetFilterComponentConfig,
        connector,
        initialFilterObs,
        closeOnFilterChange,
        closeOnCustomFilterChange
      } as DbxFilterComponentConfig<F>
    });
  }

  constructor() {
    super();

    let showPreset: boolean = false;

    if (this._hasCustomFilter) {
      showPreset = false;
    }

    if (this._hasPresetFilter) {
      showPreset = true;
    }

    if (!this._hasCustomFilter && !this._hasPresetFilter) {
      throw new Error('Requires a preset or custom class provided for DbxFilterPopover.');
    }

    this.viewService.init({
      initialView: showPreset ? 'preset' : 'custom',
      canSwitchViews: this.showSwitchButtons,
      customizeButtonText: this.customizeButtonText,
      presetsButtonText: this.presetsButtonText,
      switchButtonStyle: this.switchButtonStyle,
      // switching destroys the shown filter, so apply its pending change first
      beforeViewChange: () => this._applyPending()
    });
  }

  /**
   * Registers a function that is called before the popover closes. See {@link DbxFilterPopoverPendingChanges}.
   *
   * @param applyPending - Function that applies the pending change.
   * @returns Removes the registration when called.
   */
  registerApplyPending(applyPending: DbxFilterPopoverApplyPendingFunction): DestroyFunction {
    const unregister = this._pendingChanges.registerApplyPending(applyPending);
    this.popover.getClosingValueFn = this._applyPendingBeforeClose;

    return () => {
      unregister();

      if (!this._pendingChanges.hasApplyPending && this.popover.getClosingValueFn === this._applyPendingBeforeClose) {
        this.popover.getClosingValueFn = undefined;
      }
    };
  }

  private readonly _applyPendingBeforeClose = (): undefined => {
    this._applyPending();
    return undefined;
  };

  /**
   * Applies the content's pending changes: blurs the focused element inside the popover (committing typed input), runs pending
   * change detection and effects, then calls the registered functions.
   */
  private _applyPending(): void {
    if (this._pendingChanges.hasApplyPending) {
      const active = this._document.activeElement;

      // blurring commits input that is applied on blur, such as a typed date
      if (active && this._elementRef.nativeElement.contains(active)) {
        (active as HTMLElement).blur?.();
      }

      this._runPendingEffects();
      this._pendingChanges.applyPending();
    }
  }

  /**
   * Runs pending change detection and effects, so input committed by the blur reaches the content's form value before the content is asked for it.
   */
  private _runPendingEffects(): void {
    try {
      this._appRef.tick();
    } catch (error) {
      // a tick that is already running (Angular error 101) runs the pending effects itself
      if ((error as Maybe<{ code?: unknown }>)?.code !== 101) {
        this._errorHandler.handleError(error);
      }
    }
  }

  showPresets() {
    this.viewService.showPresets();
  }

  showCustom() {
    this.viewService.showCustom();
  }
}
