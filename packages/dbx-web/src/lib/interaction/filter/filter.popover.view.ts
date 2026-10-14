import { computed, Injectable, signal } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { type DbxButtonStyle } from '../../button/button';

/**
 * A filter view of a filter popover: its preset filter or its custom filter.
 */
export type DbxFilterPopoverView = 'preset' | 'custom';

/**
 * Configuration for a {@link DbxFilterPopoverViewService}, set by the filter popover that provides it.
 */
export interface DbxFilterPopoverViewServiceConfig {
  /**
   * View shown first.
   */
  readonly initialView: DbxFilterPopoverView;
  /**
   * Whether or not the popover has both a preset and a custom filter to switch between.
   */
  readonly canSwitchViews: boolean;
  /**
   * Text of the switch button while the preset filter is shown.
   */
  readonly customizeButtonText: string;
  /**
   * Text of the switch button while the custom filter is shown.
   */
  readonly presetsButtonText: string;
  /**
   * Style of the switch button.
   */
  readonly switchButtonStyle: DbxButtonStyle;
  /**
   * Called right before the view changes, while the shown filter still exists.
   */
  readonly beforeViewChange?: Maybe<() => void>;
}

/**
 * Shared view state of a filter popover: which of its filters is shown, and switching between its preset and custom filters.
 *
 * Provided by DbxFilterPopoverComponent to its header, its footer and its filter content, so any of them can read or switch the view.
 */
@Injectable()
export class DbxFilterPopoverViewService {
  private readonly _config = signal<Maybe<DbxFilterPopoverViewServiceConfig>>(undefined);
  private readonly _view = signal<DbxFilterPopoverView>('preset');

  readonly viewSignal = this._view.asReadonly();
  readonly showPresetSignal = computed(() => this._view() === 'preset');
  readonly canSwitchViewsSignal = computed(() => this._config()?.canSwitchViews ?? false);

  /**
   * Text of the switch button for the shown view.
   */
  readonly switchButtonTextSignal = computed(() => {
    const config = this._config();
    return this.showPresetSignal() ? config?.customizeButtonText : config?.presetsButtonText;
  });

  readonly switchButtonStyleSignal = computed(() => this._config()?.switchButtonStyle);

  /**
   * Configures the service and shows the initial view.
   *
   * @param config - Configuration from the filter popover.
   */
  init(config: DbxFilterPopoverViewServiceConfig): void {
    this._config.set(config);
    this._view.set(config.initialView);
  }

  /**
   * Shows the given view. Does nothing when it is already shown.
   *
   * @param view - View to show.
   */
  setView(view: DbxFilterPopoverView): void {
    if (view !== this._view()) {
      this._config()?.beforeViewChange?.();
      this._view.set(view);
    }
  }

  showPresets(): void {
    this.setView('preset');
  }

  showCustom(): void {
    this.setView('custom');
  }

  /**
   * Switches between the preset and custom views.
   */
  switchView(): void {
    this.setView(this.showPresetSignal() ? 'custom' : 'preset');
  }
}
