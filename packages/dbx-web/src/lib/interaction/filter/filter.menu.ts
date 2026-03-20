import { type ClickableAnchorLink } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { combineLatest, distinctUntilChanged, map, type Observable, shareReplay, switchMap } from 'rxjs';

/**
 * Configuration for the preset filter menus
 */
export interface DbxPresetFilterMenuConfig {
  /**
   * The text to display for the unknown selection.
   */
  readonly unknownSelectionText?: string;
  /**
   * The icon to use for the filter, or false if no icon should be shown.
   */
  readonly filterIcon?: Maybe<string> | false;
  /**
   * Whether or not to use the preset's icon if one is defined. If filterIcon is false, the icon will only appear when an item is selected.
   */
  readonly usePresetIcon?: boolean;
}

/**
 * Creates an observable that emits the button text for a preset filter menu based on the current selection.
 *
 * @param config$ - Observable of the preset filter menu configuration
 * @param selection$ - Observable of the currently selected preset, used to derive the display title
 * @param defaultText - Fallback text when no selection or unknownSelectionText is configured. Defaults to 'Filter'.
 * @returns An observable emitting the resolved button text string
 *
 * @example
 * ```ts
 * const text$ = dbxPresetFilterMenuButtonTextObservable(config$, selectedPreset$);
 * ```
 */
export function dbxPresetFilterMenuButtonTextObservable(config$: Observable<DbxPresetFilterMenuConfig>, selection$: Observable<Maybe<Partial<Pick<ClickableAnchorLink, 'title'>>>>, defaultText = 'Filter') {
  return combineLatest([config$, selection$]).pipe(
    map(([config, preset]) => preset?.title ?? config.unknownSelectionText ?? defaultText),
    distinctUntilChanged(),
    shareReplay(1)
  );
}

/**
 * Creates an observable that emits the button icon for a preset filter menu based on the current selection and config.
 *
 * @param config$ - Observable of the preset filter menu configuration controlling icon behavior
 * @param selection$ - Observable of the currently selected preset, used to derive the display icon
 * @param defaultIcon - Fallback icon when no filterIcon is configured. Defaults to 'arrow_drop_down'.
 * @returns An observable emitting the resolved icon string, or undefined when no icon should be shown
 *
 * @example
 * ```ts
 * const icon$ = dbxPresetFilterMenuButtonIconObservable(config$, selectedPreset$);
 * ```
 */
export function dbxPresetFilterMenuButtonIconObservable(config$: Observable<DbxPresetFilterMenuConfig>, selection$: Observable<Maybe<Partial<Pick<ClickableAnchorLink, 'icon'>>>>, defaultIcon = 'arrow_drop_down') {
  return config$.pipe(
    switchMap((config) => {
      const filterIcon = config.filterIcon === false ? '' : config.filterIcon || defaultIcon;

      return selection$.pipe(
        map((preset) => {
          let icon: Maybe<string>;

          if (config.filterIcon === false) {
            if (config.usePresetIcon) {
              icon = preset?.icon;
            }
          } else if (config.usePresetIcon) {
            icon = preset?.icon ?? filterIcon;
          } else {
            icon = filterIcon;
          }

          return icon;
        })
      );
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );
}
